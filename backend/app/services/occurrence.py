"""When a weekly-or-dated row happens (owner decision 2026-11-11).

Schedule blocks, booking periods and chat closures each happen either
* every week on day_of_week (0 = Sunday), up to and including ends_on when it is set, or
* once, on on_date;
and a weekly row does not happen on a date listed in its skipped dates. Times are Riyadh
local. A chat closure whose end is at or before its start runs past midnight into the next
day (equal times: the whole day); blocks and periods end the same day.
"""

from dataclasses import dataclass, field
from datetime import date, datetime, time, timedelta
from typing import Protocol

DAY = timedelta(days=1)
# Any Sunday: two weekly rows without dates compare in one example week.
EXAMPLE_SUNDAY = date(2026, 1, 4)


class Repeating(Protocol):
    day_of_week: int | None
    on_date: date | None
    ends_on: date | None
    start_time: time
    end_time: time

    @property
    def skipped_dates(self) -> list[date]: ...


def weekday(day: date) -> int:
    """0 = Sunday ... 6 = Saturday (Python counts from Monday)."""
    return (day.weekday() + 1) % 7


def occurs_on(item: Repeating, day: date, as_pattern: bool = False) -> bool:
    """as_pattern: a weekly row on its weekday, ignoring its end date and skipped dates."""
    if item.on_date is not None:
        return item.on_date == day and day not in item.skipped_dates
    if weekday(day) != item.day_of_week:
        return False
    return as_pattern or ((item.ends_on is None or day <= item.ends_on) and day not in item.skipped_dates)


def length(item: Repeating, overnight: bool) -> timedelta:
    start = datetime.combine(EXAMPLE_SUNDAY, item.start_time)
    end = datetime.combine(EXAMPLE_SUNDAY, item.end_time)
    if overnight and end <= start:
        end += DAY
    return end - start


def intervals(
    item: Repeating, first: date, last: date, overnight: bool = False, as_pattern: bool = False
) -> list[tuple[datetime, datetime]]:
    """The item's [start, end) in Riyadh local time for each date from first to last it happens on."""
    out = []
    day = first
    while day <= last:
        if occurs_on(item, day, as_pattern):
            start = datetime.combine(day, item.start_time)
            out.append((start, start + length(item, overnight)))
        day += DAY
    return out


def overlaps(a: Repeating, b: Repeating, overnight: bool = False) -> bool:
    """Whether two rows ever take the same time.

    Two weekly rows are compared as weekly patterns, whatever their end dates and skipped
    dates (a pattern that has ended still holds its weekday and time; the database keeps one
    weekly row per start). A dated row is compared on its own date, and a closure that runs
    past midnight on the day before or after it too."""
    if a.on_date is None and b.on_date is None:
        first, last, as_pattern = EXAMPLE_SUNDAY - DAY, EXAMPLE_SUNDAY + 7 * DAY, True
    else:
        dates = [x.on_date for x in (a, b) if x.on_date is not None]
        first, last, as_pattern = min(dates) - DAY, max(dates) + DAY, False
    ours = intervals(a, first, last, overnight, as_pattern)
    theirs = intervals(b, first, last, overnight, as_pattern)
    if a.on_date is None and b.on_date is None:
        # Weekly patterns repeat: also compare with the week before and after.
        theirs = [(s + shift, e + shift) for s, e in theirs for shift in (-7 * DAY, timedelta(0), 7 * DAY)]
    return any(s1 < e2 and s2 < e1 for s1, e1 in ours for s2, e2 in theirs)


@dataclass
class Draft:
    """A row as the API is about to save it, for the overlap check."""

    day_of_week: int | None
    on_date: date | None
    ends_on: date | None
    start_time: time
    end_time: time
    skipped_dates: list[date] = field(default_factory=list)
