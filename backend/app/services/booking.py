"""Booking and the appointment lifecycle (CLAUDE.md section 4).

Rules enforced here, before the database's own guards (unique active-slot
index and overlap triggers) act as the backstop:
* the start is on a 5-minute grid, in the future and inside the booking window;
  the length is any number of 5-minute steps (the professor's usual length by
  default), and the whole appointment must fit inside one office-hours block
  without overlapping another pending or approved appointment;
* a student holds at most 2 pending/approved future appointments per professor;
* cancellation is allowed until 1 hour before the start;
* transitions: pending -> approved | declined | cancelled;
  approved -> cancelled | completed | no_show (the last two once it has started);
* when an appointment is cancelled, the student booked right after it that day is
  told the time before theirs is free if they could move into it; a student may
  move their own pending or approved appointment earlier on the same day, keeping
  its length and status (the professor is told).
"""

from datetime import date, datetime, time, timedelta

from sqlalchemy import func, select, update
from sqlalchemy.exc import DBAPIError
from sqlalchemy.orm import Session

from app.core.clock import local_slot_to_utc, to_riyadh
from app.core.errors import AppError, forbidden, mysql_error_number, not_found
from app.models import Appointment, Notification, Professor, ScheduleBlock, Student, User
from app.services.notify import notify
from app.services.slots import booking_window_end, find_block, free_starts

ACTIVE = ("pending", "approved")
MAX_ACTIVE_PER_PROFESSOR = 2
CANCEL_NOTICE = timedelta(hours=1)

SLOT_TAKEN = AppError(409, "SLOT_TAKEN", "This time is already booked. Choose another time.")
INVALID_SLOT = AppError(
    422,
    "INVALID_SLOT",
    "The whole appointment must fit inside the professor's office hours, in 5-minute steps.",
)


def overlapping_active(
    db: Session, professor_id: int, starts_at: datetime, ends_at: datetime, exclude_id: int | None = None
) -> bool:
    query = select(Appointment.appointment_id).where(
        Appointment.professor_id == professor_id,
        Appointment.status.in_(ACTIVE),
        Appointment.starts_at < ends_at,
        Appointment.ends_at > starts_at,
    )
    if exclude_id is not None:
        query = query.where(Appointment.appointment_id != exclude_id)
    return db.execute(query.limit(1)).first() is not None


def _blocks(db: Session, professor_id: int) -> list[ScheduleBlock]:
    return list(db.scalars(select(ScheduleBlock).where(ScheduleBlock.professor_id == professor_id)).all())


def _busy_on(db: Session, professor_id: int, day: date, exclude_id: int) -> list[tuple[datetime, datetime]]:
    """Active appointments touching a Riyadh day, except one."""
    day_start = local_slot_to_utc(day, time())
    rows = db.execute(
        select(Appointment.starts_at, Appointment.ends_at).where(
            Appointment.professor_id == professor_id,
            Appointment.status.in_(ACTIVE),
            Appointment.appointment_id != exclude_id,
            Appointment.starts_at < day_start + timedelta(days=1),
            Appointment.ends_at > day_start,
        )
    ).all()
    return [(start, end) for start, end in rows]


def earlier_starts(db: Session, appointment: Appointment, now: datetime) -> list[datetime]:
    """Free starts earlier the same day where the appointment fits with its length."""
    day = to_riyadh(appointment.starts_at).date()
    minutes = int((appointment.ends_at - appointment.starts_at) / timedelta(minutes=1))
    busy = _busy_on(db, appointment.professor_id, day, appointment.appointment_id)
    starts = free_starts(_blocks(db, appointment.professor_id), day, now, busy, minutes)
    return [start for start in starts if start < appointment.starts_at]


def _tell_next_student(db: Session, cancelled: Appointment, now: datetime) -> None:
    """After a cancellation, the next appointment that day may move into the freed time."""
    day_end = local_slot_to_utc(to_riyadh(cancelled.starts_at).date() + timedelta(days=1), time())
    following = db.scalars(
        select(Appointment)
        .where(
            Appointment.professor_id == cancelled.professor_id,
            Appointment.status.in_(ACTIVE),
            Appointment.starts_at >= cancelled.ends_at,
            Appointment.starts_at < day_end,
        )
        .order_by(Appointment.starts_at)
        .limit(1)
    ).first()
    if following is None or following.student_id == cancelled.student_id:
        return
    if any(start < cancelled.ends_at for start in earlier_starts(db, following, now)):
        notify(db, following.student_id, "slot_freed", now, appointment_id=following.appointment_id)


