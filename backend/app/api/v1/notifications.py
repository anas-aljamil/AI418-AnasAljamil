"""In-app notifications (polled; no push, CLAUDE.md Section 3). The client writes the text
from the type, the other person (actor) and, for appointments, the start time."""

from fastapi import APIRouter, Depends, Response
from sqlalchemy import func, select, update
from sqlalchemy.orm import Session

from app.api.v1.conversations import participant_out
from app.core.clock import Clock, get_clock
from app.core.pagination import Page, PageParams, page_params
from app.db import get_db
from app.deps import get_current_user
from app.models import Appointment, Conversation, Message, Notification, User
from app.schemas import NotificationOut, ReadIn, UnreadOut

router = APIRouter(prefix="/notifications", tags=["notifications"])


def notification_out(db: Session, notification: Notification, user: User) -> NotificationOut:
    actor_id, starts_at = None, None
    if notification.appointment_id is not None:
        appointment = db.get(Appointment, notification.appointment_id)
        starts_at = appointment.starts_at
        actor_id = (
            appointment.professor_id if user.user_id == appointment.student_id else appointment.student_id
        )
    elif notification.conversation_id is not None:
        conversation = db.get(Conversation, notification.conversation_id)
        actor_id = (
            conversation.professor_id if user.user_id == conversation.student_id else conversation.student_id
        )
    return NotificationOut(
        notification_id=notification.notification_id,
        type=notification.type,
        created_at=notification.created_at,
        read_at=notification.read_at,
        appointment_id=notification.appointment_id,
        conversation_id=notification.conversation_id,
        actor=participant_out(db, actor_id) if actor_id is not None else None,
        starts_at=starts_at,
    )


@router.get("", response_model=Page[NotificationOut], summary="My notifications, newest first")
def list_notifications(
    page: PageParams = Depends(page_params),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Page[NotificationOut]:
    where = Notification.user_id == user.user_id
    total = db.scalar(select(func.count()).select_from(Notification).where(where))
    rows = db.scalars(
        select(Notification)
        .where(where)
        .order_by(Notification.created_at.desc(), Notification.notification_id.desc())
        .offset(page.offset)
        .limit(page.limit)
    ).all()
    return Page[NotificationOut](
        items=[notification_out(db, n, user) for n in rows],
        total=total,
        limit=page.limit,
        offset=page.offset,
    )


@router.get("/unread", response_model=UnreadOut, summary="Unread counts for the badges")
def unread_counts(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> UnreadOut:
    notifications = db.scalar(
        select(func.count())
        .select_from(Notification)
        .where(Notification.user_id == user.user_id, Notification.read_at.is_(None))
    )
    messages = db.scalar(
        select(func.count())
        .select_from(Message)
        .join(Conversation, Conversation.conversation_id == Message.conversation_id)
        .where(
            (Conversation.student_id == user.user_id) | (Conversation.professor_id == user.user_id),
            Message.sender_role != user.role,
            Message.read_at.is_(None),
        )
    )
    return UnreadOut(notifications=notifications, messages=messages)


@router.post("/read", status_code=204, summary="Mark some (ids) or all of my notifications read")
def mark_read(
    body: ReadIn,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    clock: Clock = Depends(get_clock),
) -> Response:
    now = clock.now()
    query = update(Notification).where(
        Notification.user_id == user.user_id,
        Notification.read_at.is_(None),
        Notification.created_at <= now,
    )
    if body.ids is not None:
        query = query.where(Notification.notification_id.in_(body.ids))
    db.execute(query.values(read_at=now))
    db.commit()
    return Response(status_code=204)
