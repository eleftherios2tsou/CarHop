# backend/app/models/booking.py
# SQLAlchemy model for booking requests — one row per booking a renter makes
from datetime import date

from sqlalchemy import Date, ForeignKey, String, Index
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class BookingRequest(Base):
    __tablename__ = "bookings"

    __table_args__ = (
        # composite index on car_id + status + dates — used by the overlap check query
        # when approving a booking we query "are there any APPROVED bookings for this car in this date range?"
        # this index makes that query fast instead of doing a full table scan
        Index("ix_bookings_car_status_dates", "car_id", "status", "start_date", "end_date"),
        # separate index for renter lookups — used by the "My Bookings" page query
        Index("ix_bookings_renter_id", "renter_id"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)

    car_id: Mapped[int] = mapped_column(ForeignKey("cars.id"))
    renter_id: Mapped[int] = mapped_column(ForeignKey("users.id"))

    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date] = mapped_column(Date, nullable=False)

    # possible statuses: PENDING → APPROVED/REJECTED → COMPLETED/CANCELLED
    status: Mapped[str] = mapped_column(String, default="PENDING")
