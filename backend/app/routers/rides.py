from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.deps import get_db, get_current_user
from app.models.ride import Ride
from app.models.user import User
from app.schemas.ride import RideCreate, RideOut
from app.models.request import RideRequest
from app.schemas.request import RequestOut
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

@router.post("/{ride_id}/requests", response_model=RequestOut)
def create_request(
    ride_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ride = db.get(Ride, ride_id)
    if not ride:
        raise HTTPException(status_code=404, detail="Ride not found")

    if ride.driver_id == current_user.id:
        raise HTTPException(status_code=400, detail="Driver cannot request own ride")

    if ride.status != "OPEN" or ride.seats_available <= 0:
        raise HTTPException(status_code=400, detail="Ride is full")

    req = RideRequest(ride_id=ride_id, passenger_id=current_user.id)
    db.add(req)
    try:
        db.commit()
    except Exception:
        db.rollback()
        raise HTTPException(status_code=400, detail="Request already exists")

    db.refresh(req)
    return req
