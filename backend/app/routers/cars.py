from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.deps import get_db, get_current_user
from app.models.car import CarListing
from app.models.user import User
from app.schemas.car import CarCreate, CarOut

router = APIRouter(prefix="/cars", tags=["cars"])

@router.get("/", response_model=list[CarOut])
def list_cars(db: Session = Depends(get_db)):
    return db.query(CarListing).all()

@router.post("/", response_model=CarOut)
def create_car(
    payload: CarCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    car = CarListing(owner_id=current_user.id, **payload.dict())
    db.add(car)
    db.commit()
    db.refresh(car)
    return car
