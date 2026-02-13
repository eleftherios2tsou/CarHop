#backend/app/routers/cars.py

from datetime import date
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import and_, exists, select

from app.deps import get_db, get_current_user
from app.models.car import CarListing
from app.models.booking import BookingRequest
from app.models.user import User
from app.schemas.car import CarCreate, CarOut

router = APIRouter(prefix="/cars", tags=["cars"])


def validate_range(from_date: date | None, to_date: date | None):
    if (from_date is None) ^ (to_date is None):
        raise HTTPException(status_code=400, detail="Provide both 'from' and 'to' date query params")
    if from_date and to_date and to_date < from_date:
        raise HTTPException(status_code=400, detail="'to' must be on/after 'from'")


@router.get("/", response_model=list[CarOut])
def list_cars(
    db: Session = Depends(get_db),
    from_date: date | None = Query(default=None, alias="from"),
    to_date: date | None = Query(default=None, alias="to"),
):
    """
    Availability-aware marketplace search.
    - If no dates: return all cars.
    - If from/to provided: return cars with NO APPROVED overlap in the date range.
    Overlap definition: approved.start <= to_date AND approved.end >= from_date
    """
    validate_range(from_date, to_date)

    q = db.query(CarListing)

    if from_date and to_date:
        overlap_exists = (
            exists(
                select(1).where(
                    BookingRequest.car_id == CarListing.id,
                    BookingRequest.status == "APPROVED",
                    and_(
                        BookingRequest.start_date <= to_date,
                        BookingRequest.end_date >= from_date,
                    ),
                )
            )
        )
        q = q.filter(~overlap_exists)

    return q.order_by(CarListing.id.desc()).all()


@router.post("/", response_model=CarOut)
def create_car(
    payload: CarCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    car = CarListing(owner_id=current_user.id, **payload.dict())
    db.add(car)
    db.commit()
    db.refresh(car)
    return car
