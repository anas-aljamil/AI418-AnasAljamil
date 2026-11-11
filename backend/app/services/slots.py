"""Bookable times: any start on a 5-minute grid inside an office_hours block, with any
length in 5-minute steps that stays inside the block and clear of other bookings."""

from dataclasses import dataclass
from datetime import date, datetime, time, timedelta

from app.core.clock import from_riyadh, riyadh_day_of_week, to_riyadh
from app.services.status import BlockLike


@dataclass(frozen=True)
class Slot:
    starts_at: datetime  # naive UTC
    local_time: time
    available: bool
    reason: str | None  # "past" | "taken" when not available
    max_minutes: int  # longest appointment that can start here (0 when not available)


def booking_window_end(now: datetime) -> datetime:
    """Bookings are open for this week and next (DESIGN.md 7.5 day strip):
    up to the Riyadh midnight that starts the Sunday after next."""
    local_today = to_riyadh(now).date()
    this_sunday = local_today - timedelta(days=riyadh_day_of_week(local_today))
    return from_riyadh(datetime.combine(this_sunday + timedelta(days=14), time()))


STEP = timedelta(minutes=5)  # starts and lengths move in 5-minute steps


def on_grid(local: datetime) -> bool:
    return local.second == 0 and local.microsecond == 0 and local.minute % 5 == 0


def find_block(blocks: list[BlockLike], starts_at: datetime, minutes: int) -> BlockLike | None:
    """The office_hours block that holds the whole appointment [starts_at, + minutes), if any.
    The start must be on the 5-minute grid and the length a whole number of 5-minute steps."""
    local = to_riyadh(starts_at)
    length = timedelta(minutes=minutes)
    if not on_grid(local) or length <= timedelta(0) or length % STEP:
        return None
    day, start, end = riyadh_day_of_week(local), local, local + length
    for block in blocks:
        if block.kind != "office_hours" or block.day_of_week != day:
            continue
        block_start = datetime.combine(local.date(), block.start_time)
        block_end = datetime.combine(local.date(), block.end_time)
        if block_start <= start and end <= block_end:
            return block
    return None


def day_slots(
    blocks: list[BlockLike],
    day: date,
    now: datetime,
    busy: list[tuple[datetime, datetime]],
) -> list[Slot]:
    """Every 5-minute start in the day's office hours (Riyadh-local day). busy holds the
    active appointments (UTC ranges). max_minutes is the longest appointment that can start
    there: up to the next booking or the end of the office-hours block."""
    slots = []
    for block in sorted(blocks, key=lambda b: b.start_time):
        if block.kind != "office_hours" or block.day_of_week != riyadh_day_of_week(day):
            continue
        local = datetime.combine(day, block.start_time)
        block_end = from_riyadh(datetime.combine(day, block.end_time))
        while from_riyadh(local) + STEP <= block_end:
            start = from_riyadh(local)
            limit = min([b_start for b_start, b_end in busy if b_start >= start + STEP] + [block_end])
            if start <= now:
                reason = "past"
            elif any(b_start < start + STEP and start < b_end for b_start, b_end in busy):
                reason = "taken"
            else:
                reason = None
            max_minutes = int((limit - start) / timedelta(minutes=1)) if reason is None else 0
            slots.append(Slot(start, local.time(), reason is None, reason, max_minutes))
            local += STEP
    return slots


def free_starts(
    blocks: list[BlockLike],
    day: date,
    now: datetime,
    busy: list[tuple[datetime, datetime]],
    minutes: int,
) -> list[datetime]:
    """The starts on a day where an appointment of this length fits."""
    return [s.starts_at for s in day_slots(blocks, day, now, busy) if s.max_minutes >= minutes]
