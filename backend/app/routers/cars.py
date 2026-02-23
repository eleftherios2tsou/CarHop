# backend/app/routers/car.py
from __future__ import annotations

import os
from uuid import uuid4
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from sqlalchemy.orm import Session, selectinload
from sqlalchemy import and_, exists, func, select

from app.deps import get_db, get_current_user, csrf_protect
from app.services import storage
from app.models.car import CarListing
from app.models.car_photo import CarPhoto
from app.models.booking import BookingRequest
from app.models.review import Review
from app.models.user import User
from app.schemas.car import CarCreate, CarOut, CarDetailOut, CarPhotosOut, CarUpdate, PaginatedCars

router = APIRouter(prefix="/cars", tags=["cars"])

MAX_PHOTOS_PER_CAR = 8
ALLOWED_PREFIX = "image/"


def validate_range(from_date: date | None, to_date: date | None):
    if (from_date is None) ^ (to_date is None):
        raise HTTPException(status_code=400, detail="Provide both 'from' and 'to' date query params")
    if from_date and to_date and to_date < from_date:
        raise HTTPException(status_code=400, detail="'to' must be on/after 'from'")


def _ensure_owner_or_admin(car: CarListing, current_user: User):
    if car.owner_id != current_user.id and current_user.role != "ADMIN":
        raise HTTPException(status_code=403, detail="Not allowed to modify this car")


def _save_upload(car_id: int, up: UploadFile) -> tuple[str, str]:
    if not up.content_type or not up.content_type.startswith(ALLOWED_PREFIX):
        raise HTTPException(status_code=400, detail=f"Only images are allowed ({ALLOWED_PREFIX}*)")

    _, ext = os.path.splitext(up.filename or "")
    ext = (ext or "").lower()
    if ext not in [".jpg", ".jpeg", ".png", ".webp", ".gif"]:
        ext = ".jpg"

    name = f"{uuid4().hex}{ext}"
    storage_key = f"cars/{car_id}/{name}"
    data = up.file.read()
    url = storage.save_file(storage_key, data, up.content_type or "image/jpeg")
    return storage_key, url



