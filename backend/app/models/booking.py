#backend/app/models/booking.py
from datetime import date
from sqlalchemy import String, ForeignKey, Date
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base


class BookingRequest(Base):
    __tablename__ = "bookings"

    id: Mapped[int] = mapped_column(primary_key=True)
    car_id: Mapped[int] = mapped_column(ForeignKey("cars.id"))
    renter_id: Mapped[int] = mapped_column(ForeignKey("users.id"))

    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date] = mapped_column(Date, nullable=False)

    status: Mapped[str] = mapped_column(String, default="PENDING")



