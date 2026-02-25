from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.deps import csrf_protect, get_current_verified_user, get_db
from app.email import notify_review_received
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
        .filter(Review.car_id == car_id, Review.review_type == "CAR_REVIEW")
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


@router.get("/user/{user_id}", response_model=list[ReviewOut])
def list_renter_reviews(
    user_id: int,
    db: Session = Depends(get_db),
):
    """Public endpoint: returns all RENTER_REVIEW entries where the given user was reviewed."""
    return (
        db.query(Review)
        .filter(Review.review_type == "RENTER_REVIEW", Review.target_user_id == user_id)
        .order_by(Review.id.desc())
        .all()
    )


@router.post("/{booking_id}/car", response_model=ReviewOut, dependencies=[Depends(csrf_protect)])
def create_car_review(
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

    existing = db.query(Review).filter(
        Review.booking_id == booking_id, Review.review_type == "CAR_REVIEW"
    ).first()
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
        review_type="CAR_REVIEW",
        rating=payload.rating,
        comment=payload.comment,
    )
    db.add(review)
    db.commit()
    db.refresh(review)

    # Notify the owner they received a car review
    owner = db.get(User, car.owner_id)
    if owner:
        try:
            car_label = f"{car.year} {car.make} {car.model}"
            notify_review_received(
                recipient_email=owner.email,
                recipient_name=owner.full_name,
                reviewer_name=current_user.full_name,
                rating=payload.rating,
                context=f"your car ({car_label})",
            )
        except Exception:
            pass

    return review


@router.post("/{booking_id}/renter", response_model=ReviewOut, dependencies=[Depends(csrf_protect)])
def create_renter_review(
    booking_id: int,
    payload: ReviewCreateIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_verified_user),
):
    booking = db.get(BookingRequest, booking_id)
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    car = db.get(CarListing, booking.car_id)
    if not car:
        raise HTTPException(status_code=404, detail="Car not found")

    if car.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only the car owner can review the renter")

    if booking.status not in ("APPROVED", "COMPLETED"):
        raise HTTPException(status_code=400, detail="Only approved or completed bookings can be reviewed")

    if booking.end_date > date.today():
        raise HTTPException(status_code=400, detail="Review is allowed only after booking end date")

    existing = db.query(Review).filter(
        Review.booking_id == booking_id, Review.review_type == "RENTER_REVIEW"
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Renter already reviewed for this booking")

    review = Review(
        booking_id=booking.id,
        car_id=booking.car_id,
        reviewer_id=current_user.id,
        owner_id=current_user.id,
        review_type="RENTER_REVIEW",
        target_user_id=booking.renter_id,
        rating=payload.rating,
        comment=payload.comment,
    )
    db.add(review)
    db.commit()
    db.refresh(review)

    # Notify the renter they received a review
    renter = db.get(User, booking.renter_id)
    if renter:
        try:
            notify_review_received(
                recipient_email=renter.email,
                recipient_name=renter.full_name,
                reviewer_name=current_user.full_name,
                rating=payload.rating,
                context="your renter profile",
            )
        except Exception:
            pass

    return review
