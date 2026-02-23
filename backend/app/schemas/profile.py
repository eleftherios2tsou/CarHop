#backend/app/schemas/profile.py

from pydantic import BaseModel
from datetime import date


class ProfileOut(BaseModel):
    id: int
    email: str
    full_name: str
    date_of_birth: date
    email_verified: bool
    is_active: bool
    role: str
    has_license: bool
    license_verified: bool
    license_status: str | None = None
    profile_complete: bool
    payout_connected: bool
    payout_account_id: str | None = None

    class Config:
        from_attributes = True
