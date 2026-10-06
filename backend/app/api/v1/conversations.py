"""Chat between a student and a professor (CLAUDE.md Section 4; rules in app/services/chat.py).

Messages are listed newest first (pages go back in time); reading a conversation marks the
other side's messages read (read receipts) and clears its "new message" notification.
Sending is rate-limited per user (CLAUDE.md Section 8).
"""

from fastapi import APIRouter, Depends, Response
from sqlalchemy import func, select, update
from sqlalchemy.orm import Session

from app.config import get_settings
from app.core.clock import Clock, get_clock
from app.core.errors import not_found
from app.core.pagination import Page, PageParams, page_params
from app.core.rate_limit import RateLimiter
from app.db import get_db
from app.deps import require_role
from app.models import Conversation, Message, Notification, Professor, Student, User
from app.schemas import (
    ConversationIn,
    ConversationOut,
    LastMessageOut,
    MessageIn,
    MessageOut,
    ParticipantOut,
)
from app.services import chat

router = APIRouter(prefix="/conversations", tags=["chat"])
participant = require_role("student", "professor")
message_limiter = RateLimiter(get_settings().messages_per_minute, 60)


def participant_out(db: Session, user_id: int) -> ParticipantOut:
    user = db.get(User, user_id)
    professor = db.get(Professor, user_id) if user.role == "professor" else None
    return ParticipantOut(
        user_id=user.user_id,
        full_name_ar=user.full_name_ar,
        full_name_en=user.full_name_en,
        role=user.role,
        honorific=professor.honorific if professor else None,
    )


def message_out(message: Message, user: User) -> MessageOut:
    return MessageOut(
        message_id=message.message_id,
        sender_role=message.sender_role,
        mine=message.sender_role == user.role,
        body=message.body,
        created_at=message.created_at,
        read_at=message.read_at,
    )


def conversation_out(db: Session, conversation: Conversation, user: User) -> ConversationOut:
    last = db.scalar(
        select(Message)
        .where(Message.conversation_id == conversation.conversation_id)
        .order_by(Message.created_at.desc(), Message.message_id.desc())
        .limit(1)
    )
    unread = db.scalar(
        select(func.count())
        .select_from(Message)
        .where(
            Message.conversation_id == conversation.conversation_id,
            Message.sender_role != user.role,
            Message.read_at.is_(None),
        )
    )
    return ConversationOut(
        conversation_id=conversation.conversation_id,
        other=participant_out(db, chat.other_party(conversation, user)),
        last_message=LastMessageOut(
            body=last.body, mine=last.sender_role == user.role, created_at=last.created_at
        )
        if last
        else None,
        unread_count=unread,
        created_at=conversation.created_at,
    )


@router.get("", response_model=Page[ConversationOut], summary="My conversations, latest activity first")
def list_conversations(
    page: PageParams = Depends(page_params),
    user: User = Depends(participant),
    db: Session = Depends(get_db),
) -> Page[ConversationOut]:
    mine = db.scalars(
        select(Conversation).where(
            (Conversation.student_id == user.user_id) | (Conversation.professor_id == user.user_id)
        )
    ).all()
    rows = [conversation_out(db, c, user) for c in mine]
    rows.sort(key=lambda r: r.last_message.created_at if r.last_message else r.created_at, reverse=True)
    return Page[ConversationOut](
        items=rows[page.offset : page.offset + page.limit],
        total=len(rows),
        limit=page.limit,
        offset=page.offset,
    )


@router.post("", response_model=ConversationOut, summary="Open (or reopen) the conversation with someone")
def open_conversation(
    body: ConversationIn,
    user: User = Depends(participant),
    db: Session = Depends(get_db),
    clock: Clock = Depends(get_clock),
) -> ConversationOut:
    if user.role == "student":
        student_id, professor_id = user.user_id, body.professor_id
        if professor_id is None or db.get(Professor, professor_id) is None:
            raise not_found("Professor")
    else:
        student_id, professor_id = body.student_id, user.user_id
        if student_id is None or db.get(Student, student_id) is None:
            raise not_found("Student")
    if not chat.can_chat(db, student_id, professor_id):
        raise chat.CHAT_NOT_ALLOWED
    conversation = db.scalar(
        select(Conversation).where(
            Conversation.student_id == student_id, Conversation.professor_id == professor_id
        )
    )
    if conversation is None:
        conversation = Conversation(student_id=student_id, professor_id=professor_id, created_at=clock.now())
        db.add(conversation)
        db.commit()
    return conversation_out(db, conversation, user)


@router.get(
    "/{conversation_id}/messages",
    response_model=Page[MessageOut],
    summary="Messages, newest first (offset goes back in time)",
)
def list_messages(
    conversation_id: int,
    page: PageParams = Depends(page_params),
    user: User = Depends(participant),
    db: Session = Depends(get_db),
) -> Page[MessageOut]:
    chat.get_for_participant(db, conversation_id, user)
    where = Message.conversation_id == conversation_id
    total = db.scalar(select(func.count()).select_from(Message).where(where))
    rows = db.scalars(
        select(Message)
        .where(where)
        .order_by(Message.created_at.desc(), Message.message_id.desc())
        .offset(page.offset)
        .limit(page.limit)
    ).all()
    return Page[MessageOut](
        items=[message_out(m, user) for m in rows], total=total, limit=page.limit, offset=page.offset
    )


@router.post(
    "/{conversation_id}/messages",
    response_model=MessageOut,
    status_code=201,
    summary="Send a message (rate-limited)",
)
def send_message(
    conversation_id: int,
    body: MessageIn,
    user: User = Depends(participant),
    db: Session = Depends(get_db),
    clock: Clock = Depends(get_clock),
) -> MessageOut:
    conversation = chat.get_for_participant(db, conversation_id, user)
    message_limiter.check(str(user.user_id))
    if not chat.can_chat(db, conversation.student_id, conversation.professor_id):
        raise chat.CHAT_NOT_ALLOWED
    now = clock.now()
    message = Message(conversation_id=conversation_id, sender_role=user.role, body=body.body, created_at=now)
    db.add(message)
    chat.notify_new_message(db, chat.other_party(conversation, user), conversation_id, now)
    db.commit()
    return message_out(message, user)


@router.post(
    "/{conversation_id}/read",
    status_code=204,
    summary="Mark the other side's messages read (read receipts)",
)
def mark_read(
    conversation_id: int,
    user: User = Depends(participant),
    db: Session = Depends(get_db),
    clock: Clock = Depends(get_clock),
) -> Response:
    chat.get_for_participant(db, conversation_id, user)
    now = clock.now()
    db.execute(
        update(Message)
        .where(
            Message.conversation_id == conversation_id,
            Message.sender_role != user.role,
            Message.read_at.is_(None),
            Message.created_at <= now,
        )
        .values(read_at=now)
    )
    db.execute(
        update(Notification)
        .where(
            Notification.user_id == user.user_id,
            Notification.conversation_id == conversation_id,
            Notification.read_at.is_(None),
            Notification.created_at <= now,
        )
        .values(read_at=now)
    )
    db.commit()
    return Response(status_code=204)
