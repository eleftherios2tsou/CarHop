from __future__ import annotations

from datetime import date, datetime, timezone

import stripe
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.config import settings
from app.deps import csrf_protect, get_current_verified_user, get_db
from app.models.booking import BookingRequest
from app.models.car import CarListing
from app.models.dispute import Dispute
from app.models.payment import Payment
from app.models.user import User
from app.schemas.payment import PaymentCheckoutOut, PaymentOut

router = APIRouter(prefix="/payments", tags=["payments"])

PLATFORM_FEE_BPS = 1000  # 10%
STRIPE_PROVIDER = "STRIPE"
SIMULATED_PROVIDER = "SIMULATED"


def _load_booking_and_owner(db: Session, booking_id: int) -> tuple[BookingRequest, int]:
    booking = db.get(BookingRequest, booking_id)
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    car = db.get(CarListing, booking.car_id)
    if not car:
        raise HTTPException(status_code=404, detail="Car not found")
    return booking, car.owner_id


def _has_open_dispute(db: Session, booking_id: int) -> bool:
    return (
        db.query(Dispute)
        .filter(Dispute.booking_id == booking_id, Dispute.status == "OPEN")
        .first()
        is not None
    )


def _booking_days(start: date, end: date) -> int:
    days = (end - start).days + 1
    if days <= 0:
        raise HTTPException(status_code=400, detail="Invalid booking dates")
    return days


def _calculate_amounts(booking: BookingRequest, car: CarListing) -> tuple[int, int, int]:
    total = car.daily_price * _booking_days(booking.start_date, booking.end_date)
    fee = max(1, (total * PLATFORM_FEE_BPS) // 10000)
    payout = total - fee
    return total, fee, payout


def _stripe_enabled() -> bool:
    return bool(settings.stripe_secret_key)


def _set_stripe_key() -> None:
    if not settings.stripe_secret_key:
        raise HTTPException(status_code=503, detail="Stripe secret key is not configured")
    stripe.api_key = settings.stripe_secret_key


def _find_payment_by_webhook_ids(db: Session, payment_id: str | None, session_id: str | None) -> Payment | None:
    if payment_id:
        try:
            pid = int(payment_id)
        except ValueError:
            pid = None
        if pid is not None:
            payment = db.get(Payment, pid)
            if payment:
                return payment
    if session_id:
        return db.query(Payment).filter(Payment.provider_ref == session_id).first()
    return None


@router.get("/booking/{booking_id}", response_model=PaymentOut)
def get_booking_payment(
    booking_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_verified_user),
):
    payment = db.query(Payment).filter(Payment.booking_id == booking_id).first()
    if not payment:
        raise HTTPException(status_code=404, detail="No payment for this booking")

    if current_user.role != "ADMIN" and current_user.id not in (payment.renter_id, payment.owner_id):
        raise HTTPException(status_code=403, detail="Not allowed")
    return payment


@router.get("/mine", response_model=list[PaymentOut])
def my_payments(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_verified_user),
):
    if current_user.role == "ADMIN":
        return db.query(Payment).order_by(Payment.id.desc()).all()
    return (
        db.query(Payment)
        .filter(or_(Payment.renter_id == current_user.id, Payment.owner_id == current_user.id))
        .order_by(Payment.id.desc())
        .all()
    )


