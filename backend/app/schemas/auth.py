#backend/app/schemas/auth.py

from pydantic import BaseModel, EmailStr
from datetime import date

class RegisterIn(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    date_of_birth: date

class LoginIn(BaseModel):
    email: EmailStr
    password: str

class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
