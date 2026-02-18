from app.deps import get_current_user
from app.config import settings
from app.main import app
from app.models.user import User
import app.routers.profile as profile_router


def test_profile_payout_onboarding_returns_link_and_stores_account(client, monkeypatch):
    test_client, _ = client
    SessionLocal = app.state.test_sessionmaker
    user_id = app.state.test_user_id

    old_secret = settings.stripe_secret_key
    settings.stripe_secret_key = "sk_test_dummy"

    class DummyAccount:
        id = "acct_test_123"

    class DummyLink:
        url = "https://connect.stripe.com/setup/test"

    monkeypatch.setattr(profile_router.stripe.Account, "create", lambda **kwargs: DummyAccount())
    monkeypatch.setattr(profile_router.stripe.AccountLink, "create", lambda **kwargs: DummyLink())

    def override_current_user():
        db = SessionLocal()
        try:
            return db.get(User, user_id)
        finally:
            db.close()

    app.dependency_overrides[get_current_user] = override_current_user

    try:
        res = test_client.post("/profile/payout/onboard")
        assert res.status_code == 200, res.text
        body = res.json()
        assert body["url"] == "https://connect.stripe.com/setup/test"
        assert body["account_id"] == "acct_test_123"

        db = SessionLocal()
        user = db.get(User, user_id)
        assert user is not None
        assert user.stripe_account_id == "acct_test_123"
        assert user.stripe_account_onboarded is False
        db.close()
    finally:
        app.dependency_overrides.pop(get_current_user, None)
        settings.stripe_secret_key = old_secret
