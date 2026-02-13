# backend/app/routers/bookings.py
from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import and_, exists, select

from app.deps import get_db, get_current_verified_user, csrf_protect
from app.models.booking import BookingRequest
from app.models.car import CarListing
from app.models.license import DriverLicense
from app.models.user import User
from app.schemas.booking import BookingOut, BookingCreateIn

router = APIRouter(prefix="/bookings", tags=["bookings"])


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
    Only blocks APPROVED overlaps (PENDING overlaps allowed by design).
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


@router.post("/{car_id}", response_model=BookingOut, dependencies=[Depends(csrf_protect)])
def request_booking(
    car_id: int,
    payload: BookingCreateIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_verified_user),
):
    require_verified_license(db, current_user.id)
    validate_dates(payload.start_date, payload.end_date)

    car = db.get(CarListing, car_id)
    if not car:
        raise HTTPException(status_code=404, detail="Car not found")

    if car.owner_id == current_user.id:
        raise HTTPException(status_code=400, detail="You cannot book your own car")

    if approved_overlap_exists(db, car_id, payload.start_date, payload.end_date):
        raise HTTPException(status_code=400, detail="Car is already booked for those dates")

    booking = BookingRequest(
        car_id=car_id,
        renter_id=current_user.id,
        start_date=payload.start_date,
        end_date=payload.end_date,
        status="PENDING",
    )
    db.add(booking)
    db.commit()
    db.refresh(booking)
    return booking


@router.get("/incoming", response_model=list[BookingOut])
def incoming_bookings(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_verified_user),
):
    return (
        db.query(BookingRequest)
        .join(CarListing, CarListing.id == BookingRequest.car_id)
        .filter(CarListing.owner_id == current_user.id)
        .order_by(BookingRequest.id.desc())
        .all()
    )


@router.get("/mine", response_model=list[BookingOut])
def my_bookings(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_verified_user),
):
    return (
        db.query(BookingRequest)
        .filter(BookingRequest.renter_id == current_user.id)
        .order_by(BookingRequest.id.desc())
        .all()
    )


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

    db.commit()
    db.refresh(booking)
    return booking
