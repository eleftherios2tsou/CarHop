from pydantic import BaseModel, Field

class RideCreate(BaseModel):
    origin: str = Field(min_length=1, max_length=200)
    destination: str = Field(min_length=1, max_length=200)
    seats_available: int = Field(ge=1, le=8)

class RideOut(BaseModel):
    id: int
    origin: str
    destination: str
    seats_available: int

    class Config:
        from_attributes = True