def book(
    db: Session,
    student_id: int,
    professor_id: int,
    starts_at: datetime,
    minutes: int | None,
    topic: str | None,
    note: str | None,
    now: datetime,
) -> Appointment:
    # Serialize this student's bookings so two parallel requests cannot both
    # pass the 2-appointment limit.
    db.execute(select(Student.student_id).where(Student.student_id == student_id).with_for_update())

    professor = db.get(Professor, professor_id)
    if professor is None or not professor.user.is_active:
        raise not_found("Professor")
    if starts_at <= now:
        raise AppError(422, "SLOT_IN_PAST", "This time has already passed.")
    if starts_at >= booking_window_end(now):
        raise AppError(422, "OUTSIDE_BOOKING_WINDOW", "Bookings are open for this week and next week only.")
    minutes = minutes or professor.slot_minutes
    if find_block(_blocks(db, professor_id), starts_at, minutes) is None:
        raise INVALID_SLOT

    active_future = db.scalar(
        select(func.count())
        .select_from(Appointment)
        .where(
            Appointment.student_id == student_id,
            Appointment.professor_id == professor_id,
            Appointment.status.in_(ACTIVE),
            Appointment.starts_at > now,
        )
    )
    if active_future >= MAX_ACTIVE_PER_PROFESSOR:
        raise AppError(
            409,
            "BOOKING_LIMIT",
            "You already have 2 upcoming appointments with this professor. Cancel one to book another.",
        )

    ends_at = starts_at + timedelta(minutes=minutes)
    if overlapping_active(db, professor_id, starts_at, ends_at):
        raise SLOT_TAKEN

    appointment = Appointment(
        student_id=student_id,
        professor_id=professor_id,
        starts_at=starts_at,
        ends_at=ends_at,
        status="pending",
        topic=topic,
        note=note,
        created_at=now,
        updated_at=now,
    )
    db.add(appointment)
    try:
        db.flush()
    except DBAPIError as exc:
        # A parallel booking won the race: the unique index (1062) or the overlap trigger (1644).
        db.rollback()
        if mysql_error_number(exc) in (1062, 1644):
            raise SLOT_TAKEN from exc
        raise
    notify(db, professor_id, "appointment_requested", now, appointment_id=appointment.appointment_id)
    db.commit()
    return appointment


# action -> (roles allowed to perform it, states it may start from, resulting state)
TRANSITIONS = {
    "approve": ({"professor"}, {"pending"}, "approved"),
    "decline": ({"professor"}, {"pending"}, "declined"),
    "cancel": ({"student", "professor"}, {"pending", "approved"}, "cancelled"),
    "complete": ({"professor"}, {"approved"}, "completed"),
    "no-show": ({"professor"}, {"approved"}, "no_show"),
}
NOTIFY_STUDENT = {"approved": "appointment_approved", "declined": "appointment_declined"}


def get_for_participant(db: Session, appointment_id: int, user: User) -> Appointment:
    """The appointment if `user` is its student or professor (admins see all); 404 otherwise."""
    appointment = db.get(Appointment, appointment_id)
    if appointment is None or not (
        user.role == "admin" or user.user_id in (appointment.student_id, appointment.professor_id)
    ):
        raise not_found("Appointment")
    return appointment


def transition(db: Session, appointment_id: int, action: str, user: User, now: datetime) -> Appointment:
    appointment = get_for_participant(db, appointment_id, user)
    roles, from_states, new_state = TRANSITIONS[action]
    if user.role not in roles:
        raise forbidden(f"A {user.role} cannot {action.replace('-', ' ')} an appointment.")
    if appointment.status not in from_states:
        raise AppError(
            409,
            "INVALID_TRANSITION",
            f"An appointment that is {appointment.status} cannot be changed this way.",
        )
    if action == "cancel" and now > appointment.starts_at - CANCEL_NOTICE:
        raise AppError(
            409, "CANCEL_WINDOW_CLOSED", "Appointments can be cancelled until 1 hour before they start."
        )
    if action in ("complete", "no-show") and now < appointment.starts_at:
        raise AppError(409, "TOO_EARLY", "You can mark the outcome once the appointment has started.")

    appointment.status, appointment.updated_at = new_state, now
    if new_state in NOTIFY_STUDENT:
        notify(
            db,
            appointment.student_id,
            NOTIFY_STUDENT[new_state],
            now,
            appointment_id=appointment.appointment_id,
        )
    elif new_state == "cancelled":
        other = appointment.professor_id if user.user_id == appointment.student_id else appointment.student_id
        notify(db, other, "appointment_cancelled", now, appointment_id=appointment.appointment_id)
        db.flush()
        _tell_next_student(db, appointment, now)
    db.commit()
    return appointment


def move_earlier(
    db: Session, appointment_id: int, starts_at: datetime, user: User, now: datetime
) -> Appointment:
    """A student moves their own pending or approved appointment earlier the same day."""
    appointment = get_for_participant(db, appointment_id, user)
    if user.user_id != appointment.student_id:
        raise forbidden("Only the student who booked can move an appointment.")
    if appointment.status not in ACTIVE:
        raise AppError(
            409, "INVALID_TRANSITION", f"An appointment that is {appointment.status} cannot be moved."
        )
    same_day = to_riyadh(starts_at).date() == to_riyadh(appointment.starts_at).date()
    if not (same_day and starts_at < appointment.starts_at):
        raise AppError(422, "MOVE_NOT_EARLIER", "Choose an earlier time on the same day.")
    if starts_at <= now:
        raise AppError(422, "SLOT_IN_PAST", "This time has already passed.")
    length = appointment.ends_at - appointment.starts_at
    if (
        find_block(_blocks(db, appointment.professor_id), starts_at, int(length / timedelta(minutes=1)))
        is None
    ):
        raise INVALID_SLOT
    if overlapping_active(
        db, appointment.professor_id, starts_at, starts_at + length, exclude_id=appointment.appointment_id
    ):
        raise SLOT_TAKEN

    appointment.starts_at, appointment.ends_at, appointment.updated_at = starts_at, starts_at + length, now
    try:
        db.flush()
    except DBAPIError as exc:
        db.rollback()
        if mysql_error_number(exc) in (1062, 1644):
            raise SLOT_TAKEN from exc
        raise
    # The "time freed" notice has been acted on.
    db.execute(
        update(Notification)
        .where(
            Notification.appointment_id == appointment.appointment_id,
            Notification.type == "slot_freed",
            Notification.read_at.is_(None),
        )
        .values(read_at=now)
    )
    notify(db, appointment.professor_id, "appointment_moved", now, appointment_id=appointment.appointment_id)
    db.commit()
    return appointment
