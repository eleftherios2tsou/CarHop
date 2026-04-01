from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Index, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class DamageReport(Base):
    __tablename__ = "damage_reports"
    __table_args__ = (
        # unique index — only one damage report is allowed per booking
        Index("ix_damage_reports_booking_id", "booking_id", unique=True),
        # index on status so the admin "open reports" query is fast
        Index("ix_damage_reports_status", "status"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    booking_id: Mapped[int] = mapped_column(
        ForeignKey("bookings.id", ondelete="CASCADE"),
        nullable=False,
    )
    reporter_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    description: Mapped[str] = mapped_column(Text, nullable=False)
    estimated_cost_pence: Mapped[int | None] = mapped_column(Integer, nullable=True)
    # JSON array of storage keys stored as plain text, e.g. '["damages/1/abc.jpg"]'
    # we parse this back to a list when building the API response
    photo_keys: Mapped[str | None] = mapped_column(Text, nullable=True)
    # possible statuses: OPEN → UNDER_REVIEW → RESOLVED or DISMISSED
    status: Mapped[str] = mapped_column(
        String, nullable=False, default="OPEN", server_default="OPEN"
    )
    admin_note: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    resolved_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
