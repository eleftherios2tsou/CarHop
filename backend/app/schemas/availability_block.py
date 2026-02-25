from datetime import date, datetime

from pydantic import BaseModel, field_validator


class AvailabilityBlockOut(BaseModel):
    id: int
    car_id: int
    start_date: date
    end_date: date
    reason: str | None = None
    created_at: datetime

    class Config:
        from_attributes = True


class AvailabilityBlockCreateIn(BaseModel):
    start_date: date
    end_date: date
    reason: str | None = None

    @field_validator("end_date")
    @classmethod
    def end_after_start(cls, v, info):
        start = info.data.get("start_date")
        if start and v < start:
            raise ValueError("end_date must be on or after start_date")
        return v
