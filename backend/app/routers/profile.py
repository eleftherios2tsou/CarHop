#backend/app/routers/profile.py
import asyncio
import os
from datetime import date, datetime, timezone
from uuid import uuid4
import stripe
from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.config import settings
from app.database import SessionLocal
from app.deps import get_db, get_current_verified_user, csrf_protect
from app.services import storage
from app.models.user import User
from app.models.license import DriverLicense
from app.schemas.license import LicenseOut, AdminRejectIn
from app.schemas.profile import ProfileOut
from app.services.verification import run_verification_checks

router = APIRouter(prefix="/profile", tags=["profile"])

ALLOWED_IMAGE_PREFIX = "image/"
ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}


def _require_stripe_secret() -> None:
    if not settings.stripe_secret_key:
        raise HTTPException(status_code=503, detail="Stripe is not configured")
    stripe.api_key = settings.stripe_secret_key


def _save_doc_upload(user_id: int, up: UploadFile, label: str) -> tuple[str, str]:
    """Save a document image and return (storage_key, url)."""
    if not up.content_type or not up.content_type.startswith(ALLOWED_IMAGE_PREFIX):
        raise HTTPException(status_code=400, detail=f"{label}: only image files are allowed")

    _, ext = os.path.splitext(up.filename or "")
    ext = ext.lower() if ext.lower() in ALLOWED_EXTENSIONS else ".jpg"

    name = f"{label}_{uuid4().hex}{ext}"
    storage_key = f"licenses/{user_id}/{name}"
    data = up.file.read()
    url = storage.save_file(storage_key, data, up.content_type or "image/jpeg")
    return storage_key, url


async def _run_verification(license_id: int) -> None:
    """
    Real verification pipeline:
      1. Short artificial delay (simulates network round-trip to a 3rd-party API)
      2. Pillow quality checks on both images
      3. Licence orientation check (must be landscape)
      4. OpenCV face detection on the selfie
    Images are read from disk using the paths stored in the DB record.
    """
    await asyncio.sleep(3)
    db: Session = SessionLocal()
    try:
        lic = db.get(DriverLicense, license_id)
        if not lic or lic.verification_status != "processing":
            return

        # Read images from storage (local disk or Azure)
        try:
            photo_bytes = storage.read_file(lic.license_photo_key)
            selfie_bytes = storage.read_file(lic.selfie_key)
        except Exception:
            lic.verification_status = "rejected"
            lic.rejection_reason = "Document files could not be read — please re-submit."
            db.commit()
            return

        passed, reason = run_verification_checks(photo_bytes, selfie_bytes)

        if passed:
            lic.verification_status = "approved"
            lic.is_verified = True
            lic.verified_at = datetime.now(timezone.utc)
        else:
            lic.verification_status = "rejected"
            lic.rejection_reason = reason

        db.commit()
    finally:
        db.close()



@router.get("/me", response_model=ProfileOut)
def me(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_verified_user),
):
    lic = db.query(DriverLicense).filter_by(user_id=current_user.id).first()

    has_license = lic is not None
    license_verified = bool(lic and lic.is_verified)

    profile_complete = (
        current_user.is_active
        and current_user.email_verified
        and bool(current_user.full_name)
        and current_user.date_of_birth is not None
        and has_license
    )

    return {
        "id": current_user.id,
        "email": current_user.email,
        "full_name": current_user.full_name,
        "date_of_birth": current_user.date_of_birth,
        "email_verified": current_user.email_verified,
        "is_active": current_user.is_active,
        "role": current_user.role,
        "has_license": has_license,
        "license_verified": license_verified,
        "license_status": lic.verification_status if lic else None,
        "profile_complete": profile_complete,
        "payout_connected": bool(current_user.stripe_account_onboarded),
        "payout_account_id": current_user.stripe_account_id,
    }




