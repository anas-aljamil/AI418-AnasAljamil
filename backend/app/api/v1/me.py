"""The signed-in user's own data: professor status, schedule, booking periods and chat closed
hours (weekly or dated, with skipped dates); student pins."""

from datetime import date, timedelta

from fastapi import APIRouter, Depends, Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.clock import Clock, get_clock, to_naive_utc
from app.core.errors import AppError, not_found
from app.core.pagination import Page, PageParams, page_params, paginate
from app.db import get_db
from app.deps import current_professor, current_student
from app.models import (
    BookingPeriod,
    ChatClosedHours,
    Pin,
    Professor,
    ScheduleBlock,
    SkippedDate,
    StatusOverride,
    User,
)
from app.schemas import (
    BlockIn,
    BlockOut,
    ClosureIn,
    ClosureOut,
    PeriodIn,
    PeriodOut,
    ProfessorSummaryOut,
    SkipIn,
    StatusIn,
    StatusOut,
)
from app.services import directory
from app.services.occurrence import Draft, intervals, occurs_on
from app.services.schedule import RULES, ensure_free
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


# --- professor: schedule, booking periods, chat closed hours --------------------
# Each is weekly (day_of_week, optionally until ends_on) or dated (on_date), and a weekly
# one can skip single dates (owner decision 2026-11-11). Overlaps are refused per kind.

# kind -> (model, primary key name, name in errors, output schema)
KINDS = {
    "block": (ScheduleBlock, "block_id", "Schedule block", BlockOut),
    "period": (BookingPeriod, "period_id", "Booking period", PeriodOut),
    "closure": (ChatClosedHours, "closure_id", "Closed hours", ClosureOut),
}


def _own(db: Session, user: User, kind: str, row_id: int):
    model, _, name, _ = KINDS[kind]
    row = db.get(model, row_id)
    if row is None or row.professor_id != user.user_id:
        raise not_found(name)
    return row


def _list(db: Session, user: User, kind: str, page: PageParams):
    model, _, _, out = KINDS[kind]
    rows = db.scalars(
        select(model)
        .where(model.professor_id == user.user_id)
        .order_by(model.on_date, model.day_of_week, model.start_time)
    ).all()
    return paginate([out.model_validate(r) for r in rows], page)


def _save(db: Session, user: User, kind: str, body, row=None):
    """Add a row (row None) or replace one, after the overlap check."""
    model, id_name, _, out = KINDS[kind]
    fields = body.model_dump()
    draft = Draft(
        fields["day_of_week"],
        fields["on_date"],
        fields["ends_on"],
        fields["start_time"],
        fields["end_time"],
        row.skipped_dates if row is not None else [],
    )
    ensure_free(db, kind, user.user_id, draft, exclude_id=getattr(row, id_name) if row is not None else None)
    if row is None:
        row = model(professor_id=user.user_id, **fields)
        db.add(row)
    else:
        for field, value in fields.items():
            setattr(row, field, value)
        # Skipped dates that are no longer one of the row's dates go (a dated row has none).
        for skip in row.skips:
            if not occurs_on(row, skip.skip_date, as_pattern=True) or row.on_date is not None:
                db.delete(skip)
    db.commit()
    db.refresh(row)
    return out.model_validate(row)


def _delete(db: Session, user: User, kind: str, row_id: int) -> Response:
    db.delete(_own(db, user, kind, row_id))
    db.commit()
    return Response(status_code=204)


def _skip(db: Session, user: User, kind: str, row_id: int, body: SkipIn, now):
    """Leave out one date of a weekly row (idempotent)."""
    _, id_name, _, out = KINDS[kind]
    row = _own(db, user, kind, row_id)
    if row.on_date is not None:
        raise AppError(422, "SKIP_NOT_WEEKLY", "Only something that repeats every week can skip a date.")
    if not occurs_on(row, body.skip_date, as_pattern=True) or (
        row.ends_on is not None and body.skip_date > row.ends_on
    ):
        raise AppError(422, "SKIP_WRONG_DATE", "That date is not one of its days.")
    if body.skip_date not in row.skipped_dates:
        db.add(SkippedDate(**{id_name: row_id}, skip_date=body.skip_date, created_at=now))
        db.commit()
    db.refresh(row)
    return out.model_validate(row)


def _unskip(db: Session, user: User, kind: str, row_id: int, skip_date: date):
    """Bring a skipped date back, unless a dated row of the same kind took its time meanwhile."""
    _, id_name, _, out = KINDS[kind]
    row = _own(db, user, kind, row_id)
    skip = next((s for s in row.skips if s.skip_date == skip_date), None)
    if skip is not None:
        restored = Draft(row.day_of_week, None, row.ends_on, row.start_time, row.end_time, [])
        model = KINDS[kind][0]
        dated = db.scalars(
            select(model).where(model.professor_id == user.user_id, model.on_date.is_not(None))
        ).all()
        overnight = kind == "closure"
        for other in dated:
            if other.on_date in (skip_date - timedelta(days=1), skip_date, skip_date + timedelta(days=1)):
                mine = intervals(restored, skip_date, skip_date, overnight)
                theirs = intervals(other, other.on_date, other.on_date, overnight)
                if any(s1 < e2 and s2 < e1 for s1, e1 in mine for s2, e2 in theirs):
                    raise RULES[kind][2]
        db.delete(skip)
        db.commit()
    db.refresh(row)
    return out.model_validate(row)


@router.get("/schedule", response_model=Page[BlockOut], summary="My schedule (weekly and dated blocks)")
def my_schedule(
    page: PageParams = Depends(page_params),
    user: User = Depends(current_professor),
    db: Session = Depends(get_db),
) -> Page[BlockOut]:
    return _list(db, user, "block", page)


