"""The signed-in user's own data: professor status, schedule, booking periods, chat closed
hours and settings; student pins."""

from datetime import timedelta

from fastapi import APIRouter, Depends, Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.clock import Clock, get_clock, to_naive_utc
from app.core.errors import AppError, not_found
from app.core.pagination import Page, PageParams, page_params, paginate
from app.db import get_db
from app.deps import current_professor, current_student
from app.models import BookingPeriod, ChatClosedHours, Pin, Professor, ScheduleBlock, StatusOverride, User
from app.schemas import (
    BlockIn,
    BlockOut,
    ClosureIn,
    ClosureOut,
    PeriodIn,
    PeriodOut,
    ProfessorProfileOut,
    ProfessorSettingsIn,
    ProfessorSummaryOut,
    StatusIn,
    StatusOut,
)
from app.services import directory
from app.services.schedule import ensure_closure_free, ensure_no_overlap, ensure_period_free
from app.services.status import effective_status, override_end

router = APIRouter(prefix="/me", tags=["me"])

MAX_RETURN_TIME = timedelta(days=7)


def _status_now(db: Session, professor_id: int, clock: Clock) -> StatusOut:
    now = clock.now()
    professor = db.get(Professor, professor_id)
    override = directory.latest_overrides(db, now, [professor_id]).get(professor_id)
    return directory.status_out(effective_status(now, professor.blocks, override))


# --- professor: status (one tap) ------------------------------------------------


@router.get("/status", response_model=StatusOut, summary="My current effective status")
def my_status(
    user: User = Depends(current_professor), db: Session = Depends(get_db), clock: Clock = Depends(get_clock)
) -> StatusOut:
    return _status_now(db, user.user_id, clock)


@router.post("/status", response_model=StatusOut, summary="Set my status (optionally until a return time)")
def set_status(
    body: StatusIn,
    user: User = Depends(current_professor),
    db: Session = Depends(get_db),
    clock: Clock = Depends(get_clock),
) -> StatusOut:
    now = clock.now()
    expires_at = to_naive_utc(body.expires_at) if body.expires_at else None
    if expires_at is not None and not now < expires_at <= now + MAX_RETURN_TIME:
        raise AppError(422, "INVALID_RETURN_TIME", "The return time must be in the next 7 days.")
    db.add(
        StatusOverride(
            professor_id=user.user_id,
            status=body.status,
            note=body.note,
            created_at=now,
            expires_at=expires_at,
        )
    )
    db.commit()
    return _status_now(db, user.user_id, clock)


@router.delete("/status", response_model=StatusOut, summary="Clear my manual status (back to the schedule)")
def clear_status(
    user: User = Depends(current_professor), db: Session = Depends(get_db), clock: Clock = Depends(get_clock)
) -> StatusOut:
    now = clock.now()
    while True:
        override = directory.latest_overrides(db, now, [user.user_id]).get(user.user_id)
        if override is None or now >= override_end(override):
            break
        if override.created_at < now:
            override.expires_at = now
            break
        # Set and cleared within the same second: expires_at could not be
        # both after created_at (database CHECK) and not after now, so the
        # momentary update is removed instead. The one before it then counts
        # again, so the loop looks at that one too (several taps in one second,
        # or a frozen demo clock).
        db.delete(override)
        db.flush()
    db.commit()
    return _status_now(db, user.user_id, clock)


# --- professor: weekly schedule -----------------------------------------------


def _own_block(db: Session, user: User, block_id: int) -> ScheduleBlock:
    block = db.get(ScheduleBlock, block_id)
    if block is None or block.professor_id != user.user_id:
        raise not_found("Schedule block")
    return block


@router.get("/schedule", response_model=Page[BlockOut], summary="My weekly schedule")
def my_schedule(
    page: PageParams = Depends(page_params),
    user: User = Depends(current_professor),
    db: Session = Depends(get_db),
) -> Page[BlockOut]:
    blocks = db.scalars(
        select(ScheduleBlock)
        .where(ScheduleBlock.professor_id == user.user_id)
        .order_by(ScheduleBlock.day_of_week, ScheduleBlock.start_time)
    ).all()
    return paginate([BlockOut.model_validate(b) for b in blocks], page)


