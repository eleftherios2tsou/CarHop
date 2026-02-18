from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Index, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Payment(Base):
    __tablename__ = "payments"
    __table_args__ = (
        Index("ix_payments_booking_id", "booking_id", unique=True),
        Index("ix_payments_renter_id", "renter_id"),
        Index("ix_payments_owner_id", "owner_id"),
        Index("ix_payments_status", "status"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    booking_id: Mapped[int] = mapped_column(
        ForeignKey("bookings.id", ondelete="CASCADE"),
        nullable=False,
    )
    renter_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    owner_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )

    currency: Mapped[str] = mapped_column(String, nullable=False, default="GBP")
    amount_total: Mapped[int] = mapped_column(Integer, nullable=False)
    platform_fee: Mapped[int] = mapped_column(Integer, nullable=False)
    payout_amount: Mapped[int] = mapped_column(Integer, nullable=False)

    status: Mapped[str] = mapped_column(String, nullable=False, default="HELD_IN_ESCROW")
    provider: Mapped[str] = mapped_column(String, nullable=False, default="SIMULATED")
    provider_ref: Mapped[str | None] = mapped_column(String, nullable=True)
    stripe_payment_intent_id: Mapped[str | None] = mapped_column(String, nullable=True)
    stripe_charge_id: Mapped[str | None] = mapped_column(String, nullable=True)
    stripe_transfer_id: Mapped[str | None] = mapped_column(String, nullable=True)
    stripe_refund_id: Mapped[str | None] = mapped_column(String, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    paid_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    released_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    refunded_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
