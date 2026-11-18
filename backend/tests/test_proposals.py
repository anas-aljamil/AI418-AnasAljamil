"""Approved appointments (owner request S5c, 2026-11-18): a professor cancels with a reason,
or suggests another time that the student accepts or turns down."""

from tests.conftest import LAMA, NORA, OMAR, SAAD, YOUSEF

APPOINTMENTS = "/api/v1/appointments"
# Seed: appointment 6 is Saad with Dr. Noura, approved, Sunday 2026-10-11 10:30-10:45 Riyadh;
# appointment 7 is Saad with Dr. Noura, pending, Tuesday 10:00-10:15. Her Sunday booking time
# is 10:00-12:00. The clock is Monday 2026-10-05 10:00 Riyadh.
SUNDAY_11 = "2026-10-11T08:00:00Z"


def error(response) -> tuple[int, str]:
    return response.status_code, response.json()["error"]["code"]


def notices(client, headers) -> list[tuple[str, int]]:
    items = client.get("/api/v1/notifications?limit=50", headers=headers).json()["items"]
    return [(n["type"], n["appointment_id"]) for n in items if n["read_at"] is None]


def test_the_student_accepts_a_suggested_time_and_the_appointment_moves(client, auth):
    suggested = client.post(f"{APPOINTMENTS}/6/propose", json={"starts_at": SUNDAY_11}, headers=auth(NORA))
    assert suggested.status_code == 200
    body = suggested.json()
    assert (body["starts_at"], body["proposed_starts_at"], body["proposed_ends_at"]) == (
        "2026-10-11T07:30:00Z",
        SUNDAY_11,
        "2026-10-11T08:15:00Z",  # the same 15 minutes
    )
    assert ("time_proposed", 6) in notices(client, auth(SAAD))

    accepted = client.post(f"{APPOINTMENTS}/6/proposal/accept", headers=auth(SAAD))
    assert accepted.status_code == 200
    moved = accepted.json()
    assert (moved["starts_at"], moved["ends_at"], moved["status"], moved["proposed_starts_at"]) == (
        SUNDAY_11,
        "2026-10-11T08:15:00Z",
        "approved",
        None,
    )
    assert ("time_proposed", 6) not in notices(client, auth(SAAD))  # answered
    assert ("proposal_accepted", 6) in notices(client, auth(NORA))
    # Nothing is left to answer.
    assert error(client.post(f"{APPOINTMENTS}/6/proposal/accept", headers=auth(SAAD))) == (409, "NO_PROPOSAL")


def test_accepting_a_suggestion_for_a_pending_request_approves_it(client, auth):
    tuesday_1030 = "2026-10-13T07:30:00Z"
    client.post(f"{APPOINTMENTS}/7/propose", json={"starts_at": tuesday_1030}, headers=auth(NORA))
    accepted = client.post(f"{APPOINTMENTS}/7/proposal/accept", headers=auth(SAAD)).json()
    assert (accepted["starts_at"], accepted["status"]) == (tuesday_1030, "approved")


def test_the_student_keeps_their_time(client, auth):
    seeded = client.get(f"{APPOINTMENTS}/10", headers=auth(YOUSEF)).json()
    assert seeded["proposed_starts_at"] == "2026-10-15T07:00:00Z"  # seed: Dr. Omar suggests Thursday
    kept = client.post(f"{APPOINTMENTS}/10/proposal/decline", headers=auth(YOUSEF)).json()
    assert (kept["starts_at"], kept["status"], kept["proposed_starts_at"]) == (
        seeded["starts_at"],
        "pending",
        None,
    )
    assert ("proposal_declined", 10) in notices(client, auth(OMAR))


def test_a_suggested_time_follows_the_booking_rules(client, auth):
    def propose(starts_at: str, who=NORA, appointment: int = 6):
        return client.post(
            f"{APPOINTMENTS}/{appointment}/propose", json={"starts_at": starts_at}, headers=auth(who)
        )

    assert error(propose("2026-10-11T10:00:00Z")) == (422, "INVALID_SLOT")  # 13:00, after her booking time
    assert error(propose("2026-10-11T07:30:00Z")) == (422, "PROPOSAL_SAME_TIME")
    assert error(propose("2026-10-13T07:00:00Z")) == (409, "SLOT_TAKEN")  # appointment 7 is there
    assert error(propose("2026-10-04T07:30:00Z")) == (422, "SLOT_IN_PAST")
    assert error(propose("2026-10-25T07:30:00Z")) == (422, "OUTSIDE_BOOKING_WINDOW")
    # Moving by 5 minutes overlaps only the appointment itself, which does not count.
    assert propose("2026-10-11T07:35:00Z").status_code == 200
    # Only its professor suggests; its student answers.
    assert propose(SUNDAY_11, who=SAAD).status_code == 403
    assert error(propose(SUNDAY_11, who=OMAR)) == (404, "NOT_FOUND")
    assert client.post(f"{APPOINTMENTS}/6/proposal/accept", headers=auth(NORA)).status_code == 403


def test_accept_checks_the_time_is_still_free(client, auth):
    client.post(f"{APPOINTMENTS}/6/propose", json={"starts_at": SUNDAY_11}, headers=auth(NORA))
    # Meanwhile another student books that time: a suggestion reserves nothing.
    booked = client.post(
        APPOINTMENTS, json={"professor_id": NORA, "starts_at": SUNDAY_11, "minutes": 15}, headers=auth(LAMA)
    )
    assert booked.status_code == 201
    assert error(client.post(f"{APPOINTMENTS}/6/proposal/accept", headers=auth(SAAD))) == (409, "SLOT_TAKEN")
    unchanged = client.get(f"{APPOINTMENTS}/6", headers=auth(SAAD)).json()
    assert (unchanged["starts_at"], unchanged["proposed_starts_at"]) == ("2026-10-11T07:30:00Z", SUNDAY_11)


def test_a_professor_cancels_with_a_reason_the_student_sees(client, auth):
    cancelled = client.post(
        f"{APPOINTMENTS}/10/cancel", json={"reason": " Called to a committee that day. "}, headers=auth(OMAR)
    ).json()
    assert (cancelled["status"], cancelled["cancel_reason"], cancelled["proposed_starts_at"]) == (
        "cancelled",
        "Called to a committee that day.",
        None,  # the open suggestion ends with it
    )
    assert client.get(f"{APPOINTMENTS}/10", headers=auth(YOUSEF)).json()["cancel_reason"] == (
        "Called to a committee that day."
    )
    # A student cancels without a reason.
    with_reason = client.post(f"{APPOINTMENTS}/7/cancel", json={"reason": "Ill"}, headers=auth(SAAD))
    assert error(with_reason) == (422, "VALIDATION_ERROR")
    assert client.post(f"{APPOINTMENTS}/7/cancel", headers=auth(SAAD)).json()["cancel_reason"] is None


def test_the_professor_sees_the_appointments_own_time_as_free(client, auth):
    url = "/api/v1/professors/1/slots?date=2026-10-11&exclude=6"

    def at_1030(headers) -> bool:
        slots = client.get(url, headers=headers).json()["slots"]
        return next(s for s in slots if s["local_time"] == "10:30")["available"]

    assert at_1030(auth(NORA)) is True
    assert at_1030(auth(SAAD)) is False  # for anyone else the parameter changes nothing
