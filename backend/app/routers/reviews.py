from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.deps import csrf_protect, get_current_verified_user, get_db
from app.models.booking import BookingRequest
from app.models.car import CarListing
from app.models.review import Review
from app.models.user import User
from app.schemas.review import ReviewCreateIn, ReviewOut

router = APIRouter(prefix="/reviews", tags=["reviews"])


@router.get("/car/{car_id}", response_model=list[ReviewOut])
def list_car_reviews(
    car_id: int,
    db: Session = Depends(get_db),
):
    return (
        db.query(Review)
        .filter(Review.car_id == car_id)
        .order_by(Review.id.desc())
        .all()
    )


@router.get("/mine", response_model=list[ReviewOut])
def my_reviews(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_verified_user),
):
    return (
        db.query(Review)
        .filter(Review.reviewer_id == current_user.id)
        .order_by(Review.id.desc())
        .all()
    )


@router.post("/{booking_id}", response_model=ReviewOut, dependencies=[Depends(csrf_protect)])
def create_review(
    booking_id: int,
    payload: ReviewCreateIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_verified_user),
):
    booking = db.get(BookingRequest, booking_id)
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    if booking.renter_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not allowed")

    if booking.status not in ("APPROVED", "COMPLETED"):
        raise HTTPException(status_code=400, detail="Only approved or completed bookings can be reviewed")

    if booking.end_date > date.today():
        raise HTTPException(status_code=400, detail="Review is allowed only after booking end date")

    existing = db.query(Review).filter(Review.booking_id == booking_id).first()
    if existing:
        raise HTTPException(status_code=400, detail="Booking already reviewed")

    car = db.get(CarListing, booking.car_id)
    if not car:
        raise HTTPException(status_code=404, detail="Car not found")

    review = Review(
        booking_id=booking.id,
        car_id=booking.car_id,
        reviewer_id=current_user.id,
        owner_id=car.owner_id,
        rating=payload.rating,
        comment=payload.comment,
    )
    db.add(review)
    db.commit()
    db.refresh(review)
    return review
