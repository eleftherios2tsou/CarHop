from datetime import date, timedelta
from types import SimpleNamespace

from app.deps import get_current_user
from app.main import app
from app.models.booking import BookingRequest
from app.models.car import CarListing
from app.models.user import User


def test_escrow_payment_can_be_paid_and_released(client):
    test_client, _ = client
    SessionLocal = app.state.test_sessionmaker
    renter_id = app.state.test_user_id

    db = SessionLocal()
    owner = User(
        email="owner4@example.com",
        password_hash="hashed",
        full_name="Owner Four",
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
        make="Tesla",
        model="Model 3",
        year=2023,
        daily_price=100,
        availability_units=1,
        city="Bristol",
        postcode="BS1",
        transmission="AUTOMATIC",
        fuel_type="ELECTRIC",
        seats=5,
        doors=4,
        mileage=5000,
        color="Black",
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
        start_date=date.today() - timedelta(days=4),
        end_date=date.today() - timedelta(days=2),
        status="APPROVED",
    )
    db.add(booking)
    db.commit()
    db.refresh(booking)
    db.close()

    pay_res = test_client.post(f"/payments/booking/{booking.id}/pay")
    assert pay_res.status_code == 200, pay_res.text
    body = pay_res.json()
    assert body["checkout_url"] is None
    payment = body["payment"]
    assert payment["booking_id"] == booking.id
    assert payment["status"] == "HELD_IN_ESCROW"
    assert payment["amount_total"] == 300
    assert payment["platform_fee"] == 30
    assert payment["payout_amount"] == 270

    def override_owner_user():
        return SimpleNamespace(
            id=owner_id,
            role="USER",
            email_verified=True,
            is_active=True,
        )

    app.dependency_overrides[get_current_user] = override_owner_user
    release_res = test_client.post(f"/payments/booking/{booking.id}/release")
    assert release_res.status_code == 200, release_res.text
    released = release_res.json()
    assert released["status"] == "RELEASED_TO_OWNER"
    assert released["released_at"] is not None
