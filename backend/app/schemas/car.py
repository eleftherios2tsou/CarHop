from pydantic import BaseModel

class CarCreate(BaseModel):
    make: str
    model: str
    year: int
    daily_price: int
    availability_units: int = 1

class CarOut(CarCreate):
    id: int
    owner_id: int
    status: str

    class Config:
        from_attributes = True