@router.post("/schedule", response_model=BlockOut, status_code=201, summary="Add a schedule block")
def add_block(
    body: BlockIn, user: User = Depends(current_professor), db: Session = Depends(get_db)
) -> BlockOut:
    return _save(db, user, "block", body)


@router.put("/schedule/{block_id}", response_model=BlockOut, summary="Replace a schedule block")
def update_block(
    block_id: int, body: BlockIn, user: User = Depends(current_professor), db: Session = Depends(get_db)
) -> BlockOut:
    return _save(db, user, "block", body, _own(db, user, "block", block_id))


@router.delete("/schedule/{block_id}", status_code=204, summary="Delete a schedule block")
def delete_block(
    block_id: int, user: User = Depends(current_professor), db: Session = Depends(get_db)
) -> Response:
    return _delete(db, user, "block", block_id)


@router.post("/schedule/{block_id}/skips", response_model=BlockOut, status_code=201, summary="Skip one date")
def skip_block_date(
    block_id: int,
    body: SkipIn,
    user: User = Depends(current_professor),
    db: Session = Depends(get_db),
    clock: Clock = Depends(get_clock),
) -> BlockOut:
    return _skip(db, user, "block", block_id, body, clock.now())


@router.delete(
    "/schedule/{block_id}/skips/{skip_date}", response_model=BlockOut, summary="Bring a skipped date back"
)
def unskip_block_date(
    block_id: int, skip_date: date, user: User = Depends(current_professor), db: Session = Depends(get_db)
) -> BlockOut:
    return _unskip(db, user, "block", block_id, skip_date)


@router.get("/booking-periods", response_model=Page[PeriodOut], summary="My booking periods")
def my_periods(
    page: PageParams = Depends(page_params),
    user: User = Depends(current_professor),
    db: Session = Depends(get_db),
) -> Page[PeriodOut]:
    return _list(db, user, "period", page)


@router.post("/booking-periods", response_model=PeriodOut, status_code=201, summary="Add a booking period")
def add_period(
    body: PeriodIn, user: User = Depends(current_professor), db: Session = Depends(get_db)
) -> PeriodOut:
    return _save(db, user, "period", body)


@router.put("/booking-periods/{period_id}", response_model=PeriodOut, summary="Replace a booking period")
def update_period(
    period_id: int, body: PeriodIn, user: User = Depends(current_professor), db: Session = Depends(get_db)
) -> PeriodOut:
    return _save(db, user, "period", body, _own(db, user, "period", period_id))


@router.delete(
    "/booking-periods/{period_id}",
    status_code=204,
    summary="Delete a booking period (existing appointments stay)",
)
def delete_period(
    period_id: int, user: User = Depends(current_professor), db: Session = Depends(get_db)
) -> Response:
    return _delete(db, user, "period", period_id)


@router.post(
    "/booking-periods/{period_id}/skips", response_model=PeriodOut, status_code=201, summary="Skip one date"
)
def skip_period_date(
    period_id: int,
    body: SkipIn,
    user: User = Depends(current_professor),
    db: Session = Depends(get_db),
    clock: Clock = Depends(get_clock),
) -> PeriodOut:
    return _skip(db, user, "period", period_id, body, clock.now())


@router.delete(
    "/booking-periods/{period_id}/skips/{skip_date}",
    response_model=PeriodOut,
    summary="Bring a skipped date back",
)
def unskip_period_date(
    period_id: int, skip_date: date, user: User = Depends(current_professor), db: Session = Depends(get_db)
) -> PeriodOut:
    return _unskip(db, user, "period", period_id, skip_date)


@router.get("/chat-closed-hours", response_model=Page[ClosureOut], summary="My chat closed hours")
def my_closures(
    page: PageParams = Depends(page_params),
    user: User = Depends(current_professor),
    db: Session = Depends(get_db),
) -> Page[ClosureOut]:
    return _list(db, user, "closure", page)


@router.post(
    "/chat-closed-hours",
    response_model=ClosureOut,
    status_code=201,
    summary="Close chat at a weekly time or on a date",
)
def add_closure(
    body: ClosureIn, user: User = Depends(current_professor), db: Session = Depends(get_db)
) -> ClosureOut:
    return _save(db, user, "closure", body)


@router.put("/chat-closed-hours/{closure_id}", response_model=ClosureOut, summary="Replace closed hours")
def update_closure(
    closure_id: int, body: ClosureIn, user: User = Depends(current_professor), db: Session = Depends(get_db)
) -> ClosureOut:
    return _save(db, user, "closure", body, _own(db, user, "closure", closure_id))


@router.delete("/chat-closed-hours/{closure_id}", status_code=204, summary="Delete closed hours")
def delete_closure(
    closure_id: int, user: User = Depends(current_professor), db: Session = Depends(get_db)
) -> Response:
    return _delete(db, user, "closure", closure_id)


@router.post(
    "/chat-closed-hours/{closure_id}/skips",
    response_model=ClosureOut,
    status_code=201,
    summary="Skip one date",
)
def skip_closure_date(
    closure_id: int,
    body: SkipIn,
    user: User = Depends(current_professor),
    db: Session = Depends(get_db),
    clock: Clock = Depends(get_clock),
) -> ClosureOut:
    return _skip(db, user, "closure", closure_id, body, clock.now())


@router.delete(
    "/chat-closed-hours/{closure_id}/skips/{skip_date}",
    response_model=ClosureOut,
    summary="Bring a skipped date back",
)
def unskip_closure_date(
    closure_id: int, skip_date: date, user: User = Depends(current_professor), db: Session = Depends(get_db)
) -> ClosureOut:
    return _unskip(db, user, "closure", closure_id, skip_date)


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
