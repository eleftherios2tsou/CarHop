from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.deps import get_db, get_current_user
from app.models.ride import Ride
from app.models.request import RideRequest
from app.models.user import User
from app.schemas.request import RequestOut

router = APIRouter(prefix="/requests", tags=["requests"])

@router.get("/me", response_model=list[RequestOut])
def my_requests(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return (
        db.query(RideRequest)
        .filter(RideRequest.passenger_id == current_user.id)
        .order_by(RideRequest.id.desc())
        .all()
    )

@router.post("/{request_id}/accept", response_model=RequestOut)
def accept_request(
    request_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    req = db.get(RideRequest, request_id)
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")

    ride = db.get(Ride, req.ride_id)
    if not ride or ride.driver_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not allowed")

    if req.status != "PENDING":
        raise HTTPException(status_code=400, detail="Request not pending")

    if ride.status != "OPEN" or ride.seats_available <= 0:
        raise HTTPException(status_code=400, detail="Ride is full")

    req.status = "ACCEPTED"
    ride.seats_available -= 1
    if ride.seats_available == 0:
        ride.status = "FULL"

    db.commit()
    db.refresh(req)
    return req

@router.post("/{request_id}/reject", response_model=RequestOut)
def reject_request(
    request_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    req = db.get(RideRequest, request_id)
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")

    ride = db.get(Ride, req.ride_id)
    if not ride or ride.driver_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not allowed")

    if req.status != "PENDING":
        raise HTTPException(status_code=400, detail="Request not pending")

    req.status = "REJECTED"
    db.commit()
    db.refresh(req)
    return req
@router.get("/incoming", response_model=list[RequestOut])
def incoming_requests(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return (
        db.query(RideRequest)
        .join(Ride, Ride.id == RideRequest.ride_id)
        .filter(Ride.driver_id == current_user.id)
        .order_by(RideRequest.id.desc())
        .all()
    )

