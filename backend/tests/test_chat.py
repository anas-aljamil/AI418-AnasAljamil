"""Chat and notifications (CLAUDE.md Sections 4 and 8; docs/plan.md P5)."""

from sqlalchemy import select

from app.api.v1.conversations import message_limiter
from app.models import Appointment, Notification
from tests.conftest import ADMIN_EMAIL, FAISAL, HESSA, HUDA, LAMA, NORA, OMAR, SAAD, YOUSEF

CONV = "/api/v1/conversations"
NOTES = "/api/v1/notifications"


def code(response) -> str:
    return response.json()["error"]["code"]


def send(client, headers, conversation_id, body):
    return client.post(f"{CONV}/{conversation_id}/messages", json={"body": body}, headers=headers)


# --- who may chat --------------------------------------------------------------


def test_a_student_with_a_booking_reopens_the_existing_conversation(client, auth):
    response = client.post(CONV, json={"professor_id": NORA}, headers=auth(SAAD))
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["conversation_id"] == 1
    assert body["other"]["role"] == "professor" and body["other"]["honorific"] == "dr"
    assert body["last_message"]["mine"] is False


def test_no_booking_and_closed_messages_means_no_chat(client, auth):
    response = client.post(CONV, json={"professor_id": FAISAL}, headers=auth(YOUSEF))
    assert response.status_code == 403
    assert code(response) == "CHAT_NOT_ALLOWED"
    profile = client.get(f"/api/v1/professors/{FAISAL}", headers=auth(YOUSEF)).json()
    assert profile["can_message"] is False


def test_a_declined_booking_does_not_open_the_chat_but_a_pending_one_does(client, auth, db):
    assert client.get(f"/api/v1/professors/{OMAR}", headers=auth(YOUSEF)).json()["can_message"]
    for appointment in db.scalars(
        select(Appointment).where(Appointment.student_id == YOUSEF, Appointment.professor_id == OMAR)
    ):
        appointment.status = "declined"
    db.flush()
    response = client.post(CONV, json={"professor_id": OMAR}, headers=auth(YOUSEF))
    assert code(response) == "CHAT_NOT_ALLOWED"


def test_open_messages_let_any_student_write(client, auth):
    response = client.post(CONV, json={"professor_id": HUDA}, headers=auth(HESSA))
    assert response.status_code == 200, response.text
    created = response.json()
    assert created["last_message"] is None and created["unread_count"] == 0
    sent = send(client, auth(HESSA), created["conversation_id"], "أهلاً دكتورة")
    assert sent.status_code == 201


def test_a_professor_can_open_the_chat_with_an_eligible_student(client, auth):
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
