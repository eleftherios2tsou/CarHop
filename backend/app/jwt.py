# backend/app/jwt.py
# helper functions for creating and decoding JWT access tokens
# we use the python-jose library here (jose = JSON Object Signing and Encryption)
from datetime import datetime, timedelta, timezone
from typing import Any, Dict

from jose import JWTError, jwt

from app.config import settings


def create_access_token(sub: str) -> str:
    # sub = "subject" — this is the user ID as a string, which is the JWT standard way of doing it
    # the token expires after ACCESS_TOKEN_EXPIRE_MINUTES minutes (set in .env)
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.access_token_expire_minutes)
    payload = {"sub": sub, "exp": expire}
    return jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)


def decode_access_token(token: str) -> Dict[str, Any]:
    try:
        # this validates the signature AND checks the expiry time automatically
        payload = jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])
        if "sub" not in payload:
            raise JWTError("Missing sub")  # shouldn't happen but guard just in case
        return payload
    except JWTError:
        raise  # let the caller handle it — usually results in a 401 response
