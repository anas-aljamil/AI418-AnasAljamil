"""Weekly time rules enforced by the API (the database checks each row alone):
schedule blocks and booking periods may not overlap others of their own kind on the
same day, and chat closures may not overlap each other anywhere in the week."""

from datetime import time

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.errors import AppError
from app.models import BookingPeriod, ChatClosedHours, ScheduleBlock
from app.services.chat import closure_span, spans_overlap


def ensure_no_overlap(
    db: Session,
    professor_id: int,
    day_of_week: int,
    start: time,
    end: time,
    exclude_block_id: int | None = None,
) -> None:
    query = select(ScheduleBlock.block_id).where(
        ScheduleBlock.professor_id == professor_id,
        ScheduleBlock.day_of_week == day_of_week,
        ScheduleBlock.start_time < end,
        ScheduleBlock.end_time > start,
    )
    if exclude_block_id is not None:
        query = query.where(ScheduleBlock.block_id != exclude_block_id)
    if db.execute(query.limit(1)).first():
        raise AppError(409, "SCHEDULE_OVERLAP", "This block overlaps another block on the same day.")


def ensure_period_free(
    db: Session,
    professor_id: int,
    day_of_week: int,
    start: time,
    end: time,
    exclude_period_id: int | None = None,
) -> None:
    query = select(BookingPeriod.period_id).where(
        BookingPeriod.professor_id == professor_id,
        BookingPeriod.day_of_week == day_of_week,
        BookingPeriod.start_time < end,
        BookingPeriod.end_time > start,
    )
    if exclude_period_id is not None:
        query = query.where(BookingPeriod.period_id != exclude_period_id)
    if db.execute(query.limit(1)).first():
        raise AppError(
            409, "BOOKING_PERIOD_OVERLAP", "This booking time overlaps another booking time on the same day."
        )


def ensure_closure_free(
    db: Session,
    professor_id: int,
    day_of_week: int,
    start: time,
    end: time,
    exclude_closure_id: int | None = None,
) -> None:
    query = select(ChatClosedHours).where(ChatClosedHours.professor_id == professor_id)
    if exclude_closure_id is not None:
        query = query.where(ChatClosedHours.closure_id != exclude_closure_id)
    new = closure_span(day_of_week, start, end)
    for other in db.scalars(query):
        if spans_overlap(new, closure_span(other.day_of_week, other.start_time, other.end_time)):
            raise AppError(
                409, "CHAT_CLOSURE_OVERLAP", "These closed hours overlap other closed hours in your week."
            )
