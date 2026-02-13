#backend/app/security.py
from __future__ import annotations

from datetime import timedelta
from uuid import uuid4

from fastapi import Response, Request, HTTPException

ACCESS_COOKIE = "access_token"
CSRF_COOKIE = "csrf_token"
CSRF_HEADER = "X-CSRF-Token"


def new_csrf_token() -> str:
    return uuid4().hex


def set_auth_cookies(
    response: Response,
    access_token: str,
    csrf_token: str,
    *,
    secure: bool = False,
    same_site: str = "lax",
    max_age_seconds: int = 60 * 60,  # 1 hour
):
    # HttpOnly JWT cookie
    response.set_cookie(
        key=ACCESS_COOKIE,
        value=access_token,
        httponly=True,
        secure=secure,
        samesite=same_site,
        max_age=max_age_seconds,
        path="/",
    )

    # CSRF cookie readable by JS (double-submit pattern)
    response.set_cookie(
        key=CSRF_COOKIE,
        value=csrf_token,
        httponly=False,
        secure=secure,
        samesite=same_site,
        max_age=max_age_seconds,
        path="/",
    )


def clear_auth_cookies(response: Response, *, secure: bool = False, same_site: str = "lax"):
    response.delete_cookie(key=ACCESS_COOKIE, path="/", secure=secure, samesite=same_site)
    response.delete_cookie(key=CSRF_COOKIE, path="/", secure=secure, samesite=same_site)


def require_csrf(request: Request):
    """
    Enforce CSRF for unsafe methods using double-submit cookie:
    - Cookie: csrf_token
    - Header: X-CSRF-Token
    Must match.
    """
    if request.method in ("GET", "HEAD", "OPTIONS"):
        return

    cookie_token = request.cookies.get(CSRF_COOKIE)
    header_token = request.headers.get(CSRF_HEADER)

    if not cookie_token or not header_token or cookie_token != header_token:
        raise HTTPException(status_code=403, detail="CSRF check failed")
