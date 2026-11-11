"""Chat rules (CLAUDE.md Section 4, revised 2026-11-07): any student may message any active
professor, and the professor may answer any student, except that students cannot send while
the professor's weekly closed hours (chat_closed_hours) are on. Professors can always write.
Checked when a message is sent, so a closure that starts mid-conversation stops new student
messages at once; reading the conversation stays possible.

Closed hours happen weekly or on one date (services/occurrence.py), as half-open ranges in
Riyadh time. An end at or before the start runs past midnight into the next day (equal
times close the whole day), so Saturday night runs into Sunday.
"""

from datetime import datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.clock import from_riyadh, to_riyadh
from app.core.errors import AppError, not_found
from app.models import ChatClosedHours, Conversation, Notification, Professor, User
from app.services.occurrence import intervals

WEEK = timedelta(days=7)


def chat_closed(until: datetime) -> AppError:
    return AppError(
        403,
        "CHAT_CLOSED",
        f"This professor is not taking messages right now. Messages open again at {until.isoformat()}Z.",
    )


def closed_until(closures: list[ChatClosedHours], now: datetime) -> datetime | None:
    """When students may write again (naive UTC), or None when chat is open now.
    Back-to-back closures count as one: the answer is the end of the whole closed stretch,
    at most one week ahead."""
    local = to_riyadh(now)
    today = local.date()
    # Yesterday's closures may run past midnight; a stretch is followed up to a week ahead.
    ranges = sorted(
        r for c in closures for r in intervals(c, today - timedelta(days=1), today + WEEK, overnight=True)
    )
    end = next((e for s, e in ranges if s <= local < e), None)
    if end is None:
        return None
    extended = True
    while extended and end - local < WEEK:
        extended = False
        for s, e in ranges:
            if s <= end < e:
                end, extended = e, True
    return from_riyadh(min(end, local + WEEK))


def professor_closed_until(db: Session, professor_id: int, now: datetime) -> datetime | None:
    closures = db.scalars(select(ChatClosedHours).where(ChatClosedHours.professor_id == professor_id)).all()
    return closed_until(list(closures), now)


def can_chat(db: Session, professor_id: int) -> bool:
    """A conversation can be opened with any professor whose account is active."""
    professor = db.get(Professor, professor_id)
    return professor is not None and professor.user.is_active


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
