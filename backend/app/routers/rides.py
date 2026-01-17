from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.deps import get_db, get_current_user
from app.models.ride import Ride
from app.models.user import User
from app.schemas.ride import RideCreate, RideOut

router = APIRouter(prefix="/rides", tags=["rides"])

@router.post("", response_model=RideOut)
def create_ride(
    payload: RideCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ride = Ride(
        driver_id=current_user.id,
        origin=payload.origin,
        destination=payload.destination,
        seats_available=payload.seats_available,
    )
    db.add(ride)
    db.commit()
    db.refresh(ride)
    return ride

@router.get("", response_model=list[RideOut])
def list_rides(
    origin: str | None = None,
    destination: str | None = None,
    db: Session = Depends(get_db),
):
    q = db.query(Ride)

    if origin:
        q = q.filter(Ride.origin.ilike(f"%{origin}%"))
    if destination:
        q = q.filter(Ride.destination.ilike(f"%{destination}%"))

    return q.order_by(Ride.id.desc()).all()