@router.post("/license", response_model=LicenseOut, dependencies=[Depends(csrf_protect)])
async def submit_license(
    background_tasks: BackgroundTasks,
    license_number: str = Form(...),
    issuing_country: str = Form(...),
    expiry_date: date = Form(...),
    license_photo: UploadFile = File(...),
    selfie: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_verified_user),
):
    if expiry_date <= date.today():
        raise HTTPException(status_code=400, detail="License already expired")

    photo_key, photo_url = _save_doc_upload(current_user.id, license_photo, "licence")
    selfie_key, selfie_url_val = _save_doc_upload(current_user.id, selfie, "selfie")

    lic = db.query(DriverLicense).filter_by(user_id=current_user.id).first()

    if lic:
        lic.license_number = license_number
        lic.issuing_country = issuing_country
        lic.expiry_date = expiry_date
        lic.license_photo_key = photo_key
        lic.license_photo_url = photo_url
        lic.selfie_key = selfie_key
        lic.selfie_url = selfie_url_val
        lic.verification_status = "processing"
        lic.is_verified = False
        lic.submitted_at = datetime.now(timezone.utc)
        lic.verified_at = None
        lic.rejection_reason = None
    else:
        lic = DriverLicense(
            user_id=current_user.id,
            license_number=license_number,
            issuing_country=issuing_country,
            expiry_date=expiry_date,
            license_photo_key=photo_key,
            license_photo_url=photo_url,
            selfie_key=selfie_key,
            selfie_url=selfie_url_val,
            verification_status="processing",
            is_verified=False,
            submitted_at=datetime.now(timezone.utc),
        )
        db.add(lic)

    db.commit()
    db.refresh(lic)

    background_tasks.add_task(_run_verification, lic.id)
    return lic




@router.post("/license/{user_id}/verify", response_model=LicenseOut, dependencies=[Depends(csrf_protect)])
def admin_verify_license(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_verified_user),
):
    if current_user.role != "ADMIN":
        raise HTTPException(status_code=403, detail="Admin only")

    lic = db.query(DriverLicense).filter_by(user_id=user_id).first()
    if not lic:
        raise HTTPException(status_code=404, detail="License not found")

    lic.verification_status = "approved"
    lic.is_verified = True
    lic.verified_at = datetime.now(timezone.utc)
    lic.rejection_reason = None
    db.commit()
    db.refresh(lic)
    return lic




@router.post("/license/{user_id}/reject", response_model=LicenseOut, dependencies=[Depends(csrf_protect)])
def admin_reject_license(
    user_id: int,
    payload: AdminRejectIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_verified_user),
):
    if current_user.role != "ADMIN":
        raise HTTPException(status_code=403, detail="Admin only")

    lic = db.query(DriverLicense).filter_by(user_id=user_id).first()
    if not lic:
        raise HTTPException(status_code=404, detail="License not found")

    lic.verification_status = "rejected"
    lic.is_verified = False
    lic.rejection_reason = payload.reason or "Rejected by administrator"
    db.commit()
    db.refresh(lic)
    return lic


@router.post("/payout/onboard", dependencies=[Depends(csrf_protect)])
def start_payout_onboarding(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_verified_user),
):
    _require_stripe_secret()

    user = db.get(User, current_user.id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if not user.stripe_account_id:
        try:
            account = stripe.Account.create(
                type="express",
                email=user.email,
                business_type="individual",
                metadata={"user_id": str(user.id)},
            )
        except Exception as exc:
            raise HTTPException(status_code=502, detail=f"Stripe account creation failed: {exc}")
        user.stripe_account_id = account.id
        user.stripe_account_onboarded = False
        db.commit()

    try:
        link = stripe.AccountLink.create(
            account=user.stripe_account_id,
            refresh_url=f"{settings.frontend_base_url}/?connect=refresh",
            return_url=f"{settings.frontend_base_url}/?connect=return",
            type="account_onboarding",
        )
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Stripe onboarding link failed: {exc}")

    return {"url": link.url, "account_id": user.stripe_account_id}




@router.post("/payout/refresh", dependencies=[Depends(csrf_protect)])
def refresh_payout_status(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_verified_user),
):
    user = db.get(User, current_user.id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if not user.stripe_account_id:
        user.stripe_account_onboarded = False
        db.commit()
        return {
            "payout_connected": False,
            "payout_account_id": None,
        }

    _require_stripe_secret()

    try:
        account = stripe.Account.retrieve(user.stripe_account_id)
        connected = bool(
            account.get("details_submitted")
            and account.get("charges_enabled")
            and account.get("payouts_enabled")
        )
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Stripe account check failed: {exc}")

    user.stripe_account_onboarded = connected
    db.commit()

    return {
        "payout_connected": connected,
        "payout_account_id": user.stripe_account_id,
    }
