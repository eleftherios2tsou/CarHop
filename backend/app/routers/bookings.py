# app/routers/bookings.py
from datetime import date
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import and_

from app.deps import get_db, get_current_verified_user
from app.models.booking import BookingRequest
from app.models.car import CarListing
from app.models.license import DriverLicense
from app.models.user import User
from app.schemas.booking import BookingOut, BookingCreate, CancelIn

router = APIRouter(prefix="/bookings", tags=["bookings"])


def require_verified_license(db: Session, user_id: int):
    lic = db.query(DriverLicense).filter_by(user_id=user_id).first()
    if not lic:
        raise HTTPException(status_code=403, detail="Driver license required")
    if not lic.is_verified:
        raise HTTPException(status_code=403, detail="Driver license not verified")


def validate_date_range(start_date: date, end_date: date):
    if end_date < start_date:
        raise HTTPException(status_code=400, detail="Invalid date range (end_date before start_date)")


def has_approved_overlap(db: Session, car_id: int, start_date: date, end_date: date) -> bool:
    overlap = (
        db.query(BookingRequest)
        .filter(
            BookingRequest.car_id == car_id,
            BookingRequest.status == "APPROVED",
            and_(
                BookingRequest.start_date <= end_date,
                BookingRequest.end_date >= start_date,
            ),
        )
        .first()
    )
    return overlap is not None


@router.post("/{car_id}", response_model=BookingOut)
def request_booking(
    car_id: int,
    payload: BookingCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_verified_user),
):
    require_verified_license(db, current_user.id)
    validate_date_range(payload.start_date, payload.end_date)

    car = db.get(CarListing, car_id)
    if not car:
        raise HTTPException(status_code=404, detail="Car not found")

    if car.owner_id == current_user.id:
        raise HTTPException(status_code=400, detail="You cannot book your own car")

    # Allow overlapping PENDING requests; block only APPROVED overlap.
    if has_approved_overlap(db, car_id, payload.start_date, payload.end_date):
        raise HTTPException(status_code=400, detail="Car already booked for these dates")

    booking = BookingRequest(
        car_id=car_id,
        renter_id=current_user.id,
        start_date=payload.start_date,
        end_date=payload.end_date,
        status="PENDING",
    )
    db.add(booking)
    try:
        db.commit()
    except Exception:
        db.rollback()
        raise HTTPException(status_code=400, detail="Booking already exists")

    db.refresh(booking)
    return booking


@router.get("/incoming", response_model=list[BookingOut])
def incoming_bookings(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_verified_user),
):
    return (
        db.query(BookingRequest)
        .join(CarListing)
        .filter(CarListing.owner_id == current_user.id)
        .order_by(BookingRequest.id.desc())
        .all()
    )


# ✅ NEW: renter bookings
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


@router.post("/{booking_id}/approve", response_model=BookingOut)
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

    if has_approved_overlap(db, booking.car_id, booking.start_date, booking.end_date):
        raise HTTPException(status_code=400, detail="Cannot approve: dates overlap with an approved booking")

    booking.status = "APPROVED"
    db.commit()
    db.refresh(booking)
    return booking


@router.post("/{booking_id}/reject", response_model=BookingOut)
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


# ✅ NEW: cancellation (renter can cancel PENDING; owner can cancel PENDING too)
@router.post("/{booking_id}/cancel", response_model=BookingOut)
def cancel_booking(
    booking_id: int,
    payload: CancelIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_verified_user),
):
    booking = db.get(BookingRequest, booking_id)
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    car = db.get(CarListing, booking.car_id)
    if not car:
        raise HTTPException(status_code=404, detail="Car not found")

    is_renter = booking.renter_id == current_user.id
    is_owner = car.owner_id == current_user.id
    if not (is_renter or is_owner):
        raise HTTPException(status_code=403, detail="Not allowed")

    if booking.status != "PENDING":
        raise HTTPException(status_code=400, detail="Only pending bookings can be cancelled in v2 step")

    booking.status = "CANCELLED"
    db.commit()
    db.refresh(booking)
    return booking
