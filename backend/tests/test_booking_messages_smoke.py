from datetime import date, timedelta

from app.main import app
from app.models.booking import BookingRequest
from app.models.car import CarListing
from app.models.user import User


def test_booking_participants_can_exchange_messages(client):
    test_client, _ = client
    SessionLocal = app.state.test_sessionmaker
    renter_id = app.state.test_user_id

    db = SessionLocal()
    owner = User(
        email="owner2@example.com",
        password_hash="hashed",
        full_name="Owner Two",
        date_of_birth=date(1991, 1, 1),
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
        make="Honda",
        model="Civic",
        year=2021,
        daily_price=60,
        availability_units=1,
        city="Bristol",
        postcode="BS1",
        transmission="AUTOMATIC",
        fuel_type="PETROL",
        seats=5,
        doors=5,
        mileage=20000,
        color="Blue",
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
        start_date=date.today() - timedelta(days=3),
        end_date=date.today() - timedelta(days=1),
        status="APPROVED",
    )
    db.add(booking)
    db.commit()
    db.refresh(booking)
    db.close()

    send_res = test_client.post(
        f"/messages/booking/{booking.id}",
        json={"content": "Hi owner, thanks for the car."},
    )
    assert send_res.status_code == 200, send_res.text
    msg = send_res.json()
    assert msg["booking_id"] == booking.id
    assert msg["sender_id"] == renter_id
    assert msg["recipient_id"] == owner_id

    list_res = test_client.get(f"/messages/booking/{booking.id}")
    assert list_res.status_code == 200, list_res.text
    msgs = list_res.json()
    assert len(msgs) == 1
    assert msgs[0]["content"] == "Hi owner, thanks for the car."
