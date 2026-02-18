from __future__ import annotations

from datetime import date, datetime, timezone
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.deps import csrf_protect, get_current_verified_user, get_db
from app.models.booking import BookingRequest
from app.models.car import CarListing
from app.models.dispute import Dispute
from app.models.payment import Payment
from app.models.user import User
from app.schemas.payment import PaymentOut

router = APIRouter(prefix="/payments", tags=["payments"])

PLATFORM_FEE_BPS = 1000  # 10%


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
        .filter((Payment.renter_id == current_user.id) | (Payment.owner_id == current_user.id))
        .order_by(Payment.id.desc())
        .all()
    )


@router.post("/booking/{booking_id}/pay", response_model=PaymentOut, dependencies=[Depends(csrf_protect)])
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

    total = car.daily_price * _booking_days(booking.start_date, booking.end_date)
    fee = max(1, (total * PLATFORM_FEE_BPS) // 10000)
    payout = total - fee

    now = datetime.now(timezone.utc)
    provider_ref = f"sim_{uuid4().hex[:12]}"

    if existing:
        existing.renter_id = booking.renter_id
        existing.owner_id = owner_id
        existing.currency = "GBP"
        existing.amount_total = total
        existing.platform_fee = fee
        existing.payout_amount = payout
        existing.status = "HELD_IN_ESCROW"
        existing.provider = "SIMULATED"
        existing.provider_ref = provider_ref
        existing.paid_at = now
        existing.released_at = None
        existing.refunded_at = None
        payment = existing
    else:
        payment = Payment(
            booking_id=booking_id,
            renter_id=booking.renter_id,
            owner_id=owner_id,
            currency="GBP",
            amount_total=total,
            platform_fee=fee,
            payout_amount=payout,
            status="HELD_IN_ESCROW",
            provider="SIMULATED",
            provider_ref=provider_ref,
            paid_at=now,
        )
        db.add(payment)

    db.commit()
    db.refresh(payment)
    return payment


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

    payment.status = "REFUNDED"
    payment.refunded_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(payment)
    return payment
