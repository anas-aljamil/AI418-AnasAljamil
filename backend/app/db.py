"""Database engine and per-request session.

Every connection uses utf8mb4 / utf8mb4_0900_ai_ci and session time_zone
'+00:00', so DATETIME values are read and written as UTC.
"""

from collections.abc import Iterator
from functools import lru_cache

from sqlalchemy import Engine, create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.config import get_settings


def make_engine(database: str | None = None) -> Engine:
    settings = get_settings()
    return create_engine(
        settings.database_url(database),
        pool_pre_ping=True,
        pool_recycle=3600,
        connect_args={
            "init_command": "SET time_zone = '+00:00'",
            "collation": "utf8mb4_0900_ai_ci",
        },
    )


@lru_cache
def get_engine() -> Engine:
    return make_engine()


def get_db() -> Iterator[Session]:
    """FastAPI dependency: one session per request, rolled back on error."""
    session = sessionmaker(bind=get_engine(), expire_on_commit=False)()
    try:
        yield session
    finally:
        session.close()
