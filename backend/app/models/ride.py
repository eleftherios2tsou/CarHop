from sqlalchemy import String, Integer
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base

class Ride(Base):
    __tablename__ = "rides"

    id: Mapped[int] = mapped_column(primary_key=True)
    origin: Mapped[str] = mapped_column(String)
    destination: Mapped[str] = mapped_column(String)
    seats_available: Mapped[int] = mapped_column(Integer)
