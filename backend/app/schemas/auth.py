#backend/app/schemas/auth.py

import re
from datetime import date

from pydantic import BaseModel, EmailStr, field_validator


# reusable helper — runs the same password strength rules wherever it's called
# raises ValueError so Pydantic can surface it as a proper 422 field error
def _check_password_strength(v: str) -> str:
    if not (8 <= len(v) <= 24):
        raise ValueError("Password must be 8–24 characters")
    if not re.search(r"[a-z]", v):
        raise ValueError("Password must include at least one lowercase letter")
    if not re.search(r"[A-Z]", v):
        raise ValueError("Password must include at least one uppercase letter")
    if not re.search(r"\d", v):
        raise ValueError("Password must include at least one number")
    if not re.search(r"[^a-zA-Z0-9]", v):
        raise ValueError("Password must include at least one special character")
    return v


class RegisterIn(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    date_of_birth: date
    terms_accepted: bool = False

    @field_validator("password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        return _check_password_strength(v)


class LoginIn(BaseModel):
    email: EmailStr
    password: str

class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"


class ForgotPasswordIn(BaseModel):
    email: EmailStr


class ResetPasswordIn(BaseModel):
    token: str
    new_password: str

    @field_validator("new_password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        return _check_password_strength(v)


class EmailResendIn(BaseModel):
    email: EmailStr


class ChangePasswordIn(BaseModel):
    current_password: str
    new_password: str

    @field_validator("new_password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        return _check_password_strength(v)
