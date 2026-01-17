from sqlalchemy import String, Boolean, Date, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from datetime import date
from app.database import Base


class DriverLicense(Base):
    __tablename__ = "driver_licenses"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), unique=True, index=True)

    license_number: Mapped[str] = mapped_column(String)
    issuing_country: Mapped[str] = mapped_column(String)
    expiry_date: Mapped[date] = mapped_column(Date)

    is_verified: Mapped[bool] = mapped_column(Boolean, default=False)
