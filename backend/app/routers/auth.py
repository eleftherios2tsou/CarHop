# backend/app/routers/auth.py
# handles all authentication endpoints: register, login, logout, email verification, and password reset
from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Response, Request
from sqlalchemy.orm import Session

from app.deps import get_db, csrf_protect, get_current_user
from app.models.user import User
from app.models.email_verification import EmailVerificationToken
from app.models.refresh_token import RefreshToken
from app.schemas.auth import RegisterIn, LoginIn, ForgotPasswordIn, ResetPasswordIn, EmailResendIn, VerifyOtpIn
from app.auth import hash_password, verify_password
from app.jwt import create_access_token
from app.rate_limit import check_rate_limit
from app.security import (
    new_csrf_token,
    new_refresh_token,
    hash_refresh_token,
    set_auth_cookies,
    clear_auth_cookies,
    REFRESH_COOKIE,
)
from app.services.email import send_verification_email, send_otp_email
from app.email import notify_password_reset
from app.models.password_reset_token import PasswordResetToken
from app.config import settings

router = APIRouter(prefix="/auth", tags=["auth"])

# token lifetimes — access tokens are short-lived, refresh tokens last longer
ACCESS_MAX_AGE = 60 * 60             # 1 hour
REFRESH_MAX_AGE = 60 * 60 * 24 * 7   # 7 days


def age_in_years(dob: date) -> int:
    # calculate the user's age properly, accounting for whether their birthday has passed this year
    today = date.today()
    return today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))


def _client_ip(request: Request) -> str:
    # try to get the real IP from the X-Forwarded-For header (set by proxies/load balancers)
    # fall back to the direct connection IP if the header isn't present
    xff = request.headers.get("x-forwarded-for")
    if xff:
        return xff.split(",")[0].strip()  # take the first IP — that's the original client
    return request.client.host if request.client and request.client.host else "unknown"


@router.post("/register")
def register(payload: RegisterIn, request: Request, db: Session = Depends(get_db)):
    # rate limit registrations by IP to stop bots creating hundreds of accounts
    check_rate_limit(scope="auth.register", identifier=_client_ip(request), limit=8, window_seconds=600)

    if payload.date_of_birth > date.today():
        raise HTTPException(status_code=400, detail="Invalid date of birth")

    # our insurance requires drivers to be at least 21 years old
    if age_in_years(payload.date_of_birth) < 21:
        raise HTTPException(status_code=400, detail="You must be at least 21 years old")

    # bcrypt silently truncates passwords longer than 72 bytes, which could cause login mismatches
    # we reject them upfront instead to make the behaviour explicit
    if len(payload.password.encode("utf-8")) > 72:
        raise HTTPException(status_code=400, detail="Password too long (max 72 bytes)")

    # check if the email is already in use before trying to insert
    existing = db.query(User).filter_by(email=payload.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    # map the account type to the internal role — OWNER gets listing rights, RENTER stays as USER
    role = "OWNER" if payload.account_type == "OWNER" else "USER"

    # create the user record with a hashed password (never store plaintext!)
    user = User(
        email=payload.email,
        password_hash=hash_password(payload.password),
        full_name=payload.full_name,
        date_of_birth=payload.date_of_birth,
        terms_accepted_at=datetime.now(timezone.utc) if payload.terms_accepted else None,
        role=role,
    )

    db.add(user)
    db.commit()
    db.refresh(user)  # refresh to get the auto-generated ID back

    # generate a 24-hour email verification token and send it to the user
    token = EmailVerificationToken(
        user_id=user.id,
        token=str(uuid4()),
        expires_at=datetime.now(timezone.utc) + timedelta(hours=24),
    )
    db.add(token)
    db.commit()

    # this sends the verification email — in tests we read the token from the DB directly
    send_verification_email(user.email, token.token, settings)

    return {"message": "Registered. Please check your email to verify your account."}


@router.post("/verify-email/{token}")
def verify_email(token: str, request: Request, db: Session = Depends(get_db)):
    # rate limit verification attempts to prevent brute-forcing tokens
    check_rate_limit(scope="auth.verify_email", identifier=_client_ip(request), limit=20, window_seconds=600)

    # look up the token record — it's invalid if it doesn't exist
    record = db.query(EmailVerificationToken).filter_by(token=token).first()
    if not record:
        raise HTTPException(status_code=400, detail="Invalid token")

    # check if the token has expired (tokens are only valid for 24 hours after registration)
    if record.expires_at and record.expires_at < datetime.now(timezone.utc):
        db.delete(record)  # clean up expired tokens from the DB
        db.commit()
        raise HTTPException(status_code=400, detail="Verification link has expired. Please request a new one.")

    user = db.get(User, record.user_id)
    if not user:
        raise HTTPException(status_code=400, detail="Invalid token")

    # mark the user as verified and delete the used token so it can't be used again
    user.email_verified = True
    db.delete(record)
    db.commit()

    return {"message": "Email verified"}


@router.post("/login")
def login(payload: LoginIn, request: Request, db: Session = Depends(get_db)):
    # rate limit login attempts to slow down brute force attacks
    check_rate_limit(scope="auth.login", identifier=_client_ip(request), limit=12, window_seconds=600)

    # check credentials — we give the same error for wrong email OR wrong password
    # this prevents attackers from figuring out which emails are registered
    user = db.query(User).filter_by(email=payload.email).first()
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    # block login if the user hasn't verified their email yet
    if not user.email_verified:
        raise HTTPException(status_code=403, detail="Email not verified")

    # if 2FA is enabled, send an OTP and return a pending token instead of full auth cookies
    # the client must call /auth/verify-otp with the code to complete login
    if user.totp_enabled:
        return _send_otp_and_pend(user, db, purpose="login")

    return _issue_auth_response(user, db)


def _generate_otp_code() -> tuple[str, str]:
    # returns (raw_code, sha256_hex_hash) — we store only the hash, send only the raw code
    import hashlib, secrets
    code = f"{secrets.randbelow(1_000_000):06d}"  # zero-padded 6-digit code
    code_hash = hashlib.sha256(code.encode()).hexdigest()
    return code, code_hash


def _send_otp_and_pend(user: User, db: Session, purpose: str) -> Response:
    # cleans up any existing OTP for this user+purpose, then generates and stores a fresh one
    from app.models.otp_token import OtpToken
    import json

    db.query(OtpToken).filter_by(user_id=user.id, purpose=purpose).delete()

    code, code_hash = _generate_otp_code()
    pending_token = new_csrf_token()  # UUID4 hex — unique opaque token
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=10)

    db.add(OtpToken(
        user_id=user.id,
        code_hash=code_hash,
        pending_token=pending_token,
        purpose=purpose,
        expires_at=expires_at,
    ))
    db.commit()

    send_otp_email(user.email, code, settings)

    # return a 200 with 2fa_required so the frontend knows to show the OTP screen
    body = json.dumps({"2fa_required": True, "pending_token": pending_token})
    return Response(content=body, media_type="application/json")


