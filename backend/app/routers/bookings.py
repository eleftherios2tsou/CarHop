# backend/app/routers/bookings.py
from datetime import date, datetime, time, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import and_, exists, func, select

from app.deps import get_db, get_current_verified_user, csrf_protect
from app.email import (
    notify_booking_approved,
    notify_booking_cancelled,
    notify_booking_rejected,
    notify_booking_requested,
)
from app.config import settings
from app.models.availability_block import AvailabilityBlock
from app.models.booking import BookingRequest
from app.models.car import CarListing
from app.models.license import DriverLicense
from app.models.payment import Payment
from app.models.review import Review
from app.models.user import User
from app.schemas.booking import BookingOut, BookingCreateIn, PaginatedBookings

router = APIRouter(prefix="/bookings", tags=["bookings"])

TERMINAL_STATUSES = {"REJECTED", "CANCELLED", "COMPLETED"}


def require_verified_license(db: Session, user_id: int):
    lic = db.query(DriverLicense).filter_by(user_id=user_id).first()
    if not lic:
        raise HTTPException(status_code=403, detail="Driver license required")
    if not lic.is_verified:
        raise HTTPException(status_code=403, detail="Driver license not verified")


def validate_dates(start_date: date, end_date: date):
    if end_date < start_date:
        raise HTTPException(status_code=400, detail="end_date must be on/after start_date")


def approved_overlap_exists(
    db: Session,
    car_id: int,
    start_date: date,
    end_date: date,
    exclude_booking_id: int | None = None,
) -> bool:
    """
    Overlap definition (inclusive): existing.start <= end AND existing.end >= start
    Only blocks APPROVED overlaps (PENDING/COMPLETED overlaps do not block).
    """
    q = select(1).where(
        BookingRequest.car_id == car_id,
        BookingRequest.status == "APPROVED",
        and_(
            BookingRequest.start_date <= end_date,
            BookingRequest.end_date >= start_date,
        ),
    )
    if exclude_booking_id is not None:
        q = q.where(BookingRequest.id != exclude_booking_id)

    return db.query(exists(q)).scalar()


def _compute_refund_pct(policy: str, hours: float) -> int:
    """Return the refund percentage (0, 50, or 100) based on policy and hours until trip start."""
    if policy == "FLEXIBLE":
        return 100 if hours >= 24 else 0
    elif policy == "MODERATE":
        if hours >= 5 * 24:
            return 100
        elif hours >= 24:
            return 50
        else:
            return 0
    elif policy == "STRICT":
        if hours >= 7 * 24:
            return 100
        elif hours >= 2 * 24:
            return 50
        else:
            return 0
    return 100


def _owner_qualifies_instant_book(db: Session, owner_id: int) -> bool:
    """Return True if owner has ≥5 CAR_REVIEWs with avg rating ≥4.5."""
    row = db.query(func.count(Review.id), func.avg(Review.rating)).filter(
        Review.owner_id == owner_id,
        Review.review_type == "CAR_REVIEW",
    ).first()
    return int(row[0] or 0) >= 5 and float(row[1] or 0.0) >= 4.5


def _enrich_with_cancellation_policy(db: Session, bookings: list[BookingRequest]) -> None:
    """Attach car_cancellation_policy as a transient attribute on each booking instance."""
    car_ids = [b.car_id for b in bookings]
    if not car_ids:
        return
    rows = db.query(CarListing.id, CarListing.cancellation_policy).filter(
        CarListing.id.in_(car_ids)
    ).all()
    policy_map = {r.id: r.cancellation_policy for r in rows}
    for b in bookings:
        b.car_cancellation_policy = policy_map.get(b.car_id, "FLEXIBLE")


def _auto_complete_past_bookings(db: Session, bookings: list[BookingRequest]) -> list[BookingRequest]:
    """Transition APPROVED bookings whose end_date is in the past to COMPLETED."""
    today = date.today()
    needs_commit = False
    for b in bookings:
        if b.status == "APPROVED" and b.end_date < today:
            b.status = "COMPLETED"
            needs_commit = True
    if needs_commit:
        db.commit()
    return bookings


