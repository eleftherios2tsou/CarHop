#backend/app/deps.py
from fastapi import Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.jwt import decode_access_token
from app.models.user import User
from app.security import ACCESS_COOKIE, require_csrf


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_current_user(
    request: Request,
    db: Session = Depends(get_db),
):
    token = request.cookies.get(ACCESS_COOKIE)
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    try:
        payload = decode_access_token(token)
        user_id = int(payload["sub"])
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")

    user = db.get(User, user_id)
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="Inactive user")

    return user


def get_current_verified_user(
    current_user: User = Depends(get_current_user),
):
    if not current_user.email_verified:
        raise HTTPException(status_code=403, detail="Email not verified")
    return current_user


def csrf_protect(request: Request):
    require_csrf(request)
