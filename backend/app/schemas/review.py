from datetime import datetime

from pydantic import BaseModel, Field


class ReviewCreateIn(BaseModel):
    rating: int = Field(ge=1, le=5)
    comment: str | None = Field(default=None, max_length=1000)


class ReviewOut(BaseModel):
    id: int
    booking_id: int
    car_id: int
    reviewer_id: int
    owner_id: int
    rating: int
    comment: str | None = None
    created_at: datetime

    class Config:
        from_attributes = True
