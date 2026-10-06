"""Weekly schedule rules enforced by the API (the database checks each block alone)."""

from datetime import time

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.errors import AppError
from app.models import ScheduleBlock


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
