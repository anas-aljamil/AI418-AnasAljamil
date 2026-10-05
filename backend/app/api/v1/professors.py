"""Browsing professors: search, filters, profile, bookable slots, departments."""

from datetime import date, time, timedelta
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.arabic import matches, normalize
from app.core.clock import Clock, get_clock, local_slot_to_utc, to_riyadh
from app.core.errors import AppError, not_found
from app.core.pagination import Page, PageParams, page_params, paginate
from app.db import get_db
from app.deps import get_current_user
from app.models import Appointment, Department, User
from app.schemas import DaySlotsOut, DepartmentOut, ProfessorDetailOut, ProfessorSummaryOut, SlotOut
from app.services import directory
from app.services.booking import ACTIVE
from app.services.slots import booking_window_end, day_slots

router = APIRouter(tags=["professors"])

StatusFilter = Literal["in_office", "in_class", "busy", "away", "unknown"]


@router.get("/departments", response_model=Page[DepartmentOut], summary="List departments")
def list_departments(
    page: PageParams = Depends(page_params),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> Page[DepartmentOut]:
    rows = db.scalars(select(Department).order_by(Department.code)).all()
    return paginate([DepartmentOut.model_validate(r) for r in rows], page)


@router.get(
    "/professors",
    response_model=Page[ProfessorSummaryOut],
    summary="Search and filter professors (available first, then by name)",
)
def list_professors(
    q: Annotated[
        str | None, Query(max_length=100, description="Name or department, Arabic or English")
    ] = None,
    department_id: Annotated[list[int] | None, Query()] = None,
    status: Annotated[list[StatusFilter] | None, Query()] = None,
    has_office_hours_today: bool | None = None,
    lang: Literal["ar", "en"] = "ar",
    page: PageParams = Depends(page_params),
    db: Session = Depends(get_db),
    clock: Clock = Depends(get_clock),
    user: User = Depends(get_current_user),
) -> Page[ProfessorSummaryOut]:
    now = clock.now()
    # The directory is small (one university), so filtering and Arabic-aware
    # matching happen in Python after one query per table.
    professors = directory.load_professors(db)
    overrides = directory.latest_overrides(db, now)
    pins = directory.pinned_ids(db, user.user_id) if user.role == "student" else None
    rows = []
    for professor in professors:
        if department_id and professor.department_id not in department_id:
            continue
        if q and not matches(
            q,
            professor.user.full_name_ar,
            professor.user.full_name_en,
            professor.department.name_ar,
            professor.department.name_en,
            professor.department.code,
        ):
            continue
        row = directory.summary(professor, overrides.get(professor.professor_id), now, pins)
        if status and row.status.status not in status:
            continue
        if has_office_hours_today is not None and row.has_office_hours_today != has_office_hours_today:
            continue
        rows.append(row)
    rows.sort(
        key=lambda r: (
            r.status.status != "in_office",
            normalize(r.full_name_ar if lang == "ar" else r.full_name_en),
        )
    )
    return paginate(rows, page)


@router.get(
    "/professors/{professor_id}",
    response_model=ProfessorDetailOut,
    summary="Professor profile with live status and today's timeline",
)
def get_professor(
    professor_id: int,
    db: Session = Depends(get_db),
    clock: Clock = Depends(get_clock),
    user: User = Depends(get_current_user),
) -> ProfessorDetailOut:
    now = clock.now()
    found = directory.load_professors(db, ids=[professor_id])
    if not found:
        raise not_found("Professor")
    pins = directory.pinned_ids(db, user.user_id) if user.role == "student" else None
    override = directory.latest_overrides(db, now, [professor_id]).get(professor_id)
    return directory.detail(found[0], override, now, pins)


@router.get(
    "/professors/{professor_id}/slots",
    response_model=DaySlotsOut,
    summary="Bookable slots on one day (Riyadh date)",
)
def get_slots(
    professor_id: int,
    day: Annotated[date, Query(alias="date")],
    db: Session = Depends(get_db),
    clock: Clock = Depends(get_clock),
    _: User = Depends(get_current_user),
) -> DaySlotsOut:
    now = clock.now()
    found = directory.load_professors(db, ids=[professor_id])
    if not found:
        raise not_found("Professor")
    professor = found[0]
    if not to_riyadh(now).date() <= day < to_riyadh(booking_window_end(now)).date():
        raise AppError(422, "OUTSIDE_BOOKING_WINDOW", "Choose a day in this week or next week.")
    day_start = local_slot_to_utc(day, time())
    busy = db.execute(
        select(Appointment.starts_at, Appointment.ends_at).where(
            Appointment.professor_id == professor_id,
            Appointment.status.in_(ACTIVE),
            Appointment.starts_at < day_start + timedelta(days=1),
            Appointment.ends_at > day_start,
        )
    ).all()
    slots = day_slots(professor.blocks, professor.slot_minutes, day, now, [tuple(r) for r in busy])
    return DaySlotsOut(
        professor_id=professor_id,
        date=day,
        slot_minutes=professor.slot_minutes,
        slots=[
            SlotOut(
                starts_at=s.starts_at,
                ends_at=s.ends_at,
                local_time=s.local_time,
                available=s.available,
                reason=s.reason,
            )
            for s in slots
        ],
    )
