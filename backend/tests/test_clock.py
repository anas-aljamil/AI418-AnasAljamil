"""The optional DEMO_NOW setting freezes the API clock for screenshots and demos."""

from datetime import datetime

import pytest

from app.config import get_settings
from app.core.clock import Clock, FixedClock, get_clock


@pytest.fixture
def fresh_clock():
    get_settings.cache_clear()
    get_clock.cache_clear()
    yield
    get_settings.cache_clear()
    get_clock.cache_clear()


def test_demo_now_freezes_the_clock_in_utc(fresh_clock, monkeypatch):
    monkeypatch.setenv("DEMO_NOW", "2026-10-05T10:00:00+03:00")
    clock = get_clock()
    assert isinstance(clock, FixedClock)
    assert clock.now() == datetime(2026, 10, 5, 7, 0)


def test_empty_demo_now_means_the_real_clock(fresh_clock, monkeypatch):
    monkeypatch.setenv("DEMO_NOW", "")
    assert type(get_clock()) is Clock
