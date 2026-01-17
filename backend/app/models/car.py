from sqlalchemy import String, Integer, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base

class CarListing(Base):
    __tablename__ = "cars"

    id: Mapped[int] = mapped_column(primary_key=True)
    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id"))

    make: Mapped[str] = mapped_column(String)
    model: Mapped[str] = mapped_column(String)
    year: Mapped[int] = mapped_column(Integer)

    daily_price: Mapped[int] = mapped_column(Integer)
    availability_units: Mapped[int] = mapped_column(Integer, default=1)

    status: Mapped[str] = mapped_column(String, default="AVAILABLE")  
