from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from uuid import uuid4
from datetime import date
from app.deps import get_db
from app.models.user import User
from app.models.email_verification import EmailVerificationToken
from app.schemas.auth import RegisterIn, LoginIn, TokenOut
from app.auth import hash_password, verify_password
from app.jwt import create_access_token

router = APIRouter(prefix="/auth", tags=["auth"])


def age_in_years(dob: date) -> int:
    today = date.today()
    return today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))


@router.post("/register")
def register(payload: RegisterIn, db: Session = Depends(get_db)):
    if payload.date_of_birth > date.today():
        raise HTTPException(status_code=400, detail="Invalid date of birth")

    if age_in_years(payload.date_of_birth) < 21:
        raise HTTPException(status_code=400, detail="You must be at least 21 years old")

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

    return {
        "message": "Registered. Verify your email.",
        "verification_token": token.token,
    }


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


@router.post("/login", response_model=TokenOut)
def login(payload: LoginIn, db: Session = Depends(get_db)):
    user = db.query(User).filter_by(email=payload.email).first()
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    if not user.email_verified:
        raise HTTPException(status_code=403, detail="Email not verified")

    token = create_access_token(sub=str(user.id))
    return {"access_token": token}
