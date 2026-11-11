"""Chat and notifications (CLAUDE.md Sections 4 and 8; docs/plan.md P5)."""

from datetime import date, datetime, time, timedelta
from types import SimpleNamespace

from sqlalchemy import select

from app.api.v1.conversations import message_limiter
from app.models import Appointment, Message, Notification, User
from app.services import chat
from tests.conftest import ADMIN_EMAIL, FAISAL, HESSA, LAMA, NORA, SAAD, TARIQ, YOUSEF


def weekly(**fields):
    """A weekly closure without an end date or skipped dates."""
    return SimpleNamespace(on_date=None, ends_on=None, skipped_dates=[], **fields)


CONV = "/api/v1/conversations"
NOTES = "/api/v1/notifications"


def code(response) -> str:
    return response.json()["error"]["code"]


def send(client, headers, conversation_id, body):
    return client.post(f"{CONV}/{conversation_id}/messages", json={"body": body}, headers=headers)


# --- who may chat --------------------------------------------------------------


def test_a_student_reopens_the_existing_conversation(client, auth):
    response = client.post(CONV, json={"professor_id": NORA}, headers=auth(SAAD))
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["conversation_id"] == 1
    assert body["other"]["role"] == "professor" and body["other"]["honorific"] == "dr"
    assert body["last_message"]["mine"] is False


def test_any_student_can_write_to_a_professor_without_a_booking(client, auth, db):
    assert not db.scalar(
        select(Appointment).where(Appointment.student_id == YOUSEF, Appointment.professor_id == FAISAL)
    )
    profile = client.get(f"/api/v1/professors/{FAISAL}", headers=auth(YOUSEF)).json()
    assert profile["messages_closed_until"] is None and "can_message" not in profile
    response = client.post(CONV, json={"professor_id": FAISAL}, headers=auth(YOUSEF))
    assert response.status_code == 200, response.text
    created = response.json()
    assert created["last_message"] is None and created["closed_until"] is None
    sent = send(client, auth(YOUSEF), created["conversation_id"], "السلام عليكم دكتور")
    assert sent.status_code == 201


def test_students_cannot_write_during_the_professors_closed_hours(client, auth, db):
    # Tariq closes messages on Monday 08:00-12:00 Riyadh; it is Monday 10:00.
    profile = client.get(f"/api/v1/professors/{TARIQ}", headers=auth(HESSA)).json()
    assert profile["messages_closed_until"] == "2026-10-05T09:00:00Z"  # 12:00 Riyadh
    opened = client.post(CONV, json={"professor_id": TARIQ}, headers=auth(HESSA))
    assert opened.status_code == 200  # the conversation opens; only sending waits
    conversation = opened.json()
    assert conversation["closed_until"] == "2026-10-05T09:00:00Z"
    refused = send(client, auth(HESSA), conversation["conversation_id"], "Hello Dr. Haddad")
    assert (refused.status_code, code(refused)) == (403, "CHAT_CLOSED")
    assert not db.scalar(select(Message).where(Message.conversation_id == conversation["conversation_id"]))
    # The professor can still write during his own closed hours.
    answer = send(client, auth(TARIQ), conversation["conversation_id"], "I will reply after 12.")
    assert answer.status_code == 201


def test_chat_opens_again_when_the_closed_hours_end(client, auth, clock):
    opened = client.post(CONV, json={"professor_id": TARIQ}, headers=auth(HESSA)).json()
    clock.at = datetime(2026, 10, 5, 9, 0)  # 12:00 Riyadh: the closure has ended (half-open)
    assert send(client, auth(HESSA), opened["conversation_id"], "Hello again").status_code == 201
    listed = client.get(CONV, headers=auth(HESSA)).json()["items"]
    assert all(c["closed_until"] is None for c in listed)


def test_back_to_back_closures_count_as_one_stretch():
    # Noura: Thursday 16:00 -> midnight, then all of Friday. On Thursday 17:00 Riyadh
    # students can write again only at Saturday 00:00 Riyadh.
    closures = [
        weekly(day_of_week=4, start_time=time(16), end_time=time(0)),
        weekly(day_of_week=5, start_time=time(0), end_time=time(0)),
    ]
    thursday_17 = datetime(2026, 10, 8, 14, 0)
    assert chat.closed_until(closures, thursday_17) == datetime(2026, 10, 9, 21, 0)
    assert chat.closed_until(closures, datetime(2026, 10, 8, 12, 59)) is None  # 15:59 Riyadh


def test_a_saturday_night_closure_still_holds_on_sunday_morning():
    closures = [weekly(day_of_week=6, start_time=time(22), end_time=time(7))]
    sunday_3am = datetime(2026, 10, 4, 0, 0)  # Sunday 03:00 Riyadh
    assert chat.closed_until(closures, sunday_3am) == datetime(2026, 10, 4, 4, 0)  # 07:00 Riyadh
    assert chat.closed_until(closures, datetime(2026, 10, 4, 4, 0)) is None


def test_an_inactive_professor_cannot_be_messaged(client, auth, db):
    db.get(User, FAISAL).is_active = False
    db.flush()
    response = client.post(CONV, json={"professor_id": FAISAL}, headers=auth(YOUSEF))
    assert response.status_code == 404


def test_a_professor_can_open_the_chat_with_a_student(client, auth):
    response = client.post(CONV, json={"student_id": LAMA}, headers=auth(NORA))
    assert response.status_code == 200
    assert response.json()["conversation_id"] == 2


