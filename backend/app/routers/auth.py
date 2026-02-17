# backend/app/routers/auth.py
from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Response, Request
from sqlalchemy.orm import Session

from app.deps import get_db, csrf_protect, get_current_user
from app.models.user import User
from app.models.email_verification import EmailVerificationToken
from app.models.refresh_token import RefreshToken
from app.schemas.auth import RegisterIn, LoginIn
from app.auth import hash_password, verify_password
from app.jwt import create_access_token
from app.security import (
    new_csrf_token,
    new_refresh_token,
    hash_refresh_token,
    set_auth_cookies,
    clear_auth_cookies,
    REFRESH_COOKIE,
)

router = APIRouter(prefix="/auth", tags=["auth"])

ACCESS_MAX_AGE = 60 * 60             # 1 hour
REFRESH_MAX_AGE = 60 * 60 * 24 * 7   # 7 days


def age_in_years(dob: date) -> int:
    today = date.today()
    return today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))


@router.post("/register")
def register(payload: RegisterIn, db: Session = Depends(get_db)):
    if payload.date_of_birth > date.today():
        raise HTTPException(status_code=400, detail="Invalid date of birth")

    if age_in_years(payload.date_of_birth) < 21:
        raise HTTPException(status_code=400, detail="You must be at least 21 years old")

    # bcrypt truncates at 72 bytes; reject longer passwords to avoid surprises
    if len(payload.password.encode("utf-8")) > 72:
        raise HTTPException(status_code=400, detail="Password too long (max 72 bytes)")

    existing = db.query(User).filter_by(email=payload.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    user = User(
        email=payload.email,
        password_hash=hash_password(payload.password),
        full_name=payload.full_name,
        date_of_birth=payload.date_of_birth,
    )

    db.add(user)
    db.commit()
    db.refresh(user)

    token = EmailVerificationToken(user_id=user.id, token=str(uuid4()))
    db.add(token)
    db.commit()

    return {"message": "Registered. Verify your email.", "verification_token": token.token}


@router.post("/verify-email/{token}")
def verify_email(token: str, db: Session = Depends(get_db)):
    record = db.query(EmailVerificationToken).filter_by(token=token).first()
    if not record:
        raise HTTPException(status_code=400, detail="Invalid token")

    user = db.get(User, record.user_id)
    if not user:
        raise HTTPException(status_code=400, detail="Invalid token")

    user.email_verified = True
    db.delete(record)
    db.commit()

    return {"message": "Email verified"}


@router.post("/login")
def login(payload: LoginIn, db: Session = Depends(get_db)):
    user = db.query(User).filter_by(email=payload.email).first()
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    if not user.email_verified:
        raise HTTPException(status_code=403, detail="Email not verified")

    access = create_access_token(sub=str(user.id))

    refresh_raw = new_refresh_token()
    refresh_hash = hash_refresh_token(refresh_raw)
    expires_at = datetime.now(timezone.utc) + timedelta(seconds=REFRESH_MAX_AGE)

    db.add(
        RefreshToken(
            user_id=user.id,
            token_hash=refresh_hash,
            expires_at=expires_at,
            revoked=False,
        )
    )
    db.commit()

    csrf = new_csrf_token()

    response = Response(content='{"message":"Logged in"}', media_type="application/json")
    set_auth_cookies(
        response,
        access_token=access,
        refresh_token=refresh_raw,
        csrf_token=csrf,
        access_max_age_seconds=ACCESS_MAX_AGE,
        refresh_max_age_seconds=REFRESH_MAX_AGE,
    )
    return response


@router.post("/refresh")
def refresh(request: Request, db: Session = Depends(get_db)):
    """
    Validates refresh cookie against DB, rotates refresh token,
    mints new access token and CSRF token.
    """
    refresh_raw = request.cookies.get(REFRESH_COOKIE)
    if not refresh_raw:
        raise HTTPException(status_code=401, detail="Missing refresh token")

    refresh_hash = hash_refresh_token(refresh_raw)
    now = datetime.now(timezone.utc)

    token_row = (
        db.query(RefreshToken)
        .filter(
            RefreshToken.token_hash == refresh_hash,
            RefreshToken.revoked == False,  # noqa: E712
            RefreshToken.expires_at > now,
        )
        .first()
    )

    if not token_row:
        raise HTTPException(status_code=401, detail="Invalid refresh token")

    user = db.get(User, token_row.user_id)
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="Inactive user")

    # rotate refresh token
    token_row.revoked = True

    new_refresh_raw = new_refresh_token()
    new_refresh_hash = hash_refresh_token(new_refresh_raw)
    new_expires_at = now + timedelta(seconds=REFRESH_MAX_AGE)

    db.add(
        RefreshToken(
            user_id=user.id,
            token_hash=new_refresh_hash,
            expires_at=new_expires_at,
            revoked=False,
        )
    )

    # mint new access + csrf
    new_access = create_access_token(sub=str(user.id))
    new_csrf = new_csrf_token()

    db.commit()

    response = Response(content='{"message":"refreshed"}', media_type="application/json")
    set_auth_cookies(
        response,
        access_token=new_access,
        refresh_token=new_refresh_raw,
        csrf_token=new_csrf,
        access_max_age_seconds=ACCESS_MAX_AGE,
        refresh_max_age_seconds=REFRESH_MAX_AGE,
    )
    return response


@router.post("/logout", dependencies=[Depends(csrf_protect)])
def logout(
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Logout clears cookies and revokes the current refresh token (if present).
    """
    refresh_raw = request.cookies.get(REFRESH_COOKIE)
    if refresh_raw:
        refresh_hash = hash_refresh_token(refresh_raw)
        row = db.query(RefreshToken).filter(RefreshToken.token_hash == refresh_hash).first()
        if row and row.user_id == current_user.id:
            row.revoked = True
            db.commit()

    response = Response(content='{"message":"Logged out"}', media_type="application/json")
    clear_auth_cookies(response)
    return response
