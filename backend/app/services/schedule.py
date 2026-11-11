"""Time rules enforced by the API (the database checks each row alone): a schedule block or
booking period may not overlap another of its own kind, and chat closures may not overlap
each other anywhere in the week. Rows are weekly or dated (services/occurrence.py): two
weekly rows clash when their weekly times meet, a dated row when it meets another row on
its date."""

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.errors import AppError
from app.models import BookingPeriod, ChatClosedHours, ScheduleBlock
from app.services.occurrence import Repeating, overlaps

SCHEDULE_OVERLAP = AppError(409, "SCHEDULE_OVERLAP", "This block overlaps another block on the same day.")
BOOKING_PERIOD_OVERLAP = AppError(
    409, "BOOKING_PERIOD_OVERLAP", "This booking time overlaps another booking time on the same day."
)
CHAT_CLOSURE_OVERLAP = AppError(
    409, "CHAT_CLOSURE_OVERLAP", "These closed hours overlap other closed hours in your week."
)
# model, id column, the error, and whether rows may run past midnight.
RULES = {
    "block": (ScheduleBlock, ScheduleBlock.block_id, SCHEDULE_OVERLAP, False),
    "period": (BookingPeriod, BookingPeriod.period_id, BOOKING_PERIOD_OVERLAP, False),
    "closure": (ChatClosedHours, ChatClosedHours.closure_id, CHAT_CLOSURE_OVERLAP, True),
}


def ensure_free(
    db: Session, kind: str, professor_id: int, row: Repeating, exclude_id: int | None = None
) -> None:
    """Raise the kind's overlap error if `row` meets another row of the professor's."""
    model, id_column, error, overnight = RULES[kind]
    query = select(model).where(model.professor_id == professor_id)
    if exclude_id is not None:
        query = query.where(id_column != exclude_id)
    for other in db.scalars(query):
        if overlaps(row, other, overnight):
            raise error
