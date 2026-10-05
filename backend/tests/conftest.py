"""Test fixtures: a real MySQL database, one rolled-back transaction per test, a fixed clock.

The session-scoped database <DB_NAME>_test is built once from db/schema.sql and
db/seed.sql (same loader as scripts/reset_db.py), so tests run against the
real constraints and triggers. Each test runs inside an outer transaction that
is rolled back afterwards; every request gets its own session on a savepoint.
"""

import os
import sys
from datetime import datetime
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

REPO = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO / "scripts"))
os.environ.setdefault("JWT_SECRET", "test-only-secret-that-is-long-enough-for-hs256")

import mysql_cli  # noqa: E402
import reset_db  # noqa: E402

from app.api.v1.auth import login_limiter  # noqa: E402
from app.core.clock import FixedClock, get_clock  # noqa: E402
from app.db import get_db, make_engine  # noqa: E402
from app.main import create_app  # noqa: E402

DEMO_PASSWORD = "Mawjood-Demo-2026"
# Monday 2026-10-05, 10:00 in Riyadh (07:00 UTC): the seed's anchor week.
DEFAULT_NOW = datetime(2026, 10, 5, 7, 0)

# Seed accounts (db/seed.sql).
NORA, KHALID, HUDA, OMAR, HELEN, FAISAL, REEM, TARIQ = range(1, 9)
SAAD, LAMA, YOUSEF, MAHA, ZIYAD, SARAH, HESSA = range(9, 16)
EMAILS = {
    NORA: "n.alharbi@university.example",
    KHALID: "k.alotaibi@university.example",
    HUDA: "h.alqahtani@university.example",
    OMAR: "o.binsalem@university.example",
    HELEN: "h.marsh@university.example",
    REEM: "r.aldosari@university.example",
    SAAD: "s.almutairi@university.example",
    LAMA: "l.alshehri@university.example",
    YOUSEF: "y.alghamdi@university.example",
    MAHA: "m.alanazi@university.example",
    ZIYAD: "z.alshammari@university.example",
    HESSA: "h.almansour@university.example",
}
ADMIN_EMAIL = "admin@university.example"


@pytest.fixture(scope="session")
def engine():
    config = mysql_cli.load_config()
    test_db = f"{config.database}_test"
    warnings = reset_db.build(config, test_db)
    assert not warnings, warnings
    engine = make_engine(test_db)
    yield engine
    engine.dispose()
    mysql_cli.run(f"DROP DATABASE IF EXISTS `{test_db}`", config)


@pytest.fixture
def connection(engine):
    connection = engine.connect()
    transaction = connection.begin()
    yield connection
    transaction.rollback()
    connection.close()


def _session(connection) -> Session:
    return Session(bind=connection, join_transaction_mode="create_savepoint", expire_on_commit=False)


@pytest.fixture
def db(connection):
    """A session for arranging data and asserting on the database directly."""
    session = _session(connection)
    yield session
    session.close()


@pytest.fixture
def clock():
    return FixedClock(DEFAULT_NOW)


@pytest.fixture
def client(connection, clock):
    app = create_app()

    def test_db():
        session = _session(connection)
        try:
            yield session
        finally:
            session.close()

    app.dependency_overrides[get_db] = test_db
    app.dependency_overrides[get_clock] = lambda: clock
    login_limiter.reset()
    return TestClient(app)


def login(client: TestClient, email: str, kind: str = "native") -> dict:
    response = client.post(
        "/api/v1/auth/login", json={"email": email, "password": DEMO_PASSWORD, "client": kind}
    )
    assert response.status_code == 200, response.text
    return response.json()


@pytest.fixture
def auth(client, clock):
    """auth(user_id or email) -> Authorization headers for that seed account.

    Tokens are cached per clock reading, so a test that moves the clock signs in
    again instead of reusing a token that has (correctly) expired.
    """
    cache: dict[tuple[str, datetime], dict] = {}

    def headers_for(who: int | str) -> dict:
        email = EMAILS[who] if isinstance(who, int) else who
        key = (email, clock.at)
        if key not in cache:
            cache[key] = {"Authorization": f"Bearer {login(client, email)['access_token']}"}
        return cache[key]

    return headers_for