@router.post("/booking/{booking_id}/pay", response_model=PaymentCheckoutOut, dependencies=[Depends(csrf_protect)])
def pay_booking_to_escrow(
    booking_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_verified_user),
):
    booking, owner_id = _load_booking_and_owner(db, booking_id)

    if booking.renter_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only the renter can pay for this booking")
    if booking.status != "APPROVED":
        raise HTTPException(status_code=400, detail="Only approved bookings can be paid")
    if _has_open_dispute(db, booking_id):
        raise HTTPException(status_code=400, detail="Cannot pay while dispute is open")

    existing = db.query(Payment).filter(Payment.booking_id == booking_id).first()
    if existing and existing.status in {"HELD_IN_ESCROW", "RELEASED_TO_OWNER"}:
        raise HTTPException(status_code=400, detail=f"Payment already exists in status {existing.status}")
    if existing and existing.status == "REFUNDED":
        raise HTTPException(status_code=400, detail="Booking payment has been refunded")

    car = db.get(CarListing, booking.car_id)
    if not car:
        raise HTTPException(status_code=404, detail="Car not found")

    total, fee, payout = _calculate_amounts(booking, car)
    now = datetime.now(timezone.utc)

    payment = existing or Payment(
        booking_id=booking_id,
        renter_id=booking.renter_id,
        owner_id=owner_id,
    )
    payment.currency = settings.payments_currency.upper()
    payment.amount_total = total
    payment.platform_fee = fee
    payment.payout_amount = payout
    payment.released_at = None
    payment.refunded_at = None

    if not _stripe_enabled():
        payment.status = "HELD_IN_ESCROW"
        payment.provider = SIMULATED_PROVIDER
        payment.provider_ref = f"sim_{booking_id}_{int(now.timestamp())}"
        payment.paid_at = now
        if not existing:
            db.add(payment)
        db.commit()
        db.refresh(payment)
        return PaymentCheckoutOut(checkout_url=None, checkout_session_id=None, payment=payment)

    _set_stripe_key()
    payment.status = "PAYMENT_PENDING"
    payment.provider = STRIPE_PROVIDER
    payment.paid_at = None
    if not existing:
        db.add(payment)
    db.commit()
    db.refresh(payment)

    success_url = f"{settings.frontend_base_url}/?payment=success&booking_id={booking_id}"
    cancel_url = f"{settings.frontend_base_url}/?payment=cancel&booking_id={booking_id}"
    car_label = f"{car.make} {car.model} ({car.year})"

    try:
        session = stripe.checkout.Session.create(
            mode="payment",
            success_url=success_url,
            cancel_url=cancel_url,
            payment_method_types=["card"],
            customer_email=current_user.email,
            line_items=[
                {
                    "price_data": {
                        "currency": settings.payments_currency.lower(),
                        "unit_amount": int(total * 100),  # GBP pounds -> pence
                        "product_data": {
                            "name": f"CarHop escrow for booking #{booking_id}",
                            "description": car_label,
                        },
                    },
                    "quantity": 1,
                }
            ],
            metadata={
                "payment_id": str(payment.id),
                "booking_id": str(booking_id),
                "renter_id": str(current_user.id),
            },
            payment_intent_data={
                "metadata": {
                    "payment_id": str(payment.id),
                    "booking_id": str(booking_id),
                }
            },
        )
    except Exception as exc:
        payment.status = "PAYMENT_FAILED"
        db.commit()
        raise HTTPException(status_code=502, detail=f"Stripe checkout creation failed: {exc}")

    payment.provider_ref = session.id
    db.commit()
    db.refresh(payment)

    return PaymentCheckoutOut(
        checkout_url=session.url,
        checkout_session_id=session.id,
        payment=payment,
    )


@router.post("/stripe/webhook")
async def stripe_webhook(
    request: Request,
    db: Session = Depends(get_db),
):
    if not settings.stripe_webhook_secret:
        raise HTTPException(status_code=503, detail="Stripe webhook secret is not configured")
    _set_stripe_key()

    payload = await request.body()
    signature = request.headers.get("stripe-signature")
    if not signature:
        raise HTTPException(status_code=400, detail="Missing stripe-signature header")

    try:
        event = stripe.Webhook.construct_event(
            payload=payload,
            sig_header=signature,
            secret=settings.stripe_webhook_secret,
        )
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Invalid Stripe webhook signature: {exc}")

    event_type = event.get("type")
    obj = event.get("data", {}).get("object", {})

    if event_type == "checkout.session.completed":
        metadata = obj.get("metadata") or {}
        session_id = obj.get("id")
        payment = _find_payment_by_webhook_ids(db, metadata.get("payment_id"), session_id)
        if payment:
            payment.status = "HELD_IN_ESCROW"
            payment.provider = STRIPE_PROVIDER
            payment.provider_ref = session_id or payment.provider_ref
            payment.paid_at = datetime.now(timezone.utc)
            db.commit()

    elif event_type in {"checkout.session.expired", "checkout.session.async_payment_failed", "payment_intent.payment_failed"}:
        metadata = obj.get("metadata") or {}
        payment = _find_payment_by_webhook_ids(db, metadata.get("payment_id"), None)
        if payment and payment.status == "PAYMENT_PENDING":
            payment.status = "PAYMENT_FAILED"
            db.commit()

    elif event_type == "charge.refunded":
        metadata = obj.get("metadata") or {}
        payment = _find_payment_by_webhook_ids(db, metadata.get("payment_id"), None)
        if payment:
            payment.status = "REFUNDED"
            payment.refunded_at = datetime.now(timezone.utc)
            db.commit()

    return {"received": True}


