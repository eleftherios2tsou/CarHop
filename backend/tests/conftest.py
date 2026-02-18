import os
from datetime import date
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

os.environ.setdefault("DATABASE_URL", "sqlite+pysqlite:///:memory:")
os.environ.setdefault("UPLOADS_DIR", "/tmp/uploads")

from app.config import settings
from app.database import Base
from app.deps import csrf_protect, get_current_user, get_db
from app.main import app
from app.models import BookingRequest, CarListing, CarPhoto, Message, Review, User  # noqa: F401


@pytest.fixture()
def client(tmp_path):
    engine = create_engine(
        "sqlite+pysqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    TestingSessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)
    Base.metadata.create_all(bind=engine)

    db = TestingSessionLocal()
    user = User(
        email="owner@example.com",
        password_hash="hashed",
        full_name="Owner User",
        date_of_birth=date(1990, 1, 1),
        email_verified=True,
        is_active=True,
        role="USER",
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    user_id = user.id
    db.close()

    settings.uploads_dir = str(tmp_path)
    settings.storage_backend = "local"

    def override_get_db():
        session = TestingSessionLocal()
        try:
            yield session
        finally:
            session.close()

    def override_get_current_user():
        return SimpleNamespace(
            id=user_id,
            role="USER",
            email_verified=True,
            is_active=True,
        )

    def override_csrf_protect():
        return None

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = override_get_current_user
    app.dependency_overrides[csrf_protect] = override_csrf_protect
    app.state.test_sessionmaker = TestingSessionLocal
    app.state.test_user_id = user_id

    with TestClient(app) as test_client:
        yield test_client, tmp_path

    app.dependency_overrides.clear()
    app.state.test_sessionmaker = None
    app.state.test_user_id = None
    Base.metadata.drop_all(bind=engine)