@router.post("/{car_id}", response_model=BookingOut, dependencies=[Depends(csrf_protect)])
def request_booking(
    car_id: int,
    payload: BookingCreateIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_verified_user),
):
    require_verified_license(db, current_user.id)
    validate_dates(payload.start_date, payload.end_date)

    # Reject if renter's licence expires before the booking start date
    lic = db.query(DriverLicense).filter_by(user_id=current_user.id).first()
    if lic and lic.expiry_date < payload.start_date:
        raise HTTPException(
            status_code=400,
            detail=f"Your driver's licence expires on {lic.expiry_date}, "
                   f"before this booking starts on {payload.start_date}. "
                   f"Please renew your licence before booking.",
        )

    car = db.get(CarListing, car_id)
    if not car:
        raise HTTPException(status_code=404, detail="Car not found")
    if car.status != "AVAILABLE":
        raise HTTPException(status_code=400, detail="Car is not available for booking")

    if car.owner_id == current_user.id:
        raise HTTPException(status_code=400, detail="You cannot book your own car")

    if approved_overlap_exists(db, car_id, payload.start_date, payload.end_date):
        raise HTTPException(status_code=400, detail="Car is already booked for those dates")

    blocked = (
        db.query(AvailabilityBlock)
        .filter(
            AvailabilityBlock.car_id == car_id,
            AvailabilityBlock.start_date <= payload.end_date,
            AvailabilityBlock.end_date >= payload.start_date,
        )
        .first()
    )
    if blocked:
        raise HTTPException(status_code=409, detail="Car is not available for those dates (owner has blocked them)")

    # Instant Book: auto-approve if owner qualifies
    instant_approved = False
    if car.instant_book_enabled:
        if _owner_qualifies_instant_book(db, car.owner_id):
            instant_approved = True
        else:
            # Owner no longer qualifies — silently disable
            car.instant_book_enabled = False

    booking = BookingRequest(
        car_id=car_id,
        renter_id=current_user.id,
        start_date=payload.start_date,
        end_date=payload.end_date,
        status="APPROVED" if instant_approved else "PENDING",
    )
    db.add(booking)
    db.commit()
    db.refresh(booking)

    car_label = f"{car.make} {car.model} ({car.year})"
    owner = db.get(User, car.owner_id)
    trip_days = (booking.end_date - booking.start_date).days + 1
    trip_total = car.daily_price * trip_days

    if instant_approved:
        # Notify renter that booking is instantly confirmed
        notify_booking_approved(
            renter_email=current_user.email,
            renter_name=current_user.full_name,
            car=car_label,
            start=booking.start_date,
            end=booking.end_date,
            days=trip_days,
            total=trip_total,
        )
    elif owner:
        # Notify owner of a new pending request
        notify_booking_requested(
            owner_email=owner.email,
            owner_name=owner.full_name,
            renter_name=current_user.full_name,
            car=car_label,
            start=booking.start_date,
            end=booking.end_date,
            days=trip_days,
            total=trip_total,
        )

    return booking


