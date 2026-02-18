from datetime import date, timedelta
from types import SimpleNamespace

from app.deps import get_current_user
from app.main import app
from app.models.booking import BookingRequest
from app.models.car import CarListing
from app.models.payment import Payment
from app.models.user import User


def test_release_blocked_if_owner_not_connected_for_stripe_payment(client):
    test_client, _ = client
    SessionLocal = app.state.test_sessionmaker
    renter_id = app.state.test_user_id

    db = SessionLocal()
    owner = User(
        email="owner6@example.com",
        password_hash="hashed",
        full_name="Owner Six",
        date_of_birth=date(1991, 1, 1),
        email_verified=True,
        is_active=True,
        role="USER",
        stripe_account_id="acct_missing_onboard",
        stripe_account_onboarded=False,
    )
    db.add(owner)
    db.commit()
    db.refresh(owner)
    owner_id = owner.id

    car = CarListing(
        owner_id=owner.id,
        make="Audi",
        model="A4",
        year=2022,
        daily_price=95,
        availability_units=1,
        city="Bristol",
        postcode="BS1",
        transmission="AUTOMATIC",
        fuel_type="PETROL",
        seats=5,
        doors=4,
        mileage=12000,
        color="Grey",
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
    booking_id = booking.id

    payment = Payment(
        booking_id=booking.id,
        renter_id=renter_id,
        owner_id=owner.id,
        currency="GBP",
        amount_total=285,
        platform_fee=28,
        payout_amount=257,
        status="HELD_IN_ESCROW",
        provider="STRIPE",
        provider_ref="cs_test_missing_connect",
    )
    db.add(payment)
    db.commit()
    db.refresh(payment)
    db.close()

    def override_owner_user():
        return SimpleNamespace(
            id=owner_id,
            role="USER",
            email_verified=True,
            is_active=True,
        )

    app.dependency_overrides[get_current_user] = override_owner_user
    res = test_client.post(f"/payments/booking/{booking_id}/release")
    assert res.status_code == 400, res.text
    assert "not connected" in res.text.lower()
