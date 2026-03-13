"""
Unit tests for booking business logic:
- _compute_refund_pct: pure function, no DB needed
- approved_overlap_exists: tested via the booking approve endpoint
- State transition guards: cancel/approve/reject from invalid states
- _auto_complete_past_bookings: APPROVED bookings past their end_date become COMPLETED
"""
from datetime import date, timedelta

import pytest

from app.routers.bookings import _compute_refund_pct
from app.main import app
from app.models.booking import BookingRequest
from app.models.car import CarListing
from app.models.user import User


# ── _compute_refund_pct ──────────────────────────────────────────────────────

class TestComputeRefundPct:
    def test_flexible_full_refund_at_24h(self):
        assert _compute_refund_pct("FLEXIBLE", 24) == 100

    def test_flexible_full_refund_above_24h(self):
        assert _compute_refund_pct("FLEXIBLE", 48) == 100

    def test_flexible_no_refund_below_24h(self):
        assert _compute_refund_pct("FLEXIBLE", 23) == 0

    def test_flexible_no_refund_at_zero(self):
        assert _compute_refund_pct("FLEXIBLE", 0) == 0

    def test_moderate_full_refund_at_5_days(self):
        assert _compute_refund_pct("MODERATE", 5 * 24) == 100

    def test_moderate_full_refund_above_5_days(self):
        assert _compute_refund_pct("MODERATE", 6 * 24) == 100

    def test_moderate_half_refund_between_1_and_5_days(self):
        assert _compute_refund_pct("MODERATE", 2 * 24) == 50

    def test_moderate_half_refund_at_exactly_24h(self):
        assert _compute_refund_pct("MODERATE", 24) == 50

    def test_moderate_no_refund_below_24h(self):
        assert _compute_refund_pct("MODERATE", 12) == 0

    def test_strict_full_refund_at_7_days(self):
        assert _compute_refund_pct("STRICT", 7 * 24) == 100

    def test_strict_full_refund_above_7_days(self):
        assert _compute_refund_pct("STRICT", 8 * 24) == 100

    def test_strict_half_refund_between_2_and_7_days(self):
        assert _compute_refund_pct("STRICT", 3 * 24) == 50

    def test_strict_half_refund_at_exactly_2_days(self):
        assert _compute_refund_pct("STRICT", 2 * 24) == 50

    def test_strict_no_refund_below_2_days(self):
        assert _compute_refund_pct("STRICT", 24) == 0

    def test_strict_no_refund_at_zero(self):
        assert _compute_refund_pct("STRICT", 0) == 0

    def test_unknown_policy_defaults_to_full_refund(self):
        assert _compute_refund_pct("UNKNOWN", 0) == 100


# ── Helpers ──────────────────────────────────────────────────────────────────

def _make_car(db, owner_id):
    car = CarListing(
        owner_id=owner_id,
        make="Honda",
        model="Civic",
        year=2021,
        daily_price=50,
        availability_units=1,
        city="Bristol",
        postcode="BS2",
        transmission="MANUAL",
        fuel_type="PETROL",
        seats=5,
        doors=5,
        mileage=10000,
        color="Blue",
        description="Test",
        features={},
        status="AVAILABLE",
    )
    db.add(car)
    db.commit()
    db.refresh(car)
    return car


def _make_renter(db, suffix=""):
    renter = User(
        email=f"renter{suffix}@example.com",
        password_hash="hashed",
        full_name=f"Renter{suffix}",
        date_of_birth=date(1995, 5, 5),
        email_verified=True,
        is_active=True,
        role="USER",
    )
    db.add(renter)
    db.commit()
    db.refresh(renter)
    return renter


# ── State transition guards ──────────────────────────────────────────────────

