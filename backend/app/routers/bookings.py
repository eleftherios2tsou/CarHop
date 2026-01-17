from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.deps import get_db, get_current_user
from app.models.booking import BookingRequest
from app.models.car import CarListing
from app.models.user import User
from app.schemas.booking import BookingOut

router = APIRouter(prefix="/bookings", tags=["bookings"])

@router.post("/{car_id}", response_model=BookingOut)
def request_booking(
    car_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    car = db.get(CarListing, car_id)
    if not car or car.status != "AVAILABLE":
        raise HTTPException(status_code=400, detail="Car not available")

    booking = BookingRequest(car_id=car_id, renter_id=current_user.id)
    db.add(booking)
    db.commit()
    db.refresh(booking)
    return booking

@router.get("/incoming", response_model=list[BookingOut])
def incoming_bookings(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return (
        db.query(BookingRequest)
        .join(CarListing)
        .filter(CarListing.owner_id == current_user.id)
        .all()
    )

@router.post("/{booking_id}/approve", response_model=BookingOut)
def approve_booking(
    booking_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    booking = db.get(BookingRequest, booking_id)
    car = db.get(CarListing, booking.car_id)

    if car.owner_id != current_user.id:
        raise HTTPException(status_code=403)

    booking.status = "APPROVED"
    car.status = "UNAVAILABLE"

    db.commit()
    return booking