def test_only_participants_see_a_conversation(client, auth):
    assert client.get(f"{CONV}/1/messages", headers=auth(LAMA)).status_code == 404
    assert send(client, auth(LAMA), 1, "hello").status_code == 404
    admin = client.get(CONV, headers=auth(ADMIN_EMAIL))
    assert admin.status_code == 403


# --- messages, read receipts, notifications --------------------------------------------


def test_sending_reading_and_the_read_receipt(client, auth, db):
    sent = send(client, auth(SAAD), 1, "  Shall I bring the printed draft?  ")
    assert sent.status_code == 201, sent.text
    message = sent.json()
    assert (message["mine"], message["body"], message["read_at"]) == (
        True,
        "Shall I bring the printed draft?",
        None,
    )

    # The professor sees it unread, newest first, with one "new message" notification.
    assert client.get(f"{NOTES}/unread", headers=auth(NORA)).json()["messages"] == 1
    listed = client.get(f"{CONV}/1/messages", headers=auth(NORA)).json()
    assert listed["items"][0]["message_id"] == message["message_id"]
    assert listed["items"][0]["mine"] is False
    send(client, auth(SAAD), 1, "And the slides?")
    unread_notes = db.scalars(
        select(Notification).where(
            Notification.user_id == NORA,
            Notification.type == "new_message",
            Notification.read_at.is_(None),
        )
    ).all()
    assert len(unread_notes) == 1  # merged, not one per message

    # Reading the conversation marks the messages read; the student sees the receipt.
    assert client.post(f"{CONV}/1/read", headers=auth(NORA)).status_code == 204
    assert client.get(f"{NOTES}/unread", headers=auth(NORA)).json()["messages"] == 0
    mine = client.get(f"{CONV}/1/messages", headers=auth(SAAD)).json()["items"]
    assert all(m["read_at"] for m in mine if m["mine"])
    conversations = client.get(CONV, headers=auth(NORA)).json()["items"]
    assert conversations[0]["conversation_id"] == 1  # latest activity first
    assert conversations[0]["unread_count"] == 0


def test_messages_are_validated(client, auth):
    assert code(send(client, auth(SAAD), 1, "   ")) == "VALIDATION_ERROR"
    assert code(send(client, auth(SAAD), 1, "x" * 1001)) == "VALIDATION_ERROR"
    assert send(client, auth(SAAD), 1, "x" * 1000).status_code == 201


def test_sending_is_rate_limited(client, auth):
    message_limiter.reset()
    try:
        for n in range(20):
            assert send(client, auth(SAAD), 1, f"message {n}").status_code == 201
        limited = send(client, auth(SAAD), 1, "one too many")
        assert limited.status_code == 429
        assert code(limited) == "RATE_LIMITED"
    finally:
        message_limiter.reset()


def test_notifications_list_the_other_person_and_can_be_marked_read(client, auth):
    page = client.get(NOTES, headers=auth(NORA)).json()
    first = page["items"][0]
    assert first["type"] == "appointment_requested"
    assert first["actor"]["user_id"] == SAAD and first["actor"]["role"] == "student"
    assert first["starts_at"].endswith("Z")
    assert client.get(f"{NOTES}/unread", headers=auth(NORA)).json()["notifications"] == 1

    response = client.post(f"{NOTES}/read", json={"ids": [first["notification_id"]]}, headers=auth(NORA))
    assert response.status_code == 204
    assert client.get(f"{NOTES}/unread", headers=auth(NORA)).json()["notifications"] == 0

    # Someone else's notification id changes nothing.
    client.post(f"{NOTES}/read", json={"ids": [6]}, headers=auth(NORA))
    assert client.get(f"{NOTES}/unread", headers=auth(HESSA)).json()["notifications"] == 1
    client.post(f"{NOTES}/read", json={}, headers=auth(HESSA))
    assert client.get(f"{NOTES}/unread", headers=auth(HESSA)).json()["notifications"] == 0


def test_a_new_message_notification_names_the_sender(client, auth):
    send(client, auth(LAMA), 2, "Is Thursday still fine?")
    note = client.get(NOTES, headers=auth(NORA)).json()["items"][0]
    assert note["type"] == "new_message" and note["conversation_id"] == 2
    assert note["actor"]["full_name_en"] == "Lama Al-Shehri"
    assert note["starts_at"] is None


def test_dated_and_skipped_closed_hours():
    thursday_10am = datetime(2026, 10, 15, 7, 0)  # Thursday 15 October, 10:00 Riyadh
    whole_day = SimpleNamespace(
        day_of_week=None,
        on_date=date(2026, 10, 15),
        ends_on=None,
        skipped_dates=[],
        start_time=time(0),
        end_time=time(0),
    )
    assert chat.closed_until([whole_day], thursday_10am) == datetime(2026, 10, 15, 21, 0)  # midnight
    assert chat.closed_until([whole_day], thursday_10am + timedelta(days=7)) is None  # once only
    evenings = weekly(day_of_week=4, start_time=time(9), end_time=time(12))
    evenings.skipped_dates = [date(2026, 10, 15)]
    assert chat.closed_until([evenings], thursday_10am) is None  # skipped this Thursday
    assert chat.closed_until([evenings], thursday_10am + timedelta(days=7)) == datetime(2026, 10, 22, 9, 0)
