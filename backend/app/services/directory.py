"""Loading professors with their live status for lists and profiles."""

from datetime import datetime

from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload, selectinload

from app.core.clock import riyadh_day_of_week, to_riyadh
from app.models import Pin, Professor, StatusOverride, User
from app.schemas import (
    BlockOut,
    DepartmentOut,
    OfficeOut,
    ProfessorDetailOut,
    ProfessorSummaryOut,
    StatusOut,
    TodayOut,
)
from app.services.status import EffectiveStatus, effective_status


def latest_overrides(
    db: Session,
    now: datetime,
    professor_ids: list[int] | None = None,
) -> dict[int, StatusOverride]:
    """Each professor's most recent override created at or before now."""
    rank = (
        func.row_number()
        .over(
            partition_by=StatusOverride.professor_id,
            order_by=(StatusOverride.created_at.desc(), StatusOverride.override_id.desc()),
        )
        .label("rank")
    )
    ranked = select(StatusOverride.override_id, rank).where(StatusOverride.created_at <= now)
    if professor_ids is not None:
        ranked = ranked.where(StatusOverride.professor_id.in_(professor_ids))
    ranked = ranked.subquery()
    rows = db.scalars(
        select(StatusOverride)
        .join(ranked, ranked.c.override_id == StatusOverride.override_id)
        .where(ranked.c.rank == 1)
    )
    return {row.professor_id: row for row in rows}


def load_professors(db: Session, ids: list[int] | None = None, active_only: bool = True) -> list[Professor]:
    query = (
        select(Professor)
        .join(User, User.user_id == Professor.professor_id)
        .options(
            joinedload(Professor.department), joinedload(Professor.office), selectinload(Professor.blocks)
        )
    )
    if active_only:
        query = query.where(User.is_active.is_(True))
    if ids is not None:
        query = query.where(Professor.professor_id.in_(ids))
    return list(db.scalars(query).unique())


def pinned_ids(db: Session, student_id: int) -> set[int]:
    return set(db.scalars(select(Pin.professor_id).where(Pin.student_id == student_id)))


def status_out(status: EffectiveStatus) -> StatusOut:
    return StatusOut(
        status=status.status,
        confirmed=status.confirmed,
        source=status.source,
        note=status.note,
        until=status.until,
        updated_at=status.updated_at,
        schedule_status=status.schedule_status,
    )


def has_office_hours_today(professor: Professor, now: datetime) -> bool:
    today = riyadh_day_of_week(to_riyadh(now))
    return any(b.kind == "office_hours" and b.day_of_week == today for b in professor.blocks)


def summary(
    professor: Professor, override: StatusOverride | None, now: datetime, pins: set[int] | None
) -> ProfessorSummaryOut:
    return ProfessorSummaryOut(
        professor_id=professor.professor_id,
        full_name_ar=professor.user.full_name_ar,
        full_name_en=professor.user.full_name_en,
        honorific=professor.honorific,
        academic_rank=professor.academic_rank,
        department=DepartmentOut.model_validate(professor.department),
        office=OfficeOut.model_validate(professor.office) if professor.office else None,
        status=status_out(effective_status(now, professor.blocks, override)),
        has_office_hours_today=has_office_hours_today(professor, now),
        is_pinned=None if pins is None else professor.professor_id in pins,
    )


def detail(
    professor: Professor, override: StatusOverride | None, now: datetime, pins: set[int] | None
) -> ProfessorDetailOut:
    local = to_riyadh(now)
    today = riyadh_day_of_week(local)
    return ProfessorDetailOut(
        **summary(professor, override, now, pins).model_dump(),
        slot_minutes=professor.slot_minutes,
        open_messages=professor.open_messages,
        today=TodayOut(
            date=local.date(),
            day_of_week=today,
            now_local_time=local.time(),
            blocks=[BlockOut.model_validate(b) for b in professor.blocks if b.day_of_week == today],
        ),
    )
