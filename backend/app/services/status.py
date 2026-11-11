"""Effective professor status (CLAUDE.md section 4).

    effective status = active manual override > schedule-derived status > unknown

* An override is active from created_at until expires_at; without a return time
  it ends at the next Riyadh midnight. Only the latest override counts: a newer
  update replaces an older one even after the newer one expires.
* Schedule: inside an office_hours block -> in_office, inside a class block ->
  in_class, outside every block -> away; a professor with no blocks -> unknown.
* Staleness: when the schedule says in_office, the result is in_office, and the
  last manual update is older than 4 hours (or never happened), the status is
  reported as not confirmed.
"""

from dataclasses import dataclass
from datetime import datetime, time, timedelta
from typing import Protocol

from app.core.clock import from_riyadh, riyadh_day_of_week, riyadh_midnight_after, to_riyadh

STALE_AFTER = timedelta(hours=4)


class BlockLike(Protocol):
    kind: str
    day_of_week: int
    start_time: time
    end_time: time


class OverrideLike(Protocol):
    status: str
    note: str | None
    created_at: datetime
    expires_at: datetime | None


@dataclass(frozen=True)
class EffectiveStatus:
    status: str  # in_office | in_class | busy | away | unknown
    confirmed: bool
    source: str  # override | schedule | none
    note: str | None
    until: datetime | None  # when this status is expected to change (naive UTC)
    updated_at: datetime | None  # last manual update (naive UTC)
    schedule_status: str  # what the timetable alone says right now


def override_end(override: OverrideLike) -> datetime:
    return override.expires_at or riyadh_midnight_after(override.created_at)


def current_block(blocks: list[BlockLike], now: datetime) -> BlockLike | None:
    local = to_riyadh(now)
    day, clock_time = riyadh_day_of_week(local), local.time()
    return next((b for b in blocks if b.day_of_week == day and b.start_time <= clock_time < b.end_time), None)


def schedule_status(blocks: list[BlockLike], now: datetime) -> str:
    if not blocks:
        return "unknown"
    block = current_block(blocks, now)
    if block is None:
        return "away"
    return "in_office" if block.kind == "office_hours" else "in_class"


def effective_status(
    now: datetime, blocks: list[BlockLike], latest_override: OverrideLike | None
) -> EffectiveStatus:
    """latest_override: the professor's most recent override created at or before now."""
    from_schedule = schedule_status(blocks, now)
    updated_at = latest_override.created_at if latest_override else None

    if latest_override and latest_override.created_at <= now < override_end(latest_override):
        status, source = latest_override.status, "override"
        note, until = latest_override.note, override_end(latest_override)
    else:
        status, source, note = from_schedule, ("schedule" if blocks else "none"), None
        block = current_block(blocks, now)
        until = from_riyadh(datetime.combine(to_riyadh(now).date(), block.end_time)) if block else None

    stale = updated_at is None or now - updated_at > STALE_AFTER
    unconfirmed_office = status == "in_office" and from_schedule == "in_office" and stale
    confirmed = status != "unknown" and not unconfirmed_office
    return EffectiveStatus(status, confirmed, source, note, until, updated_at, from_schedule)