@router.get("/", response_model=PaginatedCars)
def list_cars(
    db: Session = Depends(get_db),
    from_date: date | None = Query(default=None, alias="from"),
    to_date: date | None = Query(default=None, alias="to"),
    city: str | None = Query(default=None),
    min_price: int | None = Query(default=None, ge=1),
    max_price: int | None = Query(default=None, ge=1),
    transmission: str | None = Query(default=None),
    fuel_type: str | None = Query(default=None),
    min_seats: int | None = Query(default=None, ge=1),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
):
    validate_range(from_date, to_date)

    q = db.query(CarListing).options(
        selectinload(CarListing.photos),
        selectinload(CarListing.owner),
    ).filter(CarListing.status == "AVAILABLE")

    if from_date and to_date:
        overlap_exists = exists(
            select(1).where(
                BookingRequest.car_id == CarListing.id,
                BookingRequest.status == "APPROVED",
                and_(
                    BookingRequest.start_date <= to_date,
                    BookingRequest.end_date >= from_date,
                ),
            )
        )
        q = q.filter(~overlap_exists)

    if city:
        q = q.filter(CarListing.city.ilike(f"%{city}%"))
    if min_price is not None:
        q = q.filter(CarListing.daily_price >= min_price)
    if max_price is not None:
        q = q.filter(CarListing.daily_price <= max_price)
    if transmission:
        q = q.filter(CarListing.transmission == transmission)
    if fuel_type:
        q = q.filter(CarListing.fuel_type == fuel_type)
    if min_seats is not None:
        q = q.filter(CarListing.seats >= min_seats)

    total = q.count()
    cars = (
        q.order_by(CarListing.id.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    if cars:
        owner_ids = list({c.owner_id for c in cars})
        listing_rows = (
            db.query(CarListing.owner_id, func.count(CarListing.id).label("cnt"))
            .filter(CarListing.owner_id.in_(owner_ids))
            .group_by(CarListing.owner_id)
            .all()
        )
        review_rows = (
            db.query(
                Review.owner_id,
                func.count(Review.id).label("review_cnt"),
                func.avg(Review.rating).label("avg_rating"),
            )
            .filter(Review.owner_id.in_(owner_ids))
            .group_by(Review.owner_id)
            .all()
        )
        listing_count_map = {row.owner_id: row.cnt for row in listing_rows}
        review_map = {
            row.owner_id: {
                "review_count": int(row.review_cnt or 0),
                "avg_rating": float(row.avg_rating) if row.avg_rating is not None else None,
            }
            for row in review_rows
        }
        for car in cars:
            if car.owner:
                car.owner.listing_count = listing_count_map.get(car.owner_id, 0)
                car.owner.member_since = car.owner.created_at
                review_meta = review_map.get(car.owner_id, {"review_count": 0, "avg_rating": None})
                car.owner.review_count = review_meta["review_count"]
                car.owner.avg_rating = review_meta["avg_rating"]

    return PaginatedCars.build(cars, total, page, page_size)


@router.get("/mine", response_model=list[CarOut])
def my_listings(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return (
        db.query(CarListing)
        .options(selectinload(CarListing.photos))
        .filter(CarListing.owner_id == current_user.id)
        .order_by(CarListing.id.desc())
        .all()
    )


@router.get("/{car_id}", response_model=CarDetailOut)
def get_car(car_id: int, db: Session = Depends(get_db)):
    car = (
        db.query(CarListing)
        .options(selectinload(CarListing.photos))
        .filter(CarListing.id == car_id)
        .first()
    )
    if not car:
        raise HTTPException(status_code=404, detail="Car not found")
    return car



@router.post("/", response_model=CarOut, dependencies=[Depends(csrf_protect)])
def create_car(
    payload: CarCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    car = CarListing(owner_id=current_user.id, **payload.model_dump())
    db.add(car)
    db.commit()
    db.refresh(car)
    return car



@router.post("/{car_id}/photos", response_model=CarPhotosOut, dependencies=[Depends(csrf_protect)])
def upload_car_photos(
    car_id: int,
    files: list[UploadFile] = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    car = (
        db.query(CarListing)
        .options(selectinload(CarListing.photos))
        .filter(CarListing.id == car_id)
        .first()
    )
    if not car:
        raise HTTPException(status_code=404, detail="Car not found")

    _ensure_owner_or_admin(car, current_user)

    existing = len(car.photos or [])
    incoming = len(files or [])
    if incoming == 0:
        raise HTTPException(status_code=400, detail="No files uploaded")
    if existing + incoming > MAX_PHOTOS_PER_CAR:
        raise HTTPException(status_code=400, detail=f"Max {MAX_PHOTOS_PER_CAR} photos per car")

    next_pos = max([p.position for p in car.photos], default=-1) + 1

    for up in files:
        storage_key, url = _save_upload(car_id, up)
        photo = CarPhoto(car_id=car_id, storage_key=storage_key, url=url, position=next_pos)
        next_pos += 1
        db.add(photo)

    db.commit()

    car = (
        db.query(CarListing)
        .options(selectinload(CarListing.photos))
        .filter(CarListing.id == car_id)
        .first()
    )
    return {"car_id": car_id, "photo_urls": car.photo_urls}


@router.delete("/{car_id}", dependencies=[Depends(csrf_protect)])
def delete_car(
    car_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    car = (
        db.query(CarListing)
        .options(selectinload(CarListing.photos))
        .filter(CarListing.id == car_id)
        .first()
    )
    if not car:
        raise HTTPException(status_code=404, detail="Car not found")

    _ensure_owner_or_admin(car, current_user)

    has_bookings = (
        db.query(BookingRequest.id)
        .filter(BookingRequest.car_id == car_id)
        .first()
        is not None
    )

    # Soft delete when historical bookings exist, to preserve audit/payment/dispute history.
    if has_bookings:
        car.status = "ARCHIVED"
        db.commit()
        return {"ok": True, "deleted_id": car_id, "soft_deleted": True}

    # Hard delete only when there are no linked bookings.
    for p in car.photos or []:
        storage.delete_file(p.storage_key)

    db.delete(car)
    db.commit()

    return {"ok": True, "deleted_id": car_id, "soft_deleted": False}



@router.patch("/{car_id}", response_model=CarOut, dependencies=[Depends(csrf_protect)])
def update_car(
    car_id: int,
    payload: CarUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    car = (
        db.query(CarListing)
        .options(selectinload(CarListing.photos))
        .filter(CarListing.id == car_id)
        .first()
    )
    if not car:
        raise HTTPException(status_code=404, detail="Car not found")

    _ensure_owner_or_admin(car, current_user)

    data = payload.model_dump(exclude_unset=True)

    if "daily_price" in data and data["daily_price"] is not None and data["daily_price"] < 1:
        raise HTTPException(status_code=400, detail="Invalid daily_price")

    if "year" in data and data["year"] is not None and data["year"] < 1900:
        raise HTTPException(status_code=400, detail="Invalid year")

    for k, v in data.items():
        setattr(car, k, v)

    db.commit()
    db.refresh(car)
    return car


@router.delete("/{car_id}/photos/{photo_id}", dependencies=[Depends(csrf_protect)])
def delete_car_photo(
    car_id: int,
    photo_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    car = (
        db.query(CarListing)
        .options(selectinload(CarListing.photos))
        .filter(CarListing.id == car_id)
        .first()
    )
    if not car:
        raise HTTPException(status_code=404, detail="Car not found")

    _ensure_owner_or_admin(car, current_user)

    photo = (
        db.query(CarPhoto)
        .filter(CarPhoto.id == photo_id, CarPhoto.car_id == car_id)
        .first()
    )
    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found")

    storage.delete_file(photo.storage_key)

    db.delete(photo)
    db.commit()

    return {"ok": True, "deleted_photo_id": photo_id}
