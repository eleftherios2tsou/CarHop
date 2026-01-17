from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.deps import get_db, get_current_verified_user
from app.models.booking import BookingRequest
from app.models.car import CarListing
from app.models.license import DriverLicense
from app.models.user import User
from app.schemas.booking import BookingOut

router = APIRouter(prefix="/bookings", tags=["bookings"])


def require_verified_license(db: Session, user_id: int):
    lic = db.query(DriverLicense).filter_by(user_id=user_id).first()
    if not lic:
        raise HTTPException(status_code=403, detail="Driver license required")
    if not lic.is_verified:
        raise HTTPException(status_code=403, detail="Driver license not verified")


@router.post("/{car_id}", response_model=BookingOut)
def request_booking(
    car_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_verified_user),
):
    require_verified_license(db, current_user.id)

    car = db.get(CarListing, car_id)
    if not car or car.status != "AVAILABLE":
        raise HTTPException(status_code=400, detail="Car not available")

    if car.owner_id == current_user.id:
        raise HTTPException(status_code=400, detail="You cannot book your own car")

    booking = BookingRequest(car_id=car_id, renter_id=current_user.id)
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

    booking.status = "APPROVED"
    car.status = "UNAVAILABLE"

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
