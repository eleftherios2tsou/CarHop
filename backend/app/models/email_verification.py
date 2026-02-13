#backend/app/models/email_verification.py
from sqlalchemy import String, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base

class EmailVerificationToken(Base):
    __tablename__ = "email_verification_tokens"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), unique=True)
    token: Mapped[str] = mapped_column(String, unique=True, index=True)
