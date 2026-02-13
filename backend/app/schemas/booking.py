#backend/app/schemas/booking.py
from datetime import date
from pydantic import BaseModel


class BookingCreateIn(BaseModel):
    start_date: date
    end_date: date


class BookingOut(BaseModel):
    id: int
    car_id: int
    renter_id: int
    start_date: date
    end_date: date
    status: str

    class Config:
        from_attributes = True
