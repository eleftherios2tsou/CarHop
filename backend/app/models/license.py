#backend/app/models/license.py
from sqlalchemy import String, Boolean, Date, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from datetime import date, datetime
from typing import Optional
from app.database import Base


class DriverLicense(Base):
    __tablename__ = "driver_licenses"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), unique=True, index=True)

    license_number: Mapped[str] = mapped_column(String)
    issuing_country: Mapped[str] = mapped_column(String)
    expiry_date: Mapped[date] = mapped_column(Date)

    # Photo storage
    license_photo_key: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    license_photo_url: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    selfie_key: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    selfie_url: Mapped[Optional[str]] = mapped_column(String, nullable=True)

    # Verification status: pending | processing | approved | rejected | manual_review
    verification_status: Mapped[str] = mapped_column(String, default="pending")

    # Timestamps
    submitted_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    verified_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    rejection_reason: Mapped[Optional[str]] = mapped_column(String, nullable=True)

    # Legacy field — True when verification_status == "approved"
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False)