@router.post("/schedule", response_model=BlockOut, status_code=201, summary="Add a schedule block")
def add_block(
    body: BlockIn, user: User = Depends(current_professor), db: Session = Depends(get_db)
) -> BlockOut:
    ensure_no_overlap(db, user.user_id, body.day_of_week, body.start_time, body.end_time)
    block = ScheduleBlock(professor_id=user.user_id, **body.model_dump())
    db.add(block)
    db.commit()
    return BlockOut.model_validate(block)


@router.put("/schedule/{block_id}", response_model=BlockOut, summary="Replace a schedule block")
def update_block(
    block_id: int, body: BlockIn, user: User = Depends(current_professor), db: Session = Depends(get_db)
) -> BlockOut:
    block = _own_block(db, user, block_id)
    ensure_no_overlap(
        db, user.user_id, body.day_of_week, body.start_time, body.end_time, exclude_block_id=block_id
    )
    for field, value in body.model_dump().items():
        setattr(block, field, value)
    db.commit()
    return BlockOut.model_validate(block)


@router.delete("/schedule/{block_id}", status_code=204, summary="Delete a schedule block")
def delete_block(
    block_id: int, user: User = Depends(current_professor), db: Session = Depends(get_db)
) -> Response:
    db.delete(_own_block(db, user, block_id))
    db.commit()
    return Response(status_code=204)


# --- professor: booking periods (when students can book) ---------------------


def _own_period(db: Session, user: User, period_id: int) -> BookingPeriod:
    period = db.get(BookingPeriod, period_id)
    if period is None or period.professor_id != user.user_id:
        raise not_found("Booking period")
    return period


@router.get("/booking-periods", response_model=Page[PeriodOut], summary="My weekly booking periods")
def my_periods(
    page: PageParams = Depends(page_params),
    user: User = Depends(current_professor),
    db: Session = Depends(get_db),
) -> Page[PeriodOut]:
    rows = db.scalars(
        select(BookingPeriod)
        .where(BookingPeriod.professor_id == user.user_id)
        .order_by(BookingPeriod.day_of_week, BookingPeriod.start_time)
    ).all()
    return paginate([PeriodOut.model_validate(r) for r in rows], page)


@router.post("/booking-periods", response_model=PeriodOut, status_code=201, summary="Add a booking period")
def add_period(
    body: PeriodIn, user: User = Depends(current_professor), db: Session = Depends(get_db)
) -> PeriodOut:
    ensure_period_free(db, user.user_id, body.day_of_week, body.start_time, body.end_time)
    period = BookingPeriod(professor_id=user.user_id, **body.model_dump())
    db.add(period)
    db.commit()
    return PeriodOut.model_validate(period)


@router.put("/booking-periods/{period_id}", response_model=PeriodOut, summary="Replace a booking period")
def update_period(
    period_id: int, body: PeriodIn, user: User = Depends(current_professor), db: Session = Depends(get_db)
) -> PeriodOut:
    period = _own_period(db, user, period_id)
    ensure_period_free(
        db, user.user_id, body.day_of_week, body.start_time, body.end_time, exclude_period_id=period_id
    )
    for field, value in body.model_dump().items():
        setattr(period, field, value)
    db.commit()
    return PeriodOut.model_validate(period)


@router.delete(
    "/booking-periods/{period_id}",
    status_code=204,
    summary="Delete a booking period (existing appointments stay)",
)
def delete_period(
    period_id: int, user: User = Depends(current_professor), db: Session = Depends(get_db)
) -> Response:
    db.delete(_own_period(db, user, period_id))
    db.commit()
    return Response(status_code=204)


# --- professor: chat closed hours (when students cannot write) ----------------


def _own_closure(db: Session, user: User, closure_id: int) -> ChatClosedHours:
    closure = db.get(ChatClosedHours, closure_id)
    if closure is None or closure.professor_id != user.user_id:
        raise not_found("Closed hours")
    return closure


