#backend/app/models/car_photo.py
from __future__ import annotations
from datetime import datetime
from sqlalchemy import ForeignKey, Integer, String, func, DateTime
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class CarPhoto(Base):
    __tablename__ = "car_photos"

    id: Mapped[int] = mapped_column(primary_key=True)

    car_id: Mapped[int] = mapped_column(
        ForeignKey("cars.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    storage_key: Mapped[str] = mapped_column(String, nullable=False)
    url: Mapped[str] = mapped_column(String, nullable=False)

    position: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
