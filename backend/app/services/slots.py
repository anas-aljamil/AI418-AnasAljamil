"""Bookable slots: office_hours blocks cut into the professor's slot length."""

from dataclasses import dataclass
from datetime import date, datetime, time, timedelta

from app.core.clock import from_riyadh, riyadh_day_of_week, to_riyadh
from app.services.status import BlockLike


@dataclass(frozen=True)
class Slot:
    starts_at: datetime  # naive UTC
    ends_at: datetime
    local_time: time
    available: bool
    reason: str | None  # "past" | "taken" when not available


def booking_window_end(now: datetime) -> datetime:
    """Bookings are open for this week and next (DESIGN.md 7.5 day strip):
    up to the Riyadh midnight that starts the Sunday after next."""
    local_today = to_riyadh(now).date()
    this_sunday = local_today - timedelta(days=riyadh_day_of_week(local_today))
    return from_riyadh(datetime.combine(this_sunday + timedelta(days=14), time()))


def find_block(blocks: list[BlockLike], starts_at: datetime, slot_minutes: int) -> BlockLike | None:
    """The office_hours block in which starts_at begins a whole slot on the grid, if any."""
    local = to_riyadh(starts_at)
    if local.second or local.microsecond:
        return None
    day, start = riyadh_day_of_week(local), local.time()
    end = (local + timedelta(minutes=slot_minutes)).time()
    for block in blocks:
        if block.kind != "office_hours" or block.day_of_week != day:
            continue
        offset = datetime.combine(local.date(), start) - datetime.combine(local.date(), block.start_time)
        if (
            block.start_time <= start
            and end <= block.end_time
            and end > start
            and offset % timedelta(minutes=slot_minutes) == timedelta(0)
        ):
            return block
    return None


def day_slots(
    blocks: list[BlockLike],
    slot_minutes: int,
    day: date,
    now: datetime,
    busy: list[tuple[datetime, datetime]],
) -> list[Slot]:
    """All slots on a Riyadh-local day; busy holds active appointments (UTC ranges)."""
    length = timedelta(minutes=slot_minutes)
    slots = []
    for block in sorted(blocks, key=lambda b: b.start_time):
        if block.kind != "office_hours" or block.day_of_week != riyadh_day_of_week(day):
            continue
        local = datetime.combine(day, block.start_time)
        block_end = datetime.combine(day, block.end_time)
        while local + length <= block_end:
            start = from_riyadh(local)
            end = start + length
            if start <= now:
                reason = "past"
            elif any(b_start < end and start < b_end for b_start, b_end in busy):
                reason = "taken"
            else:
                reason = None
            slots.append(Slot(start, end, local.time(), reason is None, reason))
            local += length
    return slots
