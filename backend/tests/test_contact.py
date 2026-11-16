"""Help and contact messages (2026-11-16) and the optional reason when declining."""

from app.api.v1.contact import contact_limiter
from tests.conftest import ADMIN_EMAIL, NORA, OMAR, SAAD

CONTACT = "/api/v1/contact"
ADMIN = "/api/v1/admin/contact-messages"
BOOK = "/api/v1/appointments"
MESSAGE = {
    "name": "  Test Sender ",
    "email": "T.Sender@University.Example",
    "topic": "idea",
    "body": " Hello there ",
}


def setup_function() -> None:
    contact_limiter.reset()


def test_anyone_may_write_and_a_signed_in_sender_is_linked(client, auth):
    anonymous = client.post(CONTACT, json=MESSAGE)
    assert anonymous.status_code == 201
    sent = anonymous.json()
    assert (sent["user_id"], sent["sender_name"], sent["sender_email"], sent["body"]) == (
        None,
        "Test Sender",
        "t.sender@university.example",
        "Hello there",
    )
    assert sent["handled_at"] is None
    signed_in = client.post(CONTACT, json=MESSAGE, headers=auth(SAAD)).json()
    assert signed_in["user_id"] == SAAD
    # A bad token is the same as none: the form still works for someone signed out.
    stale = client.post(CONTACT, json=MESSAGE, headers={"Authorization": "Bearer not-a-token"})
    assert stale.status_code == 201 and stale.json()["user_id"] is None


def test_the_form_is_checked_and_rate_limited(client):
    for bad in ({"body": "Hi"}, {"email": "not-an-address"}, {"topic": "spam"}, {"name": "A"}):
        response = client.post(CONTACT, json={**MESSAGE, **bad})
        assert response.status_code == 422, bad
    for _ in range(3):
        assert client.post(CONTACT, json=MESSAGE).status_code == 201
    limited = client.post(CONTACT, json=MESSAGE)
    assert (limited.status_code, limited.json()["error"]["code"]) == (429, "RATE_LIMITED")


def test_the_admin_lists_handles_and_deletes_messages(client, auth):
    headers = auth(ADMIN_EMAIL)
    listed = client.get(ADMIN, headers=headers).json()
    assert listed["total"] == 6  # the seed
    open_first = [m["handled_at"] is None for m in listed["items"]]
    assert open_first == sorted(open_first, reverse=True)
    open_ids = [
        m["contact_id"] for m in client.get(f"{ADMIN}?handled=false", headers=headers).json()["items"]
    ]
    assert sorted(open_ids) == [2, 4, 6]

    handled = client.patch(f"{ADMIN}/2", json={"handled": True}, headers=headers).json()
    assert handled["handled_at"] == "2026-10-05T07:00:00Z"
    again = client.patch(f"{ADMIN}/2", json={"handled": True}, headers=headers).json()
    assert again["handled_at"] == handled["handled_at"]  # marking twice keeps the first time
    reopened = client.patch(f"{ADMIN}/2", json={"handled": False}, headers=headers).json()
    assert reopened["handled_at"] is None

    assert client.delete(f"{ADMIN}/6", headers=headers).status_code == 204
    assert client.patch(f"{ADMIN}/6", json={"handled": True}, headers=headers).status_code == 404
    assert client.get(ADMIN, headers=auth(SAAD)).status_code == 403
    assert client.get(ADMIN).status_code == 401


def test_a_professor_may_give_a_reason_when_declining(client, auth):
    declined = client.post(
        f"{BOOK}/10/decline", json={"reason": "  On leave that week. "}, headers=auth(OMAR)
    )
    assert declined.status_code == 200
    assert (declined.json()["status"], declined.json()["decline_reason"]) == (
        "declined",
        "On leave that week.",
    )
    seen = client.get(f"{BOOK}/10", headers=auth(11)).json()  # the student who asked
    assert seen["decline_reason"] == "On leave that week."
    # Without a body, as before; a reason with another action is refused.
    assert client.post(f"{BOOK}/8/decline", headers=auth(3)).json()["decline_reason"] is None
    approve = client.post(f"{BOOK}/7/approve", json={"reason": "Fine"}, headers=auth(NORA))
    assert (approve.status_code, approve.json()["error"]["code"]) == (422, "VALIDATION_ERROR")
    assert client.post(f"{BOOK}/7/approve", json={}, headers=auth(NORA)).json()["status"] == "approved"
