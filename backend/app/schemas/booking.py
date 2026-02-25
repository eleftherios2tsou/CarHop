#backend/app/schemas/booking.py
import math
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
    car_cancellation_policy: str = "FLEXIBLE"

    class Config:
        from_attributes = True


class PaginatedBookings(BaseModel):
    items: list[BookingOut]
    total: int
    page: int
    page_size: int
    total_pages: int

    @classmethod
    def build(cls, items: list, total: int, page: int, page_size: int) -> "PaginatedBookings":
        return cls(
            items=items,
            total=total,
            page=page,
            page_size=page_size,
            total_pages=max(1, math.ceil(total / page_size)),
        )
