from pydantic import BaseModel

class BookingOut(BaseModel):
    id: int
    car_id: int
    renter_id: int
    status: str

    class Config:
        from_attributes = True