@router.get("/incoming", response_model=PaginatedBookings)
def incoming_bookings(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_verified_user),
):
    base_q = (
        db.query(BookingRequest)
        .join(CarListing, CarListing.id == BookingRequest.car_id)
        .filter(CarListing.owner_id == current_user.id)
    )
    total = base_q.count()
    bookings = (
        base_q
        .order_by(BookingRequest.id.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    _auto_complete_past_bookings(db, bookings)
    _enrich_with_cancellation_policy(db, bookings)
    return PaginatedBookings.build(bookings, total, page, page_size)


@router.get("/mine", response_model=PaginatedBookings)
def my_bookings(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_verified_user),
):
    base_q = db.query(BookingRequest).filter(BookingRequest.renter_id == current_user.id)
    total = base_q.count()
    bookings = (
        base_q
        .order_by(BookingRequest.id.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    _auto_complete_past_bookings(db, bookings)
    _enrich_with_cancellation_policy(db, bookings)
    return PaginatedBookings.build(bookings, total, page, page_size)


@router.post("/{booking_id}/approve", response_model=BookingOut, dependencies=[Depends(csrf_protect)])
def approve_booking(
    booking_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_verified_user),
):
    booking = db.get(BookingRequest, booking_id)
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    car = db.get(CarListing, booking.car_id)
    if not car or car.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not allowed")

    if booking.status != "PENDING":
        raise HTTPException(status_code=400, detail="Booking not pending")

    if approved_overlap_exists(db, booking.car_id, booking.start_date, booking.end_date, exclude_booking_id=booking.id):
        raise HTTPException(status_code=400, detail="Cannot approve: overlaps an approved booking")

    booking.status = "APPROVED"
    db.commit()
    db.refresh(booking)

    # Notify the renter
    renter = db.get(User, booking.renter_id)
    if renter:
        car_label = f"{car.make} {car.model} ({car.year})"
        trip_days = (booking.end_date - booking.start_date).days + 1
        trip_total = car.daily_price * trip_days
        notify_booking_approved(
            renter_email=renter.email,
            renter_name=renter.full_name,
            car=car_label,
            start=booking.start_date,
            end=booking.end_date,
            days=trip_days,
            total=trip_total,
        )

    return booking


@router.post("/{booking_id}/reject", response_model=BookingOut, dependencies=[Depends(csrf_protect)])
def reject_booking(
    booking_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_verified_user),
):
    booking = db.get(BookingRequest, booking_id)
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    car = db.get(CarListing, booking.car_id)
    if not car or car.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not allowed")

    if booking.status != "PENDING":
        raise HTTPException(status_code=400, detail="Booking not pending")

    booking.status = "REJECTED"
    db.commit()
    db.refresh(booking)

    # Notify the renter
    renter = db.get(User, booking.renter_id)
    if renter:
        car_label = f"{car.make} {car.model} ({car.year})"
        notify_booking_rejected(
            renter_email=renter.email,
            renter_name=renter.full_name,
            car=car_label,
            start=booking.start_date,
            end=booking.end_date,
        )

    return booking


@router.post("/{booking_id}/cancel", response_model=BookingOut, dependencies=[Depends(csrf_protect)])
def cancel_booking(
    booking_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_verified_user),
):
    """
    Renter cancels their own booking.
    Rules:
    - Only the renter can cancel.
    - Can cancel PENDING any time.
    - Can cancel APPROVED only if start_date is still in the future.
    """
    booking = db.get(BookingRequest, booking_id)
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    if booking.renter_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not allowed")

    today = date.today()

    if booking.status == "PENDING":
        booking.status = "CANCELLED"
    elif booking.status == "APPROVED":
        if booking.start_date <= today:
            raise HTTPException(status_code=400, detail="Cannot cancel after the booking has started")
        booking.status = "CANCELLED"
    else:
        raise HTTPException(status_code=400, detail=f"Cannot cancel a booking in status {booking.status}")

    # Apply cancellation policy refund if payment exists
    car = db.get(CarListing, booking.car_id)
    if car:
        start_dt = datetime.combine(booking.start_date, time.min).replace(tzinfo=timezone.utc)
        hours_until_start = (start_dt - datetime.now(timezone.utc)).total_seconds() / 3600
        refund_pct = _compute_refund_pct(car.cancellation_policy, hours_until_start)

        payment = db.query(Payment).filter(Payment.booking_id == booking.id).first()
        if payment and payment.status == "HELD_IN_ESCROW":
            refund_pence = int(payment.amount_total * 100 * refund_pct // 100)

            if getattr(settings, "payment_provider", "SIMULATED") == "stripe" and refund_pence > 0:
                try:
                    import stripe
                    stripe.api_key = settings.stripe_secret_key
                    refund_obj = stripe.Refund.create(
                        payment_intent=payment.stripe_payment_intent_id,
                        amount=refund_pence,
                    )
                    payment.stripe_refund_id = refund_obj.id
                except Exception:
                    pass  # Stripe errors don't block the cancellation

            payment.refund_amount_pence = refund_pence
            payment.cancellation_policy_applied = car.cancellation_policy
            payment.refunded_at = datetime.now(timezone.utc)
            payment.status = "REFUNDED"

    db.commit()
    db.refresh(booking)

    # Notify the car owner
    if car:
        owner = db.get(User, car.owner_id)
        if owner:
            car_label = f"{car.make} {car.model} ({car.year})"
            notify_booking_cancelled(
                owner_email=owner.email,
                owner_name=owner.full_name,
                renter_name=current_user.full_name,
                car=car_label,
                start=booking.start_date,
                end=booking.end_date,
            )

    return booking
