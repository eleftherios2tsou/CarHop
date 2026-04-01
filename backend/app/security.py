# backend/app/security.py
# cookie names, token helpers, and CSRF validation logic used across the auth system
from __future__ import annotations

import hashlib
from uuid import uuid4

from fastapi import Response, Request, HTTPException

from app.config import settings

# cookie name constants — defined here so we don't use magic strings in multiple places
ACCESS_COOKIE = "access_token"
REFRESH_COOKIE = "refresh_token"
CSRF_COOKIE = "csrf_token"
CSRF_HEADER = "X-CSRF-Token"  # the header name the frontend sends the CSRF token in


def new_csrf_token() -> str:
    # just a random UUID hex string — unpredictable enough for CSRF protection
    return uuid4().hex


def new_refresh_token() -> str:
    # same format as CSRF tokens — a random UUID hex we store the hash of in the DB
    return uuid4().hex


def hash_refresh_token(raw: str) -> str:
    # we never store the raw refresh token, only its SHA-256 hash peppered with a secret
    # this means even if the DB leaks, the tokens can't be used without the pepper
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
    # shared cookie settings loaded from config (secure, samesite, domain)
    cookie_kwargs = dict(
        secure=settings.cookie_secure,
        samesite=settings.cookie_samesite,
        domain=settings.cookie_domain,
        path="/",
    )

    # access token is HttpOnly so JS can't read it — it's sent automatically by the browser
    response.set_cookie(
        key=ACCESS_COOKIE,
        value=access_token,
        httponly=True,
        max_age=access_max_age_seconds,
        **cookie_kwargs,
    )

    # refresh token is also HttpOnly — only the /auth/refresh endpoint needs to read it
    response.set_cookie(
        key=REFRESH_COOKIE,
        value=refresh_token,
        httponly=True,
        max_age=refresh_max_age_seconds,
        **cookie_kwargs,
    )

    # CSRF token is NOT HttpOnly — the frontend JS needs to read it and echo it back in a header
    # this is the whole point of the double-submit cookie CSRF pattern
    response.set_cookie(
        key=CSRF_COOKIE,
        value=csrf_token,
        httponly=False,  # intentionally readable by JS
        max_age=refresh_max_age_seconds,  # same lifetime as refresh token
        **cookie_kwargs,
    )


def clear_auth_cookies(response: Response):
    # delete all three auth cookies at once — used on logout
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
    # safe methods don't change state so they don't need CSRF protection
    if request.method in ("GET", "HEAD", "OPTIONS"):
        return

    # the double-submit pattern: both the cookie and the header must be present and equal
    # an attacker's page can trigger a request with the cookie (browser sends it automatically)
    # but they can't read the cookie value to put it in the header — that's what stops them
    cookie_token = request.cookies.get(CSRF_COOKIE)
    header_token = request.headers.get(CSRF_HEADER)

    if not cookie_token or not header_token or cookie_token != header_token:
        raise HTTPException(status_code=403, detail="CSRF check failed")
