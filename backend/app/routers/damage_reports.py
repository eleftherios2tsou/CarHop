# backend/app/routers/damage_reports.py
# handles damage reports that car owners can file after a completed booking
# the owner uploads photos and a description, and an admin reviews and resolves it
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

# validation constants for photo uploads
ALLOWED_IMAGE_PREFIX = "image/"
ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}
MAX_PHOTOS = 5  # cap at 5 photos per report to keep storage usage reasonable


def _load_booking_and_car(db: Session, booking_id: int) -> tuple[BookingRequest, CarListing]:
    # helper to load both booking and car together — most endpoints need both
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

    # only the car owner can file a damage report — renters can't file against themselves
    if current_user.id != car.owner_id:
        raise HTTPException(status_code=403, detail="Only the car owner can file a damage report")
    # damage reports only make sense after the trip is done
    if booking.status != "COMPLETED":
        raise HTTPException(status_code=400, detail="Damage reports can only be filed for completed bookings")

    # one report per booking — if they already filed one, they can't submit another
    existing = db.query(DamageReport).filter(DamageReport.booking_id == booking_id).first()
    if existing:
        raise HTTPException(status_code=400, detail="A damage report already exists for this booking")

    description = description.strip()
    if len(description) < 10:
        raise HTTPException(status_code=400, detail="Description must be at least 10 characters")

    # save photos to storage (local disk or Azure depending on STORAGE_BACKEND setting)
    # we slice to MAX_PHOTOS so even if more files are sent we only process the first 5
    photo_keys: list[str] = []
    for up in photos[:MAX_PHOTOS]:
        if not up.content_type or not up.content_type.startswith(ALLOWED_IMAGE_PREFIX):
            raise HTTPException(status_code=400, detail="Only image files are allowed as photos")
        _, ext = os.path.splitext(up.filename or "")
        # use a known extension or fall back to .jpg if the original extension isn't allowed
        ext = ext.lower() if ext.lower() in ALLOWED_EXTENSIONS else ".jpg"
        key = f"damages/{booking_id}/{uuid4().hex}{ext}"  # unique key per photo
        data = await up.read()
        storage.save_file(key, data, up.content_type or "image/jpeg")
        photo_keys.append(key)

    # convert the estimated cost from pounds to pence for integer storage
    estimated_cost_pence: int | None = None
    if estimated_cost is not None and estimated_cost > 0:
        estimated_cost_pence = int(round(estimated_cost * 100))

    report = DamageReport(
        booking_id=booking_id,
        reporter_id=current_user.id,
        description=description,
        estimated_cost_pence=estimated_cost_pence,
        photo_keys=json.dumps(photo_keys) if photo_keys else None,  # store keys as JSON string
        status="OPEN",
    )
    db.add(report)
    db.commit()
    db.refresh(report)

    # notify the renter that a damage report has been filed against them
    # we wrap this in try/except so an email failure never blocks the API response
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
            pass  # never block the response for email failures

    return report


@router.get("/booking/{booking_id}", response_model=DamageReportOut)
def get_booking_damage_report(
    booking_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_verified_user),
):
    booking, car = _load_booking_and_car(db, booking_id)

    # admins can see any report; regular users can only see reports for their own bookings
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
    # listing all damage reports is admin-only — users view theirs through the booking endpoint above
    if current_user.role != "ADMIN":
        raise HTTPException(status_code=403, detail="Admin only")

    q = db.query(DamageReport)
    if status:
        q = q.filter(DamageReport.status == status.upper())  # allow lowercase input for convenience
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
    # can only resolve OPEN or UNDER_REVIEW reports — RESOLVED/DISMISSED are terminal
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

    # apply the deposit decision — either give the deposit back to the renter or keep it for the owner
    payment = db.query(Payment).filter(Payment.booking_id == report.booking_id).first()
    if payment:
        if payload.deposit_decision == "release_to_renter":
            payment.deposit_status = "RELEASED"
        else:
            payment.deposit_status = "FORFEITED"  # owner gets to keep the deposit
        payment.deposit_released_at = now

    db.commit()
    db.refresh(report)
    return report
