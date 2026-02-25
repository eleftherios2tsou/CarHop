import json
import os
from datetime import datetime, timezone
from uuid import uuid4

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.deps import csrf_protect, get_current_verified_user, get_db
from app.email import notify_damage_report_filed
from app.models.booking import BookingRequest
from app.models.car import CarListing
from app.models.damage_report import DamageReport
from app.models.payment import Payment
from app.models.user import User
from app.schemas.damage_report import DamageReportOut, DamageReportResolveIn
from app.services import storage

router = APIRouter(prefix="/damage-reports", tags=["damage-reports"])

ALLOWED_IMAGE_PREFIX = "image/"
ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}
MAX_PHOTOS = 5


def _load_booking_and_car(db: Session, booking_id: int) -> tuple[BookingRequest, CarListing]:
    booking = db.get(BookingRequest, booking_id)
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    car = db.get(CarListing, booking.car_id)
    if not car:
        raise HTTPException(status_code=404, detail="Car not found")
    return booking, car


@router.post(
    "/booking/{booking_id}",
    response_model=DamageReportOut,
    dependencies=[Depends(csrf_protect)],
)
async def file_damage_report(
    booking_id: int,
    description: str = Form(...),
    estimated_cost: float | None = Form(None),
    photos: list[UploadFile] = File(default=[]),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_verified_user),
):
    booking, car = _load_booking_and_car(db, booking_id)

    if current_user.id != car.owner_id:
        raise HTTPException(status_code=403, detail="Only the car owner can file a damage report")
    if booking.status != "COMPLETED":
        raise HTTPException(status_code=400, detail="Damage reports can only be filed for completed bookings")

    existing = db.query(DamageReport).filter(DamageReport.booking_id == booking_id).first()
    if existing:
        raise HTTPException(status_code=400, detail="A damage report already exists for this booking")

    description = description.strip()
    if len(description) < 10:
        raise HTTPException(status_code=400, detail="Description must be at least 10 characters")

    # Save photos (up to MAX_PHOTOS)
    photo_keys: list[str] = []
    for up in photos[:MAX_PHOTOS]:
        if not up.content_type or not up.content_type.startswith(ALLOWED_IMAGE_PREFIX):
            raise HTTPException(status_code=400, detail="Only image files are allowed as photos")
        _, ext = os.path.splitext(up.filename or "")
        ext = ext.lower() if ext.lower() in ALLOWED_EXTENSIONS else ".jpg"
        key = f"damages/{booking_id}/{uuid4().hex}{ext}"
        data = await up.read()
        storage.save_file(key, data, up.content_type or "image/jpeg")
        photo_keys.append(key)

    estimated_cost_pence: int | None = None
    if estimated_cost is not None and estimated_cost > 0:
        estimated_cost_pence = int(round(estimated_cost * 100))

    report = DamageReport(
        booking_id=booking_id,
        reporter_id=current_user.id,
        description=description,
        estimated_cost_pence=estimated_cost_pence,
        photo_keys=json.dumps(photo_keys) if photo_keys else None,
        status="OPEN",
    )
    db.add(report)
    db.commit()
    db.refresh(report)

    # Notify the renter
    renter = db.get(User, booking.renter_id)
    if renter:
        try:
            car_label = f"{car.year} {car.make} {car.model}"
            notify_damage_report_filed(
                renter_email=renter.email,
                renter_name=renter.full_name,
                owner_name=current_user.full_name,
                car=car_label,
                booking_id=booking_id,
            )
        except Exception:
            pass  # Never block the response for email failures

    return report


@router.get("/booking/{booking_id}", response_model=DamageReportOut)
def get_booking_damage_report(
    booking_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_verified_user),
):
    booking, car = _load_booking_and_car(db, booking_id)

    if current_user.role != "ADMIN" and current_user.id not in (booking.renter_id, car.owner_id):
        raise HTTPException(status_code=403, detail="Not allowed")

    report = db.query(DamageReport).filter(DamageReport.booking_id == booking_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="No damage report for this booking")
    return report


@router.get("/", response_model=list[DamageReportOut])
def list_damage_reports(
    status: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_verified_user),
):
    if current_user.role != "ADMIN":
        raise HTTPException(status_code=403, detail="Admin only")

    q = db.query(DamageReport)
    if status:
        q = q.filter(DamageReport.status == status.upper())
    return q.order_by(DamageReport.id.desc()).all()


@router.post(
    "/{report_id}/resolve",
    response_model=DamageReportOut,
    dependencies=[Depends(csrf_protect)],
)
def resolve_damage_report(
    report_id: int,
    payload: DamageReportResolveIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_verified_user),
):
    if current_user.role != "ADMIN":
        raise HTTPException(status_code=403, detail="Admin only")

    report = db.get(DamageReport, report_id)
    if not report:
        raise HTTPException(status_code=404, detail="Damage report not found")
    if report.status not in ("OPEN", "UNDER_REVIEW"):
        raise HTTPException(status_code=400, detail="Damage report already resolved")

    if payload.status not in ("RESOLVED", "DISMISSED"):
        raise HTTPException(status_code=400, detail="status must be RESOLVED or DISMISSED")
    if payload.deposit_decision not in ("release_to_renter", "forfeit_to_owner"):
        raise HTTPException(status_code=400, detail="deposit_decision must be release_to_renter or forfeit_to_owner")

    now = datetime.now(timezone.utc)
    report.status = payload.status
    report.admin_note = payload.admin_note.strip() if payload.admin_note else None
    report.resolved_at = now

    # Apply deposit decision
    payment = db.query(Payment).filter(Payment.booking_id == report.booking_id).first()
    if payment:
        if payload.deposit_decision == "release_to_renter":
            payment.deposit_status = "RELEASED"
        else:
            payment.deposit_status = "FORFEITED"
        payment.deposit_released_at = now

    db.commit()
    db.refresh(report)
    return report
