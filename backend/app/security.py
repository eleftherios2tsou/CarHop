# backend/app/security.py
from __future__ import annotations

import hashlib
from uuid import uuid4

from fastapi import Response, Request, HTTPException

from app.config import settings

ACCESS_COOKIE = "access_token"
REFRESH_COOKIE = "refresh_token"
CSRF_COOKIE = "csrf_token"
CSRF_HEADER = "X-CSRF-Token"


def new_csrf_token() -> str:
    return uuid4().hex


def new_refresh_token() -> str:
    return uuid4().hex


def hash_refresh_token(raw: str) -> str:
    data = (settings.refresh_token_pepper + raw).encode("utf-8")
    return hashlib.sha256(data).hexdigest()


def set_auth_cookies(
    response: Response,
    *,
    access_token: str,
    refresh_token: str,
    csrf_token: str,
    access_max_age_seconds: int,
    refresh_max_age_seconds: int,
):
    cookie_kwargs = dict(
        secure=settings.cookie_secure,
        samesite=settings.cookie_samesite,
        domain=settings.cookie_domain,
        path="/",
    )

    response.set_cookie(
        key=ACCESS_COOKIE,
        value=access_token,
        httponly=True,
        max_age=access_max_age_seconds,
        **cookie_kwargs,
    )

    response.set_cookie(
        key=REFRESH_COOKIE,
        value=refresh_token,
        httponly=True,
        max_age=refresh_max_age_seconds,
        **cookie_kwargs,
    )

    response.set_cookie(
        key=CSRF_COOKIE,
        value=csrf_token,
        httponly=False,
        max_age=refresh_max_age_seconds,
        **cookie_kwargs,
    )


def clear_auth_cookies(response: Response):
    cookie_kwargs = dict(
        secure=settings.cookie_secure,
        samesite=settings.cookie_samesite,
        domain=settings.cookie_domain,
        path="/",
    )
    response.delete_cookie(key=ACCESS_COOKIE, **cookie_kwargs)
    response.delete_cookie(key=REFRESH_COOKIE, **cookie_kwargs)
    response.delete_cookie(key=CSRF_COOKIE, **cookie_kwargs)


def require_csrf(request: Request):
    if request.method in ("GET", "HEAD", "OPTIONS"):
        return

    cookie_token = request.cookies.get(CSRF_COOKIE)
    header_token = request.headers.get(CSRF_HEADER)

    if not cookie_token or not header_token or cookie_token != header_token:
        raise HTTPException(status_code=403, detail="CSRF check failed")
