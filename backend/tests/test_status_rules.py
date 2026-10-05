"""CLAUDE.md section 4: effective status, override expiry and staleness (pure function, no database)."""

from dataclasses import dataclass
from datetime import datetime, time, timedelta

from app.services.status import effective_status


@dataclass
class Block:
    kind: str
    day_of_week: int
    start_time: time
    end_time: time


@dataclass
class Override:
    status: str
    created_at: datetime
    expires_at: datetime | None = None
    note: str | None = None


# Monday 2026-10-05; Riyadh = UTC + 3.
MON_1000 = datetime(2026, 10, 5, 7, 0)  # 10:00 Riyadh
OFFICE_MON_9_TO_11 = Block("office_hours", 1, time(9), time(11))
CLASS_MON_11_TO_1230 = Block("class", 1, time(11), time(12, 30))
WEEK = [OFFICE_MON_9_TO_11, CLASS_MON_11_TO_1230]


def test_schedule_office_hours_block_means_in_office():
    result = effective_status(MON_1000, WEEK, Override("busy", MON_1000 - timedelta(hours=1), MON_1000))
    assert (result.status, result.source, result.schedule_status) == ("in_office", "schedule", "in_office")
    assert result.until == datetime(2026, 10, 5, 8, 0)  # block ends 11:00 Riyadh


def test_schedule_class_block_means_in_class():
    result = effective_status(MON_1000 + timedelta(hours=1, minutes=30), WEEK, None)
    assert (result.status, result.source) == ("in_class", "schedule")


def test_outside_all_blocks_means_away():
    result = effective_status(MON_1000 + timedelta(hours=5), WEEK, None)
    assert (result.status, result.confirmed) == ("away", True)


def test_friday_with_a_schedule_is_away():
    friday = datetime(2026, 10, 9, 7, 0)
    assert effective_status(friday, WEEK, None).status == "away"


def test_no_schedule_and_no_override_is_unknown():
    result = effective_status(MON_1000, [], None)
    assert (result.status, result.source, result.confirmed) == ("unknown", "none", False)


def test_active_override_beats_schedule():
    override = Override(
        "busy", MON_1000 - timedelta(minutes=5), MON_1000 + timedelta(minutes=10), "Back soon"
    )
    result = effective_status(MON_1000, WEEK, override)
    assert (result.status, result.source, result.note) == ("busy", "override", "Back soon")
    assert result.until == override.expires_at


def test_override_expires_at_return_time_and_falls_back_to_schedule():
    override = Override("away", MON_1000 - timedelta(minutes=30), MON_1000)
    assert effective_status(MON_1000 - timedelta(seconds=1), WEEK, override).status == "away"
    assert effective_status(MON_1000, WEEK, override).status == "in_office"  # expiry instant: schedule again


def test_override_without_return_time_ends_at_riyadh_midnight():
    set_at = MON_1000
    override = Override("away", set_at)
    riyadh_midnight = datetime(2026, 10, 5, 21, 0)  # 00:00 Tuesday in Riyadh
    assert effective_status(riyadh_midnight - timedelta(seconds=1), [], override).status == "away"
    assert effective_status(riyadh_midnight, [], override).status == "unknown"


def test_newer_override_replaces_older_even_after_it_expires():
    # Only the latest override is passed in: once it expires, status returns to the schedule.
    newest = Override("busy", MON_1000 - timedelta(minutes=20), MON_1000 - timedelta(minutes=5))
    assert effective_status(MON_1000, WEEK, newest).status == "in_office"


def test_stale_office_status_is_not_confirmed_after_more_than_4_hours():
    last_update = Override("busy", MON_1000 - timedelta(hours=4, seconds=1), MON_1000 - timedelta(hours=3))
    result = effective_status(MON_1000, WEEK, last_update)
    assert (result.status, result.confirmed) == ("in_office", False)
    assert result.updated_at == last_update.created_at


def test_office_status_exactly_4_hours_old_is_still_confirmed():
    last_update = Override("busy", MON_1000 - timedelta(hours=4), MON_1000 - timedelta(hours=3))
    assert effective_status(MON_1000, WEEK, last_update).confirmed is True


def test_office_status_never_updated_by_hand_is_not_confirmed():
    result = effective_status(MON_1000, WEEK, None)
    assert (result.status, result.confirmed, result.updated_at) == ("in_office", False, None)


def test_recent_manual_in_office_is_confirmed():
    override = Override("in_office", MON_1000 - timedelta(minutes=10))
    assert effective_status(MON_1000, WEEK, override).confirmed is True


def test_staleness_only_applies_to_in_office():
    result = effective_status(MON_1000 + timedelta(hours=1, minutes=30), WEEK, None)
    assert (result.status, result.confirmed) == ("in_class", True)
