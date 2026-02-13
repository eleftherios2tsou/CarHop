from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.deps import get_current_verified_user, get_db
from app.models.license import DriverLicense
from app.models.user import User
from app.schemas.license import LicenseIn, LicenseOut
from app.schemas.profile import ProfileOut

router = APIRouter(prefix="/profile", tags=["profile"])


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
        "has_license": has_license,
        "license_verified": license_verified,
        "profile_complete": profile_complete,
        "role": getattr(current_user, "role", "USER"),
    }


@router.post("/license", response_model=LicenseOut)
def submit_license(
    payload: LicenseIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_verified_user),
):
    if payload.expiry_date <= date.today():
        raise HTTPException(status_code=400, detail="License already expired")

    lic = db.query(DriverLicense).filter_by(user_id=current_user.id).first()

    if lic:
        lic.license_number = payload.license_number
        lic.issuing_country = payload.issuing_country
        lic.expiry_date = payload.expiry_date
        lic.is_verified = False  # reset verification if changed
    else:
        lic = DriverLicense(
            user_id=current_user.id,
            license_number=payload.license_number,
            issuing_country=payload.issuing_country,
            expiry_date=payload.expiry_date,
            is_verified=False,
        )
        db.add(lic)

    db.commit()
    db.refresh(lic)
    return lic


@router.post("/license/{user_id}/verify", response_model=LicenseOut)
def admin_verify_license(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_verified_user),
):
    if getattr(current_user, "role", "USER") != "ADMIN":
        raise HTTPException(status_code=403, detail="Admin only")

    lic = db.query(DriverLicense).filter_by(user_id=user_id).first()
    if not lic:
        raise HTTPException(status_code=404, detail="License not found")

    lic.is_verified = True
    db.commit()
    db.refresh(lic)
    return lic
