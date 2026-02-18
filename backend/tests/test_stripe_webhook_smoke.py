from datetime import date, timedelta

from app.config import settings
from app.main import app
from app.models.booking import BookingRequest
from app.models.car import CarListing
from app.models.payment import Payment
from app.models.user import User
import app.routers.payments as payments_router


def test_stripe_checkout_completed_webhook_sets_payment_held(client, monkeypatch):
    test_client, _ = client
    SessionLocal = app.state.test_sessionmaker
    renter_id = app.state.test_user_id

    db = SessionLocal()
    owner = User(
        email="owner5@example.com",
        password_hash="hashed",
        full_name="Owner Five",
        date_of_birth=date(1991, 1, 1),
        email_verified=True,
        is_active=True,
        role="USER",
    )
    db.add(owner)
    db.commit()
    db.refresh(owner)

    car = CarListing(
        owner_id=owner.id,
        make="BMW",
        model="3 Series",
        year=2022,
        daily_price=90,
        availability_units=1,
        city="Bristol",
        postcode="BS1",
        transmission="AUTOMATIC",
        fuel_type="PETROL",
        seats=5,
        doors=4,
        mileage=22000,
        color="Silver",
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
    booking_id = booking.id

    payment = Payment(
        booking_id=booking.id,
        renter_id=renter_id,
        owner_id=owner.id,
        currency="GBP",
        amount_total=270,
        platform_fee=27,
        payout_amount=243,
        status="PAYMENT_PENDING",
        provider="STRIPE",
        provider_ref="cs_test_123",
    )
    db.add(payment)
    db.commit()
    db.refresh(payment)
    payment_id = payment.id
    db.close()

    old_secret = settings.stripe_secret_key
    old_webhook = settings.stripe_webhook_secret
    settings.stripe_secret_key = "sk_test_dummy"
    settings.stripe_webhook_secret = "whsec_dummy"

    def fake_construct_event(payload, sig_header, secret):
        assert sig_header == "test_sig"
        assert secret == "whsec_dummy"
        return {
            "type": "checkout.session.completed",
            "data": {
                "object": {
                    "id": "cs_test_123",
                    "metadata": {
                        "payment_id": str(payment_id),
                        "booking_id": str(booking_id),
                    },
                }
            },
        }

    monkeypatch.setattr(payments_router.stripe.Webhook, "construct_event", fake_construct_event)

    try:
        res = test_client.post(
            "/payments/stripe/webhook",
            data="{}",
            headers={"stripe-signature": "test_sig", "content-type": "application/json"},
        )
        assert res.status_code == 200, res.text

        db = SessionLocal()
        updated = db.get(Payment, payment_id)
        assert updated is not None
        assert updated.status == "HELD_IN_ESCROW"
        assert updated.paid_at is not None
        db.close()
    finally:
        settings.stripe_secret_key = old_secret
        settings.stripe_webhook_secret = old_webhook
