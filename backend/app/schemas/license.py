#backend/app/schemas/license.py

from pydantic import BaseModel
from datetime import date, datetime
from typing import Optional


class LicenseOut(BaseModel):
    id: int
    user_id: int
    license_number: str
    issuing_country: str
    expiry_date: date
    is_verified: bool

    # Photo URLs
    license_photo_url: Optional[str] = None
    selfie_url: Optional[str] = None

    # Verification pipeline
    verification_status: str = "pending"
    submitted_at: Optional[datetime] = None
    verified_at: Optional[datetime] = None
    rejection_reason: Optional[str] = None

    class Config:
        from_attributes = True


class AdminRejectIn(BaseModel):
    reason: Optional[str] = None
