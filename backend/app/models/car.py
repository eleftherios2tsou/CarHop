#backend/app/models/car.py
from __future__ import annotations

from typing import TYPE_CHECKING

from sqlalchemy import Boolean, String, Integer, ForeignKey, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import JSON

from app.database import Base

if TYPE_CHECKING:
    from app.models.car_photo import CarPhoto
    from app.models.user import User


class CarListing(Base):
    __tablename__ = "cars"

    id: Mapped[int] = mapped_column(primary_key=True)

    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)

    make: Mapped[str] = mapped_column(String, nullable=False)
    model: Mapped[str] = mapped_column(String, nullable=False)
    year: Mapped[int] = mapped_column(Integer, nullable=False)
    daily_price: Mapped[int] = mapped_column(Integer, nullable=False)
    availability_units: Mapped[int] = mapped_column(Integer, nullable=False, default=1)

    city: Mapped[str | None] = mapped_column(String, nullable=True)
    postcode: Mapped[str | None] = mapped_column(String, nullable=True)
    transmission: Mapped[str | None] = mapped_column(String, nullable=True)
    fuel_type: Mapped[str | None] = mapped_column(String, nullable=True)
    seats: Mapped[int | None] = mapped_column(Integer, nullable=True)
    doors: Mapped[int | None] = mapped_column(Integer, nullable=True)
    mileage: Mapped[int | None] = mapped_column(Integer, nullable=True)
    color: Mapped[str | None] = mapped_column(String, nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    features: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    status: Mapped[str] = mapped_column(String, nullable=False, default="AVAILABLE")
    cancellation_policy: Mapped[str] = mapped_column(String, nullable=False, default="FLEXIBLE", server_default="FLEXIBLE")
    instant_book_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")

    photos: Mapped[list["CarPhoto"]] = relationship(
        "CarPhoto",
        primaryjoin="CarListing.id==CarPhoto.car_id",
        order_by="CarPhoto.position.asc()",
        cascade="all, delete-orphan",
        passive_deletes=True,
        lazy="selectin",
    )

    owner: Mapped["User"] = relationship(
        "User",
        foreign_keys=[owner_id],
        lazy="selectin",
    )

    @property
    def photo_urls(self) -> list[str]:
        return [p.url for p in (self.photos or [])]