@router.get("/chat-closed-hours", response_model=Page[ClosureOut], summary="My weekly chat closed hours")
def my_closures(
    page: PageParams = Depends(page_params),
    user: User = Depends(current_professor),
    db: Session = Depends(get_db),
) -> Page[ClosureOut]:
    rows = db.scalars(
        select(ChatClosedHours)
        .where(ChatClosedHours.professor_id == user.user_id)
        .order_by(ChatClosedHours.day_of_week, ChatClosedHours.start_time)
    ).all()
    return paginate([ClosureOut.model_validate(r) for r in rows], page)


@router.post(
    "/chat-closed-hours", response_model=ClosureOut, status_code=201, summary="Close chat at a weekly time"
)
def add_closure(
    body: ClosureIn, user: User = Depends(current_professor), db: Session = Depends(get_db)
) -> ClosureOut:
    ensure_closure_free(db, user.user_id, body.day_of_week, body.start_time, body.end_time)
    closure = ChatClosedHours(professor_id=user.user_id, **body.model_dump())
    db.add(closure)
    db.commit()
    return ClosureOut.model_validate(closure)


@router.put("/chat-closed-hours/{closure_id}", response_model=ClosureOut, summary="Replace closed hours")
def update_closure(
    closure_id: int, body: ClosureIn, user: User = Depends(current_professor), db: Session = Depends(get_db)
) -> ClosureOut:
    closure = _own_closure(db, user, closure_id)
    ensure_closure_free(
        db, user.user_id, body.day_of_week, body.start_time, body.end_time, exclude_closure_id=closure_id
    )
    for field, value in body.model_dump().items():
        setattr(closure, field, value)
    db.commit()
    return ClosureOut.model_validate(closure)


@router.delete("/chat-closed-hours/{closure_id}", status_code=204, summary="Delete closed hours")
def delete_closure(
    closure_id: int, user: User = Depends(current_professor), db: Session = Depends(get_db)
) -> Response:
    db.delete(_own_closure(db, user, closure_id))
    db.commit()
    return Response(status_code=204)


@router.patch(
    "/professor-settings",
    response_model=ProfessorProfileOut,
    summary="Change my usual appointment length",
)
def update_settings(
    body: ProfessorSettingsIn, user: User = Depends(current_professor), db: Session = Depends(get_db)
) -> ProfessorProfileOut:
    professor = db.get(Professor, user.user_id)
    for field, value in body.model_dump(exclude_none=True).items():
        setattr(professor, field, value)
    db.commit()
    return ProfessorProfileOut.model_validate(professor)


# --- student: pinned professors -----------------------------------------------


@router.get("/pins", response_model=Page[ProfessorSummaryOut], summary="My pinned professors")
def my_pins(
    page: PageParams = Depends(page_params),
    user: User = Depends(current_student),
    db: Session = Depends(get_db),
    clock: Clock = Depends(get_clock),
) -> Page[ProfessorSummaryOut]:
    now = clock.now()
    ids = sorted(directory.pinned_ids(db, user.user_id))
    professors = directory.load_professors(db, ids=ids)
    overrides = directory.latest_overrides(db, now, ids)
    rows = [directory.summary(p, overrides.get(p.professor_id), now, set(ids)) for p in professors]
    rows.sort(key=lambda r: (r.status.status != "in_office", r.full_name_ar))
    return paginate(rows, page)


@router.put("/pins/{professor_id}", status_code=204, summary="Pin a professor (idempotent)")
def pin(
    professor_id: int,
    user: User = Depends(current_student),
    db: Session = Depends(get_db),
    clock: Clock = Depends(get_clock),
) -> Response:
    if not directory.load_professors(db, ids=[professor_id]):
        raise not_found("Professor")
    if db.get(Pin, (user.user_id, professor_id)) is None:
        db.add(Pin(student_id=user.user_id, professor_id=professor_id, created_at=clock.now()))
        db.commit()
    return Response(status_code=204)


@router.delete("/pins/{professor_id}", status_code=204, summary="Unpin a professor (idempotent)")
def unpin(
    professor_id: int, user: User = Depends(current_student), db: Session = Depends(get_db)
) -> Response:
    existing = db.get(Pin, (user.user_id, professor_id))
    if existing is not None:
        db.delete(existing)
        db.commit()
    return Response(status_code=204)
