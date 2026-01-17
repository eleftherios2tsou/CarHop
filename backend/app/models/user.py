from sqlalchemy import String, Boolean, Date
from sqlalchemy.orm import Mapped, mapped_column
from datetime import date
from app.database import Base

class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)

    email: Mapped[str] = mapped_column(String, unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String)

    full_name: Mapped[str] = mapped_column(String)
    date_of_birth: Mapped[date] = mapped_column(Date)

    email_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
