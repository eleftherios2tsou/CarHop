# backend/app/deps.py
# FastAPI dependency functions — these get injected into route handlers via Depends()
# think of them like reusable "middleware" that runs before the handler logic
from fastapi import Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.jwt import decode_access_token
from app.models.user import User
from app.security import ACCESS_COOKIE, require_csrf


def get_db():
    # create a new database session for each request and close it when the request is done
    # using yield here means FastAPI handles cleanup even if an exception is raised
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_current_user(
    request: Request,
    db: Session = Depends(get_db),
):
    # read the access token from the cookie — we don't use Authorization headers
    token = request.cookies.get(ACCESS_COOKIE)
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    try:
        # decode and validate the JWT — this will raise if it's expired or tampered with
        payload = decode_access_token(token)
        user_id = int(payload["sub"])  # the user ID is stored in the "sub" claim
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")

    # make sure the user still exists and hasn't been deactivated by an admin
    user = db.get(User, user_id)
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="Inactive user")

    return user


def get_current_verified_user(
    current_user: User = Depends(get_current_user),
):
    # most endpoints require the user to have verified their email first
    # if they haven't, we return 403 instead of 401 — they ARE authenticated, just not fully set up
    if not current_user.email_verified:
        raise HTTPException(status_code=403, detail="Email not verified")
    return current_user


def csrf_protect(request: Request) -> None:
    """
    Dependency to enforce CSRF protection on state-changing requests.
    Use it via: dependencies=[Depends(csrf_protect)]
    """
    # this checks that the CSRF token in the cookie matches the one in the request header
    # the frontend sends the token via X-CSRF-Token header on every POST/PUT/DELETE
    require_csrf(request)
    return None
