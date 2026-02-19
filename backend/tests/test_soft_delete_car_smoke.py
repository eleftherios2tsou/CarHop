from datetime import date, timedelta

from app.main import app
from app.models.booking import BookingRequest
from app.models.car import CarListing
from app.models.user import User


def test_delete_car_soft_deletes_when_bookings_exist(client):
    test_client, _ = client
    SessionLocal = app.state.test_sessionmaker
    owner_id = app.state.test_user_id

    db = SessionLocal()
    renter = User(
        email="renter-soft-delete@example.com",
        password_hash="hashed",
        full_name="Renter Soft Delete",
        date_of_birth=date(1993, 1, 1),
        email_verified=True,
        is_active=True,
        role="USER",
    )
    db.add(renter)
    db.commit()
    db.refresh(renter)

    car = CarListing(
        owner_id=owner_id,
        make="Mazda",
        model="3",
        year=2021,
        daily_price=65,
        availability_units=1,
        city="Bristol",
        postcode="BS1",
        transmission="AUTOMATIC",
        fuel_type="PETROL",
        seats=5,
        doors=5,
        mileage=18000,
        color="Red",
        description="Soft delete test car",
        features={"ac": True},
        status="AVAILABLE",
    )
    db.add(car)
    db.commit()
    db.refresh(car)
    car_id = car.id

    booking = BookingRequest(
        car_id=car.id,
        renter_id=renter.id,
        start_date=date.today() + timedelta(days=5),
        end_date=date.today() + timedelta(days=7),
        status="PENDING",
    )
    db.add(booking)
    db.commit()
    db.close()

    delete_res = test_client.delete(f"/cars/{car_id}")
    assert delete_res.status_code == 200, delete_res.text
    body = delete_res.json()
    assert body["ok"] is True
    assert body["deleted_id"] == car_id
    assert body["soft_deleted"] is True

    db = SessionLocal()
    archived = db.get(CarListing, car_id)
    assert archived is not None
    assert archived.status == "ARCHIVED"

    listing_res = test_client.get("/cars")
    assert listing_res.status_code == 200, listing_res.text
    listed_ids = {c["id"] for c in listing_res.json()["items"]}
    assert car_id not in listed_ids
    db.close()
