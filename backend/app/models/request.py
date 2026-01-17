from sqlalchemy import String, ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base

class RideRequest(Base):
    __tablename__ = "ride_requests"

    id: Mapped[int] = mapped_column(primary_key=True)
    ride_id: Mapped[int] = mapped_column(ForeignKey("rides.id"))
    passenger_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    status: Mapped[str] = mapped_column(String, default="PENDING")  

    __table_args__ = (
        UniqueConstraint("ride_id", "passenger_id", name="uq_ride_passenger"),
    )