class TestCancelGuards:
    def test_cannot_cancel_completed_booking(self, client):
        test_client, _ = client
        db = app.state.test_sessionmaker()
        owner_id = app.state.test_user_id
        car = _make_car(db, owner_id)
        renter = _make_renter(db, "cancel1")

        booking = BookingRequest(
            car_id=car.id,
            renter_id=renter.id,
            start_date=date.today() - timedelta(days=5),
            end_date=date.today() - timedelta(days=3),
            status="COMPLETED",
        )
        db.add(booking)
        db.commit()
        db.refresh(booking)
        db.close()

        # Override current user to be the renter
        from app.deps import get_current_user
        from types import SimpleNamespace
        app.dependency_overrides[get_current_user] = lambda: SimpleNamespace(
            id=renter.id, role="USER", email_verified=True, is_active=True, full_name="Renter"
        )
        res = test_client.post(f"/bookings/{booking.id}/cancel")
        assert res.status_code == 400
        assert "Cannot cancel" in res.json()["detail"]

    def test_cannot_cancel_rejected_booking(self, client):
        test_client, _ = client
        db = app.state.test_sessionmaker()
        owner_id = app.state.test_user_id
        car = _make_car(db, owner_id)
        renter = _make_renter(db, "cancel2")

        booking = BookingRequest(
            car_id=car.id,
            renter_id=renter.id,
            start_date=date.today() + timedelta(days=3),
            end_date=date.today() + timedelta(days=5),
            status="REJECTED",
        )
        db.add(booking)
        db.commit()
        db.refresh(booking)
        db.close()

        from app.deps import get_current_user
        from types import SimpleNamespace
        app.dependency_overrides[get_current_user] = lambda: SimpleNamespace(
            id=renter.id, role="USER", email_verified=True, is_active=True, full_name="Renter"
        )
        res = test_client.post(f"/bookings/{booking.id}/cancel")
        assert res.status_code == 400

    def test_cannot_cancel_approved_booking_that_has_started(self, client):
        test_client, _ = client
        db = app.state.test_sessionmaker()
        owner_id = app.state.test_user_id
        car = _make_car(db, owner_id)
        renter = _make_renter(db, "cancel3")

        booking = BookingRequest(
            car_id=car.id,
            renter_id=renter.id,
            start_date=date.today() - timedelta(days=1),
            end_date=date.today() + timedelta(days=2),
            status="APPROVED",
        )
        db.add(booking)
        db.commit()
        db.refresh(booking)
        db.close()

        from app.deps import get_current_user
        from types import SimpleNamespace
        app.dependency_overrides[get_current_user] = lambda: SimpleNamespace(
            id=renter.id, role="USER", email_verified=True, is_active=True, full_name="Renter"
        )
        res = test_client.post(f"/bookings/{booking.id}/cancel")
        assert res.status_code == 400
        assert "Cannot cancel after the booking has started" in res.json()["detail"]

    def test_can_cancel_pending_booking(self, client):
        test_client, _ = client
        db = app.state.test_sessionmaker()
        owner_id = app.state.test_user_id
        car = _make_car(db, owner_id)
        renter = _make_renter(db, "cancel4")

        booking = BookingRequest(
            car_id=car.id,
            renter_id=renter.id,
            start_date=date.today() + timedelta(days=3),
            end_date=date.today() + timedelta(days=5),
            status="PENDING",
        )
        db.add(booking)
        db.commit()
        db.refresh(booking)
        db.close()

        from app.deps import get_current_user
        from types import SimpleNamespace
        app.dependency_overrides[get_current_user] = lambda: SimpleNamespace(
            id=renter.id, role="USER", email_verified=True, is_active=True, full_name="Renter"
        )
        res = test_client.post(f"/bookings/{booking.id}/cancel")
        assert res.status_code == 200
        assert res.json()["status"] == "CANCELLED"


class TestApproveRejectGuards:
    def test_cannot_approve_already_approved_booking(self, client):
        test_client, _ = client
        db = app.state.test_sessionmaker()
        owner_id = app.state.test_user_id
        car = _make_car(db, owner_id)
        renter = _make_renter(db, "approve1")

        booking = BookingRequest(
            car_id=car.id,
            renter_id=renter.id,
            start_date=date.today() + timedelta(days=2),
            end_date=date.today() + timedelta(days=4),
            status="APPROVED",
        )
        db.add(booking)
        db.commit()
        db.refresh(booking)
        db.close()

        res = test_client.post(f"/bookings/{booking.id}/approve")
        assert res.status_code == 400
        assert "not pending" in res.json()["detail"].lower()

    def test_cannot_approve_cancelled_booking(self, client):
        test_client, _ = client
        db = app.state.test_sessionmaker()
        owner_id = app.state.test_user_id
        car = _make_car(db, owner_id)
        renter = _make_renter(db, "approve2")

        booking = BookingRequest(
            car_id=car.id,
            renter_id=renter.id,
            start_date=date.today() + timedelta(days=2),
            end_date=date.today() + timedelta(days=4),
            status="CANCELLED",
        )
        db.add(booking)
        db.commit()
        db.refresh(booking)
        db.close()

        res = test_client.post(f"/bookings/{booking.id}/approve")
        assert res.status_code == 400

    def test_cannot_reject_already_approved_booking(self, client):
        test_client, _ = client
        db = app.state.test_sessionmaker()
        owner_id = app.state.test_user_id
        car = _make_car(db, owner_id)
        renter = _make_renter(db, "reject1")

        booking = BookingRequest(
            car_id=car.id,
            renter_id=renter.id,
            start_date=date.today() + timedelta(days=2),
            end_date=date.today() + timedelta(days=4),
            status="APPROVED",
        )
        db.add(booking)
        db.commit()
        db.refresh(booking)
        db.close()

        res = test_client.post(f"/bookings/{booking.id}/reject")
        assert res.status_code == 400
        assert "not pending" in res.json()["detail"].lower()


