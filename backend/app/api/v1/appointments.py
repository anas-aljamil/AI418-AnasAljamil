"""Booking and the appointment lifecycle."""

from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.core.clock import Clock, get_clock
from app.core.pagination import Page, PageParams, page_params, paginate
from app.db import get_db
from app.deps import current_student, get_current_user
from app.models import Appointment, Professor, Student, User
from app.schemas import (
    AppointmentOut,
    AppointmentProfessorOut,
    BookingIn,
    EarlierStartsOut,
    MoveIn,
    OfficeOut,
    PersonOut,
)
from app.services import booking

router = APIRouter(prefix="/appointments", tags=["appointments"])

AppointmentStatus = Literal["pending", "approved", "declined", "cancelled", "completed", "no_show"]


def appointment_out(a: Appointment) -> AppointmentOut:
    student, professor = a.student, a.professor
    return AppointmentOut(
        appointment_id=a.appointment_id,
        status=a.status,
        starts_at=a.starts_at,
        ends_at=a.ends_at,
        cancel_deadline=a.starts_at - booking.CANCEL_NOTICE,
        topic=a.topic,
        note=a.note,
        created_at=a.created_at,
        updated_at=a.updated_at,
        student=PersonOut(
            user_id=student.student_id,
            full_name_ar=student.user.full_name_ar,
            full_name_en=student.user.full_name_en,
        ),
        professor=AppointmentProfessorOut(
            user_id=professor.professor_id,
            full_name_ar=professor.user.full_name_ar,
            full_name_en=professor.user.full_name_en,
            honorific=professor.honorific,
            office=OfficeOut.model_validate(professor.office) if professor.office else None,
        ),
    )


@router.get("", response_model=Page[AppointmentOut], summary="My appointments (upcoming or past)")
def list_appointments(
    scope: Literal["upcoming", "past", "all"] = "upcoming",
    status: Annotated[list[AppointmentStatus] | None, Query()] = None,
    page: PageParams = Depends(page_params),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    clock: Clock = Depends(get_clock),
) -> Page[AppointmentOut]:
    now = clock.now()
    query = select(Appointment).options(
        joinedload(Appointment.student).joinedload(Student.user),
        joinedload(Appointment.professor).joinedload(Professor.office),
    )
    if user.role == "student":
        query = query.where(Appointment.student_id == user.user_id)
    elif user.role == "professor":
        query = query.where(Appointment.professor_id == user.user_id)
    if scope == "upcoming":
        query = query.where(Appointment.ends_at > now).order_by(Appointment.starts_at)
    elif scope == "past":
        query = query.where(Appointment.ends_at <= now).order_by(Appointment.starts_at.desc())
    else:
        query = query.order_by(Appointment.starts_at.desc())
    if status:
        query = query.where(Appointment.status.in_(status))
    rows = db.scalars(query).unique().all()
    return paginate([appointment_out(a) for a in rows], page)


@router.post("", response_model=AppointmentOut, status_code=201, summary="Book a slot (students)")
def create_appointment(
    body: BookingIn,
    user: User = Depends(current_student),
    db: Session = Depends(get_db),
    clock: Clock = Depends(get_clock),
) -> AppointmentOut:
    appointment = booking.book(
        db,
        user.user_id,
        body.professor_id,
        body.starts_at_utc(),
        body.minutes,
        body.topic,
        body.note,
        clock.now(),
    )
    return appointment_out(appointment)


@router.get("/{appointment_id}", response_model=AppointmentOut, summary="One of my appointments")
def get_appointment(
    appointment_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> AppointmentOut:
    return appointment_out(booking.get_for_participant(db, appointment_id, user))


@router.get(
    "/{appointment_id}/earlier-starts",
    response_model=EarlierStartsOut,
    summary="Free earlier starts the same day where this appointment fits (its student)",
)
def get_earlier_starts(
    appointment_id: int,
    user: User = Depends(current_student),
    db: Session = Depends(get_db),
    clock: Clock = Depends(get_clock),
) -> EarlierStartsOut:
    appointment = booking.get_for_participant(db, appointment_id, user)
    starts = (
        booking.earlier_starts(db, appointment, clock.now()) if appointment.status in booking.ACTIVE else []
    )
    return EarlierStartsOut(appointment_id=appointment_id, starts=starts)


@router.post(
    "/{appointment_id}/move",
    response_model=AppointmentOut,
    summary="Move my appointment earlier the same day (students); length and status stay",
)
def move_appointment(
    appointment_id: int,
    body: MoveIn,
    user: User = Depends(current_student),
    db: Session = Depends(get_db),
    clock: Clock = Depends(get_clock),
) -> AppointmentOut:
    return appointment_out(booking.move_earlier(db, appointment_id, body.starts_at_utc(), user, clock.now()))


@router.post(
    "/{appointment_id}/{action}",
    response_model=AppointmentOut,
    summary="approve | decline (professor), cancel (either side), complete | no-show (professor)",
)
def change_appointment(
    appointment_id: int,
    action: Literal["approve", "decline", "cancel", "complete", "no-show"],
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    clock: Clock = Depends(get_clock),
) -> AppointmentOut:
    return appointment_out(booking.transition(db, appointment_id, action, user, clock.now()))
