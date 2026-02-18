from datetime import date, timedelta
from types import SimpleNamespace

from app.config import settings
from app.deps import get_current_user
from app.main import app
from app.models.booking import BookingRequest
from app.models.car import CarListing
from app.models.payment import Payment
from app.models.stripe_webhook_event import StripeWebhookEvent
from app.models.user import User
import app.routers.payments as payments_router


def _seed_booking_and_payment(session_local, renter_id: int, provider_ref: str) -> tuple[int, int]:
    db = session_local()
    owner = User(
        email=f"owner_ops_{provider_ref}@example.com",
        password_hash="hashed",
        full_name="Owner Ops",
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
        make="VW",
        model="Golf",
        year=2022,
        daily_price=80,
        availability_units=1,
        city="Bristol",
        postcode="BS1",
        transmission="AUTOMATIC",
        fuel_type="PETROL",
        seats=5,
        doors=4,
        mileage=12000,
        color="Blue",
        description="Ops test car",
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

    payment = Payment(
        booking_id=booking.id,
        renter_id=renter_id,
        owner_id=owner.id,
        currency="GBP",
        amount_total=160,
        platform_fee=16,
        payout_amount=144,
        status="PAYMENT_PENDING",
        provider="STRIPE",
        provider_ref=provider_ref,
    )
    db.add(payment)
    db.commit()
    db.refresh(payment)
    payment_id = payment.id
    booking_id = booking.id
    db.close()
    return payment_id, booking_id


def test_webhook_replay_is_deduplicated(client, monkeypatch):
    test_client, _ = client
    SessionLocal = app.state.test_sessionmaker
    renter_id = app.state.test_user_id
    payment_id, booking_id = _seed_booking_and_payment(SessionLocal, renter_id, "cs_test_dup_1")

    old_secret = settings.stripe_secret_key
    old_webhook = settings.stripe_webhook_secret
    settings.stripe_secret_key = "sk_test_dummy"
    settings.stripe_webhook_secret = "whsec_dummy"

    def fake_construct_event(payload, sig_header, secret):
        return {
            "id": "evt_dup_1",
            "type": "checkout.session.completed",
            "data": {
                "object": {
                    "id": "cs_test_dup_1",
                    "payment_intent": "pi_dup_1",
                    "metadata": {
                        "payment_id": str(payment_id),
                        "booking_id": str(booking_id),
                    },
                }
            },
        }

    monkeypatch.setattr(payments_router.stripe.Webhook, "construct_event", fake_construct_event)

    try:
        r1 = test_client.post(
            "/payments/stripe/webhook",
            data="{}",
            headers={"stripe-signature": "sig", "content-type": "application/json"},
        )
        r2 = test_client.post(
            "/payments/stripe/webhook",
            data="{}",
            headers={"stripe-signature": "sig", "content-type": "application/json"},
        )
        assert r1.status_code == 200, r1.text
        assert r2.status_code == 200, r2.text
        assert r2.json().get("duplicate") is True

        db = SessionLocal()
        events = db.query(StripeWebhookEvent).filter(StripeWebhookEvent.event_id == "evt_dup_1").all()
        payment = db.get(Payment, payment_id)
        assert len(events) == 1
        assert payment is not None
        assert payment.status == "HELD_IN_ESCROW"
        db.close()
    finally:
        settings.stripe_secret_key = old_secret
        settings.stripe_webhook_secret = old_webhook


def test_admin_can_reconcile_pending_stripe_payment(client, monkeypatch):
    test_client, _ = client
    SessionLocal = app.state.test_sessionmaker
    renter_id = app.state.test_user_id
    payment_id, _ = _seed_booking_and_payment(SessionLocal, renter_id, "cs_test_reconcile_1")

    old_secret = settings.stripe_secret_key
    settings.stripe_secret_key = "sk_test_dummy"

    def fake_retrieve(session_id, expand=None):
        assert session_id == "cs_test_reconcile_1"
        return {
            "id": session_id,
            "status": "complete",
            "payment_status": "paid",
            "payment_intent": {
                "id": "pi_reconcile_1",
                "latest_charge": {"id": "ch_reconcile_1"},
            },
        }

    monkeypatch.setattr(payments_router.stripe.checkout.Session, "retrieve", fake_retrieve)

    def override_admin():
        return SimpleNamespace(id=renter_id, role="ADMIN", email_verified=True, is_active=True)

    app.dependency_overrides[get_current_user] = override_admin
    try:
        res = test_client.post("/payments/reconcile/pending")
        assert res.status_code == 200, res.text
        body = res.json()
        assert body["checked"] >= 1
        assert body["reconciled_paid"] >= 1

        db = SessionLocal()
        payment = db.get(Payment, payment_id)
        assert payment is not None
        assert payment.status == "HELD_IN_ESCROW"
        assert payment.stripe_payment_intent_id == "pi_reconcile_1"
        assert payment.stripe_charge_id == "ch_reconcile_1"
        db.close()
    finally:
        app.dependency_overrides.pop(get_current_user, None)
        settings.stripe_secret_key = old_secret