def _issue_auth_response(user: User, db: Session) -> Response:
    # mints access + refresh tokens and sets all auth cookies — shared by login and verify-otp
    access = create_access_token(sub=str(user.id))

    refresh_raw = new_refresh_token()
    refresh_hash = hash_refresh_token(refresh_raw)
    expires_at = datetime.now(timezone.utc) + timedelta(seconds=REFRESH_MAX_AGE)

    db.add(RefreshToken(
        user_id=user.id,
        token_hash=refresh_hash,
        expires_at=expires_at,
        revoked=False,
    ))
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


@router.post("/verify-otp")
def verify_otp(payload: VerifyOtpIn, request: Request, db: Session = Depends(get_db)):
    # rate limit OTP attempts to prevent brute-forcing the 6-digit code
    check_rate_limit(scope="auth.verify_otp", identifier=_client_ip(request), limit=10, window_seconds=600)

    from app.models.otp_token import OtpToken
    import hashlib

    rec = db.query(OtpToken).filter_by(pending_token=payload.pending_token, purpose="login").first()
    if not rec:
        raise HTTPException(status_code=400, detail="Invalid or expired code")

    if rec.expires_at < datetime.now(timezone.utc):
        db.delete(rec)
        db.commit()
        raise HTTPException(status_code=400, detail="Code has expired. Please log in again.")

    # hash the submitted code and compare — never compare raw codes
    submitted_hash = hashlib.sha256(payload.code.strip().encode()).hexdigest()
    if submitted_hash != rec.code_hash:
        raise HTTPException(status_code=400, detail="Incorrect code")

    user = db.get(User, rec.user_id)
    if not user or not user.is_active:
        raise HTTPException(status_code=400, detail="Invalid session")

    # consume the OTP record so it can't be used again
    db.delete(rec)
    db.commit()

    return _issue_auth_response(user, db)


