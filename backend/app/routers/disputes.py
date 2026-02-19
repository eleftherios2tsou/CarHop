from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.deps import csrf_protect, get_current_verified_user, get_db
from app.email import notify_dispute_opened, notify_dispute_resolved
from app.models.booking import BookingRequest
from app.models.car import CarListing
from app.models.dispute import Dispute
from app.models.user import User
from app.schemas.dispute import DisputeCreateIn, DisputeOut, DisputeResolveIn

router = APIRouter(prefix="/disputes", tags=["disputes"])


def _booking_with_owner(db: Session, booking_id: int) -> tuple[BookingRequest, int]:
    booking = db.get(BookingRequest, booking_id)
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    car = db.get(CarListing, booking.car_id)
    if not car:
        raise HTTPException(status_code=404, detail="Car not found")
    return booking, car.owner_id


@router.get("/booking/{booking_id}", response_model=DisputeOut)
def get_booking_dispute(
    booking_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_verified_user),
):
    booking, owner_id = _booking_with_owner(db, booking_id)
    if current_user.role != "ADMIN" and current_user.id not in (booking.renter_id, owner_id):
        raise HTTPException(status_code=403, detail="Not allowed")

    dispute = db.query(Dispute).filter(Dispute.booking_id == booking_id).first()
    if not dispute:
        raise HTTPException(status_code=404, detail="No dispute for this booking")
    return dispute


@router.get("/open", response_model=list[DisputeOut])
def list_open_disputes(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_verified_user),
):
    if current_user.role != "ADMIN":
        raise HTTPException(status_code=403, detail="Admin only")
    return (
        db.query(Dispute)
        .filter(Dispute.status == "OPEN")
        .order_by(Dispute.id.desc())
        .all()
    )


@router.post("/booking/{booking_id}", response_model=DisputeOut, dependencies=[Depends(csrf_protect)])
def open_booking_dispute(
    booking_id: int,
    payload: DisputeCreateIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_verified_user),
):
    booking, owner_id = _booking_with_owner(db, booking_id)
    if current_user.id not in (booking.renter_id, owner_id):
        raise HTTPException(status_code=403, detail="Not allowed")

    if booking.status == "PENDING":
        raise HTTPException(status_code=400, detail="Cannot open dispute for pending booking")

    existing = db.query(Dispute).filter(Dispute.booking_id == booking_id).first()
    if existing:
        raise HTTPException(status_code=400, detail="Dispute already exists for this booking")

    against_user_id = owner_id if current_user.id == booking.renter_id else booking.renter_id
    details = payload.details.strip() if payload.details else None
    dispute = Dispute(
        booking_id=booking_id,
        opened_by_user_id=current_user.id,
        against_user_id=against_user_id,
        reason=payload.reason.strip(),
        details=details,
        status="OPEN",
    )
    db.add(dispute)
    db.commit()
    db.refresh(dispute)

    # Notify the other party
    car = db.get(CarListing, booking.car_id)
    car_label = f"{car.make} {car.model} ({car.year})" if car else f"booking #{booking_id}"
    other_user = db.get(User, against_user_id)
    if other_user:
        notify_dispute_opened(
            recipient_email=other_user.email,
            recipient_name=other_user.full_name,
            opener_name=current_user.full_name,
            car=car_label,
            booking_id=booking_id,
        )

    return dispute


@router.post("/{dispute_id}/resolve", response_model=DisputeOut, dependencies=[Depends(csrf_protect)])
def resolve_dispute(
    dispute_id: int,
    payload: DisputeResolveIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_verified_user),
):
    if current_user.role != "ADMIN":
        raise HTTPException(status_code=403, detail="Admin only")

    dispute = db.get(Dispute, dispute_id)
    if not dispute:
        raise HTTPException(status_code=404, detail="Dispute not found")
    if dispute.status != "OPEN":
        raise HTTPException(status_code=400, detail="Dispute already closed")

    dispute.status = payload.status
    dispute.resolution_note = payload.resolution_note.strip() if payload.resolution_note else None
    dispute.resolved_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(dispute)

    # Notify both parties
    booking = db.get(BookingRequest, dispute.booking_id)
    if booking:
        car = db.get(CarListing, booking.car_id)
        car_label = f"{car.make} {car.model} ({car.year})" if car else f"booking #{dispute.booking_id}"
        owner_id = car.owner_id if car else None
        for user_id in {booking.renter_id, owner_id} - {None}:
            user = db.get(User, user_id)
            if user:
                notify_dispute_resolved(
                    recipient_email=user.email,
                    recipient_name=user.full_name,
                    resolution=payload.status,
                    note=dispute.resolution_note,
                    car=car_label,
                    booking_id=dispute.booking_id,
                )

    return dispute