# ── Availability overlap ─────────────────────────────────────────────────────

class TestApprovedOverlap:
    def test_cannot_approve_overlapping_booking(self, client):
        """Two bookings for the same car on overlapping dates: second approve must fail."""
        test_client, _ = client
        db = app.state.test_sessionmaker()
        owner_id = app.state.test_user_id
        car = _make_car(db, owner_id)
        renter1 = _make_renter(db, "ov1")
        renter2 = _make_renter(db, "ov2")

        start = date.today() + timedelta(days=3)
        end = date.today() + timedelta(days=6)

        b1 = BookingRequest(
            car_id=car.id, renter_id=renter1.id,
            start_date=start, end_date=end, status="PENDING",
        )
        b2 = BookingRequest(
            car_id=car.id, renter_id=renter2.id,
            start_date=start, end_date=end, status="PENDING",
        )
        db.add(b1)
        db.add(b2)
        db.commit()
        db.refresh(b1)
        db.refresh(b2)
        db.close()

        # Approve first booking
        res1 = test_client.post(f"/bookings/{b1.id}/approve")
        assert res1.status_code == 200, res1.text

        # Approving second (same dates) must fail
        res2 = test_client.post(f"/bookings/{b2.id}/approve")
        assert res2.status_code == 400
        assert "overlaps" in res2.json()["detail"].lower()

    def test_non_overlapping_bookings_can_both_be_approved(self, client):
        """Bookings on adjacent but non-overlapping dates both approve successfully."""
        test_client, _ = client
        db = app.state.test_sessionmaker()
        owner_id = app.state.test_user_id
        car = _make_car(db, owner_id)
        renter1 = _make_renter(db, "nov1")
        renter2 = _make_renter(db, "nov2")

        b1 = BookingRequest(
            car_id=car.id, renter_id=renter1.id,
            start_date=date.today() + timedelta(days=2),
            end_date=date.today() + timedelta(days=4),
            status="PENDING",
        )
        b2 = BookingRequest(
            car_id=car.id, renter_id=renter2.id,
            start_date=date.today() + timedelta(days=5),
            end_date=date.today() + timedelta(days=7),
            status="PENDING",
        )
        db.add(b1)
        db.add(b2)
        db.commit()
        db.refresh(b1)
        db.refresh(b2)
        db.close()

        assert test_client.post(f"/bookings/{b1.id}/approve").status_code == 200
        assert test_client.post(f"/bookings/{b2.id}/approve").status_code == 200


# ── Auto-complete past bookings ──────────────────────────────────────────────

class TestAutoComplete:
    def test_approved_booking_past_end_date_completes_on_fetch(self, client):
        """When my_bookings is fetched, APPROVED bookings with end_date in the past
        are automatically transitioned to COMPLETED."""
        test_client, _ = client
        db = app.state.test_sessionmaker()
        owner_id = app.state.test_user_id
        car = _make_car(db, owner_id)

        booking = BookingRequest(
            car_id=car.id,
            renter_id=owner_id,
            start_date=date.today() - timedelta(days=5),
            end_date=date.today() - timedelta(days=1),
            status="APPROVED",
        )
        db.add(booking)
        db.commit()
        db.refresh(booking)
        bid = booking.id
        db.close()

        res = test_client.get("/bookings/mine")
        assert res.status_code == 200
        items = res.json()["items"]
        match = next((b for b in items if b["id"] == bid), None)
        assert match is not None
        assert match["status"] == "COMPLETED"
