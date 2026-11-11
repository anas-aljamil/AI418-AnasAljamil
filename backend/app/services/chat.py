"""Chat rules (CLAUDE.md Section 4): a student and a professor may message each other only
after the student has at least one appointment with the professor that was not declined, or
when the professor has turned on "open messages". Checked when a conversation is opened and
on every message, so a rule that stops holding stops the chat too."""

from datetime import datetime

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.errors import AppError, not_found
from app.models import Appointment, Conversation, Notification, Professor, User

CHAT_NOT_ALLOWED = AppError(
    403,
    "CHAT_NOT_ALLOWED",
    "You can message this professor after booking an appointment with them.",
)


def can_chat(db: Session, student_id: int, professor_id: int) -> bool:
    professor = db.get(Professor, professor_id)
    if professor is None:
        return False
    if professor.open_messages:
        return True
    booked = db.scalar(
        select(func.count())
        .select_from(Appointment)
        .where(
            Appointment.student_id == student_id,
            Appointment.professor_id == professor_id,
            Appointment.status != "declined",
        )
    )
    return bool(booked)


def get_for_participant(db: Session, conversation_id: int, user: User) -> Conversation:
    """The conversation, if the user takes part in it; otherwise 404 (not 403), like appointments."""
    conversation = db.get(Conversation, conversation_id)
    if conversation is None or user.user_id not in (conversation.student_id, conversation.professor_id):
        raise not_found("Conversation")
    return conversation


def other_party(conversation: Conversation, user: User) -> int:
    return conversation.professor_id if user.user_id == conversation.student_id else conversation.student_id


def notify_new_message(db: Session, recipient_id: int, conversation_id: int, now: datetime) -> None:
    """One unread "new message" notification per conversation: a newer message moves it up
    instead of adding another, so a chatty thread does not flood the list."""
    unread = db.scalar(
        select(Notification).where(
            Notification.user_id == recipient_id,
            Notification.type == "new_message",
            Notification.conversation_id == conversation_id,
            Notification.read_at.is_(None),
        )
    )
    if unread:
        unread.created_at = now
    else:
        db.add(
            Notification(
                user_id=recipient_id,
                type="new_message",
                conversation_id=conversation_id,
                created_at=now,
            )
        )
