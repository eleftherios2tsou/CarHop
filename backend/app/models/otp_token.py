# backend/app/models/otp_token.py
# stores short-lived one-time password codes used for two-factor authentication
# each record is deleted immediately after successful use so codes can't be reused

from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class OtpToken(Base):
    __tablename__ = "otp_tokens"

    id: Mapped[int] = mapped_column(primary_key=True)

    # the user this OTP belongs to
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )

    # SHA-256 hash of the 6-digit code — we never store the raw code
    code_hash: Mapped[str] = mapped_column(String, nullable=False)

    # opaque token returned to the browser after a successful first-factor login
    # the browser sends it back with the code so we can find this record without exposing user_id
    pending_token: Mapped[str] = mapped_column(String, nullable=False, unique=True, index=True)

    # what this OTP is for — "login" or "enable_2fa"
    purpose: Mapped[str] = mapped_column(String, nullable=False, default="login")

    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
