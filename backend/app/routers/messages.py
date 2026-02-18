from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.deps import csrf_protect, get_current_verified_user, get_db
from app.models.booking import BookingRequest
from app.models.car import CarListing
from app.models.message import Message
from app.models.user import User
from app.schemas.message import MessageCreateIn, MessageOut

router = APIRouter(prefix="/messages", tags=["messages"])


def _resolve_participants(db: Session, booking_id: int) -> tuple[BookingRequest, int]:
    booking = db.get(BookingRequest, booking_id)
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    car = db.get(CarListing, booking.car_id)
    if not car:
        raise HTTPException(status_code=404, detail="Car not found")
    return booking, car.owner_id


def _ensure_participant(user_id: int, renter_id: int, owner_id: int) -> None:
    if user_id not in (renter_id, owner_id):
        raise HTTPException(status_code=403, detail="Not allowed")


@router.get("/booking/{booking_id}", response_model=list[MessageOut])
def list_booking_messages(
    booking_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_verified_user),
):
    booking, owner_id = _resolve_participants(db, booking_id)
    _ensure_participant(current_user.id, booking.renter_id, owner_id)
    return (
        db.query(Message)
        .filter(Message.booking_id == booking_id)
        .order_by(Message.id.asc())
        .all()
    )


@router.post("/booking/{booking_id}", response_model=MessageOut, dependencies=[Depends(csrf_protect)])
def create_booking_message(
    booking_id: int,
    payload: MessageCreateIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_verified_user),
):
    booking, owner_id = _resolve_participants(db, booking_id)
    _ensure_participant(current_user.id, booking.renter_id, owner_id)

    recipient_id = owner_id if current_user.id == booking.renter_id else booking.renter_id
    body = payload.content.strip()
    if not body:
        raise HTTPException(status_code=400, detail="Message cannot be empty")

    msg = Message(
        booking_id=booking_id,
        sender_id=current_user.id,
        recipient_id=recipient_id,
        content=body,
    )
    db.add(msg)
    db.commit()
    db.refresh(msg)
    return msg
