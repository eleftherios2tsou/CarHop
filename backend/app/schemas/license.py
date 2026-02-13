#backend/app/schemas/license.py

from pydantic import BaseModel
from datetime import date


class LicenseIn(BaseModel):
    license_number: str
    issuing_country: str
    expiry_date: date


class LicenseOut(BaseModel):
    id: int
    user_id: int
    license_number: str
    issuing_country: str
    expiry_date: date
    is_verified: bool

    class Config:
        from_attributes = True
