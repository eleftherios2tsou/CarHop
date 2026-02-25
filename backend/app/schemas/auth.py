#backend/app/schemas/auth.py

from pydantic import BaseModel, EmailStr
from datetime import date

class RegisterIn(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    date_of_birth: date
    terms_accepted: bool = False

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


class EmailResendIn(BaseModel):
    email: EmailStr


class ChangePasswordIn(BaseModel):
    current_password: str
    new_password: str
