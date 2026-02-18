from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, Index, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class StripeWebhookEvent(Base):
    __tablename__ = "stripe_webhook_events"
    __table_args__ = (
        Index("ix_stripe_webhook_events_event_id", "event_id", unique=True),
        Index("ix_stripe_webhook_events_event_type", "event_type"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    event_id: Mapped[str] = mapped_column(String, nullable=False)
    event_type: Mapped[str] = mapped_column(String, nullable=False)
    processed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
