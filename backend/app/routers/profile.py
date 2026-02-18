#backend/app/routers/profile.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import date
import stripe

from app.config import settings
from app.deps import get_db, get_current_verified_user, csrf_protect
from app.models.user import User
from app.models.license import DriverLicense
from app.schemas.license import LicenseIn, LicenseOut
from app.schemas.profile import ProfileOut

router = APIRouter(prefix="/profile", tags=["profile"])


def _require_stripe_secret() -> None:
    if not settings.stripe_secret_key:
        raise HTTPException(status_code=503, detail="Stripe is not configured")
    stripe.api_key = settings.stripe_secret_key


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
        "profile_complete": profile_complete,
        "payout_connected": bool(current_user.stripe_account_onboarded),
        "payout_account_id": current_user.stripe_account_id,
    }


@router.post("/license", response_model=LicenseOut, dependencies=[Depends(csrf_protect)])
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


@router.post("/license/{user_id}/verify", response_model=LicenseOut, dependencies=[Depends(csrf_protect)])
def admin_verify_license(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_verified_user),
):
    # ✅ role-based admin
    if current_user.role != "ADMIN":
        raise HTTPException(status_code=403, detail="Admin only")

    lic = db.query(DriverLicense).filter_by(user_id=user_id).first()
    if not lic:
        raise HTTPException(status_code=404, detail="License not found")

    lic.is_verified = True
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