@router.post("/booking/{booking_id}/release", response_model=PaymentOut, dependencies=[Depends(csrf_protect)])
def release_escrow_to_owner(
    booking_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_verified_user),
):
    booking, owner_id = _load_booking_and_owner(db, booking_id)
    payment = db.query(Payment).filter(Payment.booking_id == booking_id).first()
    if not payment:
        raise HTTPException(status_code=404, detail="No payment for this booking")

    if current_user.role != "ADMIN" and current_user.id != owner_id:
        raise HTTPException(status_code=403, detail="Only owner or admin can release escrow")
    if payment.status != "HELD_IN_ESCROW":
        raise HTTPException(status_code=400, detail=f"Cannot release payment in status {payment.status}")
    if booking.status != "APPROVED":
        raise HTTPException(status_code=400, detail="Booking is not in APPROVED status")
    if booking.end_date >= date.today():
        raise HTTPException(status_code=400, detail="Escrow can be released only after booking end date")
    if _has_open_dispute(db, booking_id):
        raise HTTPException(status_code=400, detail="Cannot release while dispute is open")

    owner = db.get(User, owner_id)
    if not owner:
        raise HTTPException(status_code=404, detail="Owner not found")
    if payment.provider == STRIPE_PROVIDER and not owner.stripe_account_onboarded:
        raise HTTPException(status_code=400, detail="Owner payout account is not connected")

    if payment.provider == STRIPE_PROVIDER:
        if not payment.provider_ref:
            raise HTTPException(status_code=400, detail="Stripe checkout session reference missing")
        if not owner.stripe_account_id:
            raise HTTPException(status_code=400, detail="Owner Stripe account is missing")
        _set_stripe_key()
        try:
            session = stripe.checkout.Session.retrieve(payment.provider_ref, expand=["payment_intent.latest_charge"])
            payment_intent = session.get("payment_intent")
            if isinstance(payment_intent, dict):
                latest_charge = payment_intent.get("latest_charge")
                charge_id = latest_charge.get("id") if isinstance(latest_charge, dict) else latest_charge
            else:
                charge_id = None
            if not charge_id:
                raise HTTPException(status_code=400, detail="Stripe source charge not found for payout transfer")

            stripe.Transfer.create(
                amount=int(payment.payout_amount * 100),  # pounds -> pence
                currency=settings.payments_currency.lower(),
                destination=owner.stripe_account_id,
                source_transaction=charge_id,
                metadata={"payment_id": str(payment.id), "booking_id": str(booking_id)},
            )
        except HTTPException:
            raise
        except Exception as exc:
            raise HTTPException(status_code=502, detail=f"Stripe transfer failed: {exc}")

    payment.status = "RELEASED_TO_OWNER"
    payment.released_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(payment)
    return payment


@router.post("/booking/{booking_id}/refund", response_model=PaymentOut, dependencies=[Depends(csrf_protect)])
def refund_payment(
    booking_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_verified_user),
):
    if current_user.role != "ADMIN":
        raise HTTPException(status_code=403, detail="Admin only")

    payment = db.query(Payment).filter(Payment.booking_id == booking_id).first()
    if not payment:
        raise HTTPException(status_code=404, detail="No payment for this booking")
    if payment.status not in {"HELD_IN_ESCROW", "RELEASED_TO_OWNER"}:
        raise HTTPException(status_code=400, detail=f"Cannot refund payment in status {payment.status}")

    if payment.provider == STRIPE_PROVIDER and payment.provider_ref and settings.stripe_secret_key:
        _set_stripe_key()
        try:
            session = stripe.checkout.Session.retrieve(payment.provider_ref, expand=["payment_intent"])
            intent = session.get("payment_intent")
            intent_id = intent.get("id") if isinstance(intent, dict) else intent
            if not intent_id:
                raise HTTPException(status_code=400, detail="Stripe payment intent not found for refund")
            stripe.Refund.create(
                payment_intent=intent_id,
                metadata={"payment_id": str(payment.id), "booking_id": str(booking_id)},
            )
        except HTTPException:
            raise
        except Exception as exc:
            raise HTTPException(status_code=502, detail=f"Stripe refund failed: {exc}")

    payment.status = "REFUNDED"
    payment.refunded_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(payment)
    return payment
