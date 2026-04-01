#backend/app/schemas/profile.py

from pydantic import BaseModel, field_validator
from datetime import date, datetime


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
    license_expiry_date: date | None = None
    profile_complete: bool
    payout_connected: bool
    payout_account_id: str | None = None
    avatar_url: str | None = None
    bio: str | None = None

    class Config:
        from_attributes = True


class ProfileUpdateIn(BaseModel):
    bio: str | None = None

    @field_validator("bio")
    @classmethod
    def bio_length(cls, v: str | None) -> str | None:
        if v is not None and len(v) > 500:
            raise ValueError("Bio must be 500 characters or fewer")
        return v


class DeleteAccountIn(BaseModel):
    password: str  # the user's current password — we verify it before deleting


class PublicProfileOut(BaseModel):
    id: int
    full_name: str
    avatar_url: str | None = None
    bio: str | None = None
    member_since: datetime
    listing_count: int = 0
    avg_rating: float | None = None
    review_count: int = 0

    class Config:
        from_attributes = True
