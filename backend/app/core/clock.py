"""Time helpers. All business rules read "now" through get_clock() so tests can fix it.

Storage is naive UTC (MySQL DATETIME). Asia/Riyadh is a fixed UTC+03:00 with
no daylight saving time, so local conversions are a constant offset.
"""

from datetime import UTC, date, datetime, time, timedelta
from functools import lru_cache

RIYADH_OFFSET = timedelta(hours=3)


class Clock:
    """Returns the current time as naive UTC (the storage format)."""

    def now(self) -> datetime:
        return datetime.now(UTC).replace(tzinfo=None, microsecond=0)


class FixedClock(Clock):
    def __init__(self, at: datetime):
        self.at = at

    def now(self) -> datetime:
        return self.at


@lru_cache
def get_clock() -> Clock:
    """FastAPI dependency; tests override it with a FixedClock.

    DEMO_NOW in .env freezes the clock for screenshots and demos (empty = real time).
    """
    from app.config import get_settings  # deferred: config is loaded on first request

    demo_now = get_settings().demo_now
    if demo_now is None:
        return Clock()
    if demo_now.tzinfo is not None:
        demo_now = demo_now.astimezone(UTC).replace(tzinfo=None)
    return FixedClock(demo_now)


def to_riyadh(utc: datetime) -> datetime:
    return utc + RIYADH_OFFSET


def from_riyadh(local: datetime) -> datetime:
    return local - RIYADH_OFFSET


def riyadh_day_of_week(local: datetime | date) -> int:
    """0 = Sunday ... 6 = Saturday (Python's weekday() has Monday = 0)."""
    return (local.weekday() + 1) % 7


def riyadh_midnight_after(utc: datetime) -> datetime:
    """UTC instant of the Riyadh midnight that ends the local day containing `utc`."""
    local_day = to_riyadh(utc).date()
    return from_riyadh(datetime.combine(local_day + timedelta(days=1), time()))


def local_slot_to_utc(day: date, at: time) -> datetime:
    return from_riyadh(datetime.combine(day, at))


def to_aware_utc(naive_utc: datetime | None) -> datetime | None:
    return naive_utc.replace(tzinfo=UTC) if naive_utc else None


def to_naive_utc(aware: datetime) -> datetime:
    return aware.astimezone(UTC).replace(tzinfo=None, microsecond=0)
