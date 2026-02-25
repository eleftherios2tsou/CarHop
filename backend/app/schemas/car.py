#backend/app/schemas/car.py
from __future__ import annotations

import math
from datetime import datetime
from typing import Any, Optional
from pydantic import BaseModel, Field


class OwnerOut(BaseModel):
    id: int
    full_name: str
    member_since: datetime | None = None
    listing_count: int = 0
    avg_rating: float | None = None
    review_count: int = 0

    class Config:
        from_attributes = True


class CarCreate(BaseModel):
    make: str
    model: str
    year: int
    daily_price: int
    availability_units: int = 1
    cancellation_policy: str = "FLEXIBLE"

    city: str | None = None
    postcode: str | None = None
    transmission: str | None = None
    fuel_type: str | None = None
    seats: int | None = None
    doors: int | None = None
    mileage: int | None = None
    color: str | None = None
    description: str | None = None
    features: dict[str, Any] | None = Field(default_factory=dict)


class CarUpdate(BaseModel):
    # PATCH: everything optional
    make: Optional[str] = None
    model: Optional[str] = None
    year: Optional[int] = None
    daily_price: Optional[int] = None
    availability_units: Optional[int] = None

    city: Optional[str] = None
    postcode: Optional[str] = None
    transmission: Optional[str] = None
    fuel_type: Optional[str] = None
    seats: Optional[int] = None
    doors: Optional[int] = None
    mileage: Optional[int] = None
    color: Optional[str] = None
    description: Optional[str] = None
    features: Optional[dict[str, Any]] = None

    status: Optional[str] = None
    cancellation_policy: Optional[str] = None

    class Config:
        extra = "forbid"


class CarPhotoOut(BaseModel):
    id: int
    url: str
    position: int

    class Config:
        from_attributes = True


class CarOut(BaseModel):
    id: int
    owner_id: int
    make: str
    model: str
    year: int
    daily_price: int
    availability_units: int
    status: str

    city: str | None = None
    postcode: str | None = None
    transmission: str | None = None
    fuel_type: str | None = None
    seats: int | None = None
    doors: int | None = None
    mileage: int | None = None
    color: str | None = None
    description: str | None = None
    features: dict[str, Any] | None = None

    photo_urls: list[str] = Field(default_factory=list)
    owner: OwnerOut | None = None
    cancellation_policy: str = "FLEXIBLE"
    instant_book_enabled: bool = False
    car_avg_rating: float | None = None
    car_review_count: int = 0

    class Config:
        from_attributes = True


class CarDetailOut(CarOut):
    photos: list[CarPhotoOut] = Field(default_factory=list)


class CarPhotosOut(BaseModel):
    car_id: int
    photo_urls: list[str]

    class Config:
        from_attributes = True


class InstantBookToggle(BaseModel):
    enabled: bool


class PaginatedCars(BaseModel):
    items: list[CarOut]
    total: int
    page: int
    page_size: int
    total_pages: int

    @classmethod
    def build(cls, items: list, total: int, page: int, page_size: int) -> "PaginatedCars":
        return cls(
            items=items,
            total=total,
            page=page,
            page_size=page_size,
            total_pages=max(1, math.ceil(total / page_size)),
        )
