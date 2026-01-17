from sqlalchemy import String, ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base

class BookingRequest(Base):
    __tablename__ = "bookings"

    id: Mapped[int] = mapped_column(primary_key=True)
    car_id: Mapped[int] = mapped_column(ForeignKey("cars.id"))
    renter_id: Mapped[int] = mapped_column(ForeignKey("users.id"))

    status: Mapped[str] = mapped_column(String, default="PENDING")  # PENDING | APPROVED | REJECTED

    __table_args__ = (
        UniqueConstraint("car_id", "renter_id", name="uq_car_renter"),
    )
