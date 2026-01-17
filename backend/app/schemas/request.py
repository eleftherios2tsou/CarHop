from pydantic import BaseModel

class RequestOut(BaseModel):
    id: int
    ride_id: int
    passenger_id: int
    status: str

    class Config:
        from_attributes = True