@router.post("/refresh")
def refresh(request: Request, db: Session = Depends(get_db)):
    """
    Validates refresh cookie against DB, rotates refresh token,
    mints new access token and CSRF token.
    """
    check_rate_limit(scope="auth.refresh", identifier=_client_ip(request), limit=60, window_seconds=600)

    # the refresh token comes in as a cookie — reject immediately if it's missing
    refresh_raw = request.cookies.get(REFRESH_COOKIE)
    if not refresh_raw:
        raise HTTPException(status_code=401, detail="Missing refresh token")

    # hash the raw token and look it up in the DB — we only store hashes, not raw tokens
    refresh_hash = hash_refresh_token(refresh_raw)
    now = datetime.now(timezone.utc)

    # find the token record — it must exist, not be revoked, and not be expired
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

    # make sure the user account is still active before issuing new tokens
    user = db.get(User, token_row.user_id)
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="Inactive user")

    # rotate the refresh token — revoke the old one and issue a new one
    # this means a stolen refresh token can only be used once before it's invalidated
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

    # mint new access + csrf tokens alongside the new refresh token
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


@router.post("/forgot-password")
def forgot_password(payload: ForgotPasswordIn, request: Request, db: Session = Depends(get_db)):
    # strict rate limit — password reset emails should not be spammable
    check_rate_limit(scope="auth.forgot_password", identifier=_client_ip(request), limit=5, window_seconds=600)
    user = db.query(User).filter_by(email=payload.email).first()
    if user and user.email_verified:
        # delete any existing reset token for this user before creating a new one
        db.query(PasswordResetToken).filter_by(user_id=user.id).delete()
        token = new_csrf_token()  # UUID4 hex — same helper, different purpose
        expires = datetime.now(timezone.utc) + timedelta(hours=1)
        db.add(PasswordResetToken(user_id=user.id, token=token, expires_at=expires))
        db.commit()
        reset_url = f"{settings.frontend_base_url}/?reset={token}"
        notify_password_reset(user.email, reset_url)
    # always return 200 regardless of whether the email exists — prevents email enumeration attacks
    return {"message": "If an account with that email exists, a reset link has been sent."}


@router.post("/reset-password")
def reset_password(payload: ResetPasswordIn, db: Session = Depends(get_db)):
    # look up the reset token — it's invalid if it doesn't exist in the DB
    rec = db.query(PasswordResetToken).filter_by(token=payload.token).first()
    if not rec:
        raise HTTPException(status_code=400, detail="Invalid or expired reset token")
    if rec.expires_at < datetime.now(timezone.utc):
        db.delete(rec)  # clean up the expired record
        db.commit()
        raise HTTPException(status_code=400, detail="Reset token has expired. Please request a new one.")
    # same 72-byte check as registration — bcrypt will silently truncate otherwise
    if len(payload.new_password.encode("utf-8")) > 72:
        raise HTTPException(status_code=400, detail="Password too long (max 72 bytes)")
    user = db.get(User, rec.user_id)
    if not user:
        raise HTTPException(status_code=400, detail="Invalid reset token")
    user.password_hash = hash_password(payload.new_password)
    db.delete(rec)  # consume the token so it can't be used again
    db.commit()
    return {"message": "Password updated. You can now log in."}


@router.post("/resend-verification")
def resend_verification(payload: EmailResendIn, request: Request, db: Session = Depends(get_db)):
    # very tight rate limit — resending emails should not be abusable
    check_rate_limit(scope="auth.resend_verification", identifier=_client_ip(request), limit=3, window_seconds=600)
    user = db.query(User).filter_by(email=payload.email).first()
    if not user:
        # return a vague message to prevent exposing which emails are registered
        return {"message": "If that email is registered and unverified, a link has been sent."}
    if user.email_verified:
        raise HTTPException(status_code=400, detail="Email is already verified.")
    # delete the old token and create a fresh one with a new 24-hour expiry
    db.query(EmailVerificationToken).filter_by(user_id=user.id).delete()
    new_token = str(uuid4())
    db.add(EmailVerificationToken(
        user_id=user.id,
        token=new_token,
        expires_at=datetime.now(timezone.utc) + timedelta(hours=24),
    ))
    db.commit()
    send_verification_email(user.email, new_token, settings)
    return {"message": "Verification email sent."}


@router.post("/logout", dependencies=[Depends(csrf_protect)])
def logout(
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Logout clears cookies and revokes the current refresh token (if present).
    """
    # revoke the refresh token in the DB so it can't be used to get new access tokens
    refresh_raw = request.cookies.get(REFRESH_COOKIE)
    if refresh_raw:
        refresh_hash = hash_refresh_token(refresh_raw)
        row = db.query(RefreshToken).filter(RefreshToken.token_hash == refresh_hash).first()
        if row and row.user_id == current_user.id:
            row.revoked = True  # mark as revoked instead of deleting so we have an audit trail
            db.commit()

    # clear all auth cookies from the browser and return a success message
    response = Response(content='{"message":"Logged out"}', media_type="application/json")
    clear_auth_cookies(response)
    return response
