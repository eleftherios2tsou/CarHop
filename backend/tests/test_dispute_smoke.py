from datetime import date, timedelta

from app.main import app
from app.models.booking import BookingRequest
from app.models.car import CarListing
from app.models.user import User


def test_renter_can_open_dispute_for_non_pending_booking(client):
    test_client, _ = client
    SessionLocal = app.state.test_sessionmaker
    renter_id = app.state.test_user_id

    db = SessionLocal()
    owner = User(
        email="owner3@example.com",
        password_hash="hashed",
        full_name="Owner Three",
        date_of_birth=date(1992, 1, 1),
        email_verified=True,
        is_active=True,
        role="USER",
    )
    db.add(owner)
    db.commit()
    db.refresh(owner)
    owner_id = owner.id

    car = CarListing(
        owner_id=owner.id,
        make="Ford",
        model="Focus",
        year=2022,
        daily_price=70,
        availability_units=1,
        city="Bristol",
        postcode="BS1",
        transmission="MANUAL",
        fuel_type="PETROL",
        seats=5,
        doors=5,
        mileage=15000,
        color="White",
        description="Test car",
        features={"ac": True},
        status="AVAILABLE",
    )
    db.add(car)
    db.commit()
    db.refresh(car)

    booking = BookingRequest(
        car_id=car.id,
        renter_id=renter_id,
        start_date=date.today() - timedelta(days=2),
        end_date=date.today() - timedelta(days=1),
        status="APPROVED",
    )
    db.add(booking)
    db.commit()
    db.refresh(booking)
    db.close()

    create_res = test_client.post(
        f"/disputes/booking/{booking.id}",
        json={"reason": "Vehicle issue", "details": "Engine warning light appeared."},
    )
    assert create_res.status_code == 200, create_res.text
    dispute = create_res.json()
    assert dispute["booking_id"] == booking.id
    assert dispute["opened_by_user_id"] == renter_id
    assert dispute["against_user_id"] == owner_id
    assert dispute["status"] == "OPEN"

    fetch_res = test_client.get(f"/disputes/booking/{booking.id}")
    assert fetch_res.status_code == 200, fetch_res.text
    loaded = fetch_res.json()
    assert loaded["id"] == dispute["id"]
