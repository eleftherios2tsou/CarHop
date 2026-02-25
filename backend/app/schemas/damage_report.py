from datetime import datetime

from pydantic import BaseModel


class DamageReportOut(BaseModel):
    id: int
    booking_id: int
    reporter_id: int
    description: str
    estimated_cost_pence: int | None = None
    photo_keys: str | None = None  # raw JSON text
    status: str
    admin_note: str | None = None
    created_at: datetime
    resolved_at: datetime | None = None

    class Config:
        from_attributes = True


class DamageReportResolveIn(BaseModel):
    status: str  # "RESOLVED" | "DISMISSED"
    deposit_decision: str  # "release_to_renter" | "forfeit_to_owner"
    admin_note: str | None = None
