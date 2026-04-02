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
    account_type: str = "RENTER"  # "RENTER" or "OWNER"

    @field_validator("password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        return _check_password_strength(v)

    @field_validator("account_type")
    @classmethod
    def valid_account_type(cls, v: str) -> str:
        if v not in ("RENTER", "OWNER"):
            raise ValueError("account_type must be RENTER or OWNER")
        return v


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


class VerifyOtpIn(BaseModel):
    pending_token: str  # opaque token returned by the login endpoint when 2FA is required
    code: str           # the 6-digit code the user received by email


class Enable2faIn(BaseModel):
    code: str  # the OTP code sent to the user's email to confirm they own it


class Disable2faIn(BaseModel):
    password: str  # current password — required to disable 2FA as a safety check
