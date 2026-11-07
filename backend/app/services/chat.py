"""Chat rules (CLAUDE.md Section 4, revised 2026-11-07): any student may message any active
professor, and the professor may answer any student, except that students cannot send while
the professor's weekly closed hours (chat_closed_hours) are on. Professors can always write.
Checked when a message is sent, so a closure that starts mid-conversation stops new student
messages at once; reading the conversation stays possible.

Closed hours as a range in the week: minutes from Sunday 00:00 (Riyadh), half-open
[start, end). An end at or before the start runs past midnight into the next day
(equal times close the whole day), and Saturday night wraps around to Sunday.
"""

from datetime import datetime, time, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.clock import riyadh_day_of_week, to_riyadh
from app.core.errors import AppError, not_found
from app.models import ChatClosedHours, Conversation, Notification, Professor, User

DAY = 24 * 60
WEEK = 7 * DAY

Span = tuple[int, int]  # minutes in the week, half-open


def chat_closed(until: datetime) -> AppError:
    return AppError(
        403,
        "CHAT_CLOSED",
        f"This professor is not taking messages right now. Messages open again at {until.isoformat()}Z.",
    )


def _minutes(at: time) -> int:
    return at.hour * 60 + at.minute


def closure_span(day_of_week: int, start: time, end: time) -> Span:
    begin = day_of_week * DAY + _minutes(start)
    length = (_minutes(end) - _minutes(start)) % DAY or DAY
    return begin, begin + length


def spans_overlap(a: Span, b: Span) -> bool:
    """Overlap anywhere in the week, counting a range that wraps past Saturday midnight."""
    return any(a[0] < b[1] + shift and b[0] + shift < a[1] for shift in (-WEEK, 0, WEEK))


def closed_until(closures: list[ChatClosedHours], now: datetime) -> datetime | None:
    """When students may write again (naive UTC), or None when chat is open now.
    Back-to-back closures count as one: the answer is the end of the whole closed stretch."""
    local = to_riyadh(now)
    second = (riyadh_day_of_week(local) * DAY + local.hour * 60 + local.minute) * 60 + local.second
    spans = [closure_span(c.day_of_week, c.start_time, c.end_time) for c in closures]
    # Each range in seconds, also one week earlier and later so wrapping ranges match.
    ranges = [(s * 60 + shift, e * 60 + shift) for s, e in spans for shift in (-WEEK * 60, 0, WEEK * 60)]
    end = next((e for s, e in ranges if s <= second < e), None)
    if end is None:
        return None
    # Follow touching or overlapping ranges, at most one week ahead.
    extended = True
    while extended and end - second < WEEK * 60:
        extended = False
        for s, e in ranges:
            if s <= end < e:
                end, extended = e, True
    return now + timedelta(seconds=min(end - second, WEEK * 60))


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
