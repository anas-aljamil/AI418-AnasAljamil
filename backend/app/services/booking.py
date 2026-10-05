"""Booking and the appointment lifecycle (CLAUDE.md section 4).

Rules enforced here, before the database's own guards (unique active-slot
index and overlap triggers) act as the backstop:
* the start must be a free slot on the professor's grid, in the future and
  inside the booking window;
* a student holds at most 2 pending/approved future appointments per professor;
* cancellation is allowed until 1 hour before the start;
* transitions: pending -> approved | declined | cancelled;
  approved -> cancelled | completed | no_show (the last two once it has started).
"""

from datetime import datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.exc import DBAPIError
from sqlalchemy.orm import Session

from app.core.errors import AppError, forbidden, mysql_error_number, not_found
from app.models import Appointment, Professor, ScheduleBlock, Student, User
from app.services.notify import notify
from app.services.slots import booking_window_end, find_block

ACTIVE = ("pending", "approved")
MAX_ACTIVE_PER_PROFESSOR = 2
CANCEL_NOTICE = timedelta(hours=1)

SLOT_TAKEN = AppError(409, "SLOT_TAKEN", "This time is already booked. Choose another slot.")


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


def book(
    db: Session,
    student_id: int,
    professor_id: int,
    starts_at: datetime,
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
    blocks = db.scalars(select(ScheduleBlock).where(ScheduleBlock.professor_id == professor_id)).all()
    if find_block(list(blocks), starts_at, professor.slot_minutes) is None:
        raise AppError(422, "INVALID_SLOT", "This time is not one of the professor's office-hour slots.")

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

    ends_at = starts_at + timedelta(minutes=professor.slot_minutes)
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
    db.commit()
    return appointment
