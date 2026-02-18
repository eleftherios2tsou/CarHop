from datetime import datetime

from pydantic import BaseModel, Field


class DisputeCreateIn(BaseModel):
    reason: str = Field(min_length=3, max_length=120)
    details: str | None = Field(default=None, max_length=4000)


class DisputeResolveIn(BaseModel):
    status: str = Field(pattern="^(RESOLVED|REJECTED)$")
    resolution_note: str | None = Field(default=None, max_length=4000)


class DisputeOut(BaseModel):
    id: int
    booking_id: int
    opened_by_user_id: int
    against_user_id: int
    reason: str
    details: str | None = None
    status: str
    resolution_note: str | None = None
    created_at: datetime
    resolved_at: datetime | None = None

    class Config:
        from_attributes = True
