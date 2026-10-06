"""CLAUDE.md section 4: booking rules and the appointment lifecycle."""

from datetime import datetime, timedelta

import pytest
from sqlalchemy import select
from sqlalchemy.exc import DBAPIError

from app.models import Appointment, Notification
from app.services import booking
from tests.conftest import HUDA, KHALID, LAMA, MAHA, NORA, OMAR, REEM, SAAD, YOUSEF

BOOK = "/api/v1/appointments"


def book(client, headers, professor_id, starts_at, **extra):
    return client.post(
        BOOK, json={"professor_id": professor_id, "starts_at": starts_at, **extra}, headers=headers
    )


def code(response) -> str:
    return response.json()["error"]["code"]


# --- booking ------------------------------------------------------------------


def test_student_books_a_free_slot_and_the_professor_is_notified(client, auth, db):
    response = book(
        client, auth(LAMA), NORA, "2026-10-11T10:15:00+03:00", topic="assignment", note="Report draft"
    )
    assert response.status_code == 201, response.text
    body = response.json()
    assert (body["status"], body["starts_at"], body["ends_at"]) == (
        "pending",
        "2026-10-11T07:15:00Z",
        "2026-10-11T07:30:00Z",
    )
    assert body["cancel_deadline"] == "2026-10-11T06:15:00Z"
    note = db.scalar(select(Notification).where(Notification.appointment_id == body["appointment_id"]))
    assert (note.user_id, note.type) == (NORA, "appointment_requested")


def test_slot_cannot_be_double_booked(client, auth):
    taken = book(client, auth(LAMA), NORA, "2026-10-11T07:30:00Z")  # Saad's approved appointment
    assert (taken.status_code, code(taken)) == (409, "SLOT_TAKEN")


def test_database_rejects_double_booking_even_without_the_api(db):
    """The API pre-checks; the trigger and unique index are the backstop (CLAUDE.md section 4)."""
    for start, end in [
        ("2026-10-11 07:30:00", "2026-10-11 07:45:00"),  # same start
        ("2026-10-11 07:20:00", "2026-10-11 07:35:00"),
    ]:  # overlap
        db.add(
            Appointment(
                student_id=LAMA,
                professor_id=NORA,
                starts_at=datetime.fromisoformat(start),
                ends_at=datetime.fromisoformat(end),
                status="pending",
                created_at=datetime(2026, 10, 5),
                updated_at=datetime(2026, 10, 5),
            )
        )
        with pytest.raises(DBAPIError) as caught:
            db.flush()
        assert caught.value.orig.args[0] == 1644  # SIGNAL SQLSTATE '45000' from the overlap trigger
        db.rollback()


def test_a_lost_race_is_caught_by_the_database_and_reported_as_slot_taken(client, auth, monkeypatch):
    """Simulate two requests passing the API check at once: the trigger still refuses the second."""
    monkeypatch.setattr(booking, "overlapping_active", lambda *args, **kwargs: False)
    response = book(client, auth(LAMA), NORA, "2026-10-11T07:30:00Z")
    assert (response.status_code, code(response)) == (409, "SLOT_TAKEN")


def test_student_cannot_hold_more_than_2_upcoming_appointments_per_professor(client, auth):
    # Saad already has an approved and a pending appointment with Noura next week.
    third = book(client, auth(SAAD), NORA, "2026-10-13T10:30:00+03:00")
    assert (third.status_code, code(third)) == (409, "BOOKING_LIMIT")
    # The limit is per professor: another professor is fine.
    assert book(client, auth(SAAD), HUDA, "2026-10-12T10:15:00+03:00").status_code == 201


def test_past_and_cancelled_appointments_do_not_count_toward_the_limit(client, auth):
    headers = auth(SAAD)
    assert client.post(f"{BOOK}/7/cancel", headers=headers).status_code == 200
    assert book(client, headers, NORA, "2026-10-13T10:30:00+03:00").status_code == 201


def test_any_5_minute_start_and_length_that_fits_the_office_hours(client, auth):
    headers = auth(LAMA)
    # Noura's Sunday office hours are 10:00-12:00; Saad holds 10:30-10:45.
    twenty = book(client, headers, NORA, "2026-10-11T10:05:00+03:00", minutes=25)
    assert twenty.status_code == 201, twenty.text
    assert (twenty.json()["starts_at"], twenty.json()["ends_at"]) == (
        "2026-10-11T07:05:00Z",
        "2026-10-11T07:30:00Z",  # ends exactly where Saad's begins
    )
    long_one = book(client, headers, NORA, "2026-10-11T10:45:00+03:00", minutes=75)  # to 12:00
    assert long_one.status_code == 201, long_one.text
    # Without a length, the professor's usual length (Reem: 30 minutes), at any 5-minute start.
    default = book(client, auth(MAHA), REEM, "2026-10-12T11:05:00+03:00")
    assert (default.status_code, default.json()["ends_at"]) == (201, "2026-10-12T08:35:00Z")


def test_start_and_length_must_stay_on_the_grid_inside_office_hours(client, auth):
    headers = auth(LAMA)
    off_grid = book(client, headers, NORA, "2026-10-11T10:07:00+03:00")
    outside_hours = book(client, headers, NORA, "2026-10-11T12:00:00+03:00")  # block ends at 12:00
    runs_past_the_end = book(client, headers, NORA, "2026-10-11T11:50:00+03:00", minutes=15)
    class_time = book(client, headers, NORA, "2026-10-11T08:00:00+03:00")  # a class block
    friday = book(client, headers, NORA, "2026-10-09T10:00:00+03:00")
    for response in (off_grid, outside_hours, runs_past_the_end, class_time, friday):
        assert (response.status_code, code(response)) == (422, "INVALID_SLOT")
    for minutes in (0, 7, 605):
        response = book(client, headers, NORA, "2026-10-11T10:00:00+03:00", minutes=minutes)
        assert code(response) == "VALIDATION_ERROR", minutes


def test_a_longer_appointment_cannot_overlap_the_next_booking(client, auth):
    # 10:05 for 30 minutes would run into Saad's 10:30-10:45.
    response = book(client, auth(LAMA), NORA, "2026-10-11T10:05:00+03:00", minutes=30)
    assert (response.status_code, code(response)) == (409, "SLOT_TAKEN")


def test_cannot_book_the_past_or_beyond_next_week(client, auth):
    now_slot = book(client, auth(LAMA), HUDA, "2026-10-05T10:00:00+03:00")
    assert code(now_slot) == "SLOT_IN_PAST"
    too_far = book(client, auth(LAMA), HUDA, "2026-10-19T10:00:00+03:00")
    assert code(too_far) == "OUTSIDE_BOOKING_WINDOW"


def test_booking_validates_input(client, auth):
    naive = book(client, auth(LAMA), NORA, "2026-10-11T10:15:00")
    assert code(naive) == "VALIDATION_ERROR"  # a time zone is required
    long_note = book(client, auth(LAMA), NORA, "2026-10-11T10:15:00+03:00", note="x" * 201)
    assert code(long_note) == "VALIDATION_ERROR"
    unknown = book(client, auth(LAMA), 999, "2026-10-11T10:15:00+03:00")
    assert unknown.status_code == 404


def test_only_students_can_book(client, auth):
    response = book(client, auth(KHALID), NORA, "2026-10-11T10:15:00+03:00")
    assert response.status_code == 403


# --- lifecycle ----------------------------------------------------------------


def test_professor_approves_a_pending_request_and_the_student_is_notified(client, auth, db):
    response = client.post(f"{BOOK}/8/approve", headers=auth(HUDA))
    assert response.status_code == 200 and response.json()["status"] == "approved"
    note = db.scalar(
        select(Notification).where(
            Notification.appointment_id == 8, Notification.type == "appointment_approved"
        )
    )
    assert note.user_id == MAHA


def test_professor_declines_a_pending_request(client, auth):
    assert client.post(f"{BOOK}/10/decline", headers=auth(OMAR)).json()["status"] == "declined"


def test_students_cannot_approve(client, auth):
    assert client.post(f"{BOOK}/8/approve", headers=auth(MAHA)).status_code == 403


def test_other_professors_cannot_see_or_change_an_appointment(client, auth):
    assert client.post(f"{BOOK}/8/approve", headers=auth(NORA)).status_code == 404
    assert client.get(f"{BOOK}/8", headers=auth(NORA)).status_code == 404
    assert client.get(f"{BOOK}/8", headers=auth(YOUSEF)).status_code == 404


def test_invalid_transitions_are_refused(client, auth):
    approved = client.post(f"{BOOK}/6/decline", headers=auth(NORA))  # already approved
    assert (approved.status_code, code(approved)) == (409, "INVALID_TRANSITION")
    finished = client.post(f"{BOOK}/1/cancel", headers=auth(SAAD))  # completed last week
    assert code(finished) == "INVALID_TRANSITION"


def test_cancellation_is_allowed_until_exactly_1_hour_before_start(client, auth, clock):
    # Appointment 6 starts 2026-10-11 07:30 UTC.
    clock.at = datetime(2026, 10, 11, 6, 30)
    assert client.post(f"{BOOK}/6/cancel", headers=auth(SAAD)).json()["status"] == "cancelled"


def test_cancellation_closes_inside_the_last_hour(client, auth, clock):
    clock.at = datetime(2026, 10, 11, 6, 30) + timedelta(seconds=1)
    response = client.post(f"{BOOK}/6/cancel", headers=auth(SAAD))
    assert (response.status_code, code(response)) == (409, "CANCEL_WINDOW_CLOSED")


def test_professor_cancelling_notifies_the_student(client, auth, db):
    client.post(f"{BOOK}/9/cancel", headers=auth(REEM))
    note = db.scalar(
        select(Notification).where(
            Notification.appointment_id == 9, Notification.type == "appointment_cancelled"
        )
    )
    assert note.user_id == 15


def test_completed_and_no_show_only_after_the_start(client, auth, clock):
    too_early = client.post(f"{BOOK}/6/complete", headers=auth(NORA))
    assert code(too_early) == "TOO_EARLY"
    clock.at = datetime(2026, 10, 11, 7, 30)
    assert client.post(f"{BOOK}/6/complete", headers=auth(NORA)).json()["status"] == "completed"
    assert client.post(f"{BOOK}/9/no-show", headers=auth(REEM)).json()["error"]["code"] == "TOO_EARLY"


def test_cancelled_slot_can_be_booked_again(client, auth):
    client.post(f"{BOOK}/8/cancel", headers=auth(MAHA))
    assert book(client, auth(LAMA), HUDA, "2026-10-12T10:00:00+03:00").status_code == 201


# --- lists ----------------------------------------------------------------------


def test_students_list_upcoming_and_past_appointments(client, auth):
    headers = auth(SAAD)
    upcoming = client.get(f"{BOOK}?scope=upcoming", headers=headers).json()
    assert [a["appointment_id"] for a in upcoming["items"]] == [6, 7]
    past = client.get(f"{BOOK}?scope=past", headers=headers).json()
    assert [a["appointment_id"] for a in past["items"]] == [1]
    first = upcoming["items"][0]
    assert first["professor"]["office"]["room_number"] == "214" and first["student"]["user_id"] == SAAD


def test_professors_see_only_their_own_appointments_and_can_filter_by_status(client, auth):
    page = client.get(f"{BOOK}?scope=all&status=pending", headers=auth(NORA)).json()
    assert [a["appointment_id"] for a in page["items"]] == [7]


# --- time freed before mine, and moving earlier ----------------------------------


def notifications_of(db, user_id, kind):
    return db.scalars(
        select(Notification).where(Notification.user_id == user_id, Notification.type == kind)
    ).all()


def test_cancelling_tells_the_next_student_who_moves_earlier_and_stays_approved(client, auth, db):
    # Lama books 10:00-10:30 on Sunday, just before Saad's approved 10:30-10:45, then cancels.
    lama = book(client, auth(LAMA), NORA, "2026-10-11T10:00:00+03:00", minutes=30).json()
    assert client.get(f"{BOOK}/6/earlier-starts", headers=auth(SAAD)).json()["starts"] == []
    client.post(f"{BOOK}/{lama['appointment_id']}/cancel", headers=auth(LAMA))

    [freed] = notifications_of(db, SAAD, "slot_freed")
    assert freed.appointment_id == 6
    listed = client.get("/api/v1/notifications", headers=auth(SAAD)).json()["items"][0]
    assert (listed["type"], listed["actor"]["user_id"], listed["starts_at"]) == (
        "slot_freed",
        NORA,
        "2026-10-11T07:30:00Z",
    )
    starts = client.get(f"{BOOK}/6/earlier-starts", headers=auth(SAAD)).json()["starts"]
    # 15 minutes fit from 10:00 to 10:25 (his own old time is no obstacle).
    assert starts == [f"2026-10-11T07:{m:02d}:00Z" for m in (0, 5, 10, 15, 20, 25)]

    moved = client.post(f"{BOOK}/6/move", json={"starts_at": starts[0]}, headers=auth(SAAD))
    assert moved.status_code == 200, moved.text
    body = moved.json()
    assert (body["status"], body["starts_at"], body["ends_at"]) == (
        "approved",
        "2026-10-11T07:00:00Z",
        "2026-10-11T07:15:00Z",
    )
    db.expire_all()
    assert notifications_of(db, SAAD, "slot_freed")[0].read_at is not None  # acted on
    [told] = notifications_of(db, NORA, "appointment_moved")
    assert told.appointment_id == 6


def test_no_notice_when_nobody_can_use_the_freed_time(client, auth, db):
    # Cancelling the last appointment of the day frees time before nobody.
    lama = book(client, auth(LAMA), NORA, "2026-10-11T11:00:00+03:00", minutes=30).json()
    client.post(f"{BOOK}/{lama['appointment_id']}/cancel", headers=auth(LAMA))
    # Saad cancelling his own booking just before his next one does not notify him.
    assert client.post(f"{BOOK}/7/cancel", headers=auth(SAAD)).status_code == 200  # stay under the limit
    own = book(client, auth(SAAD), NORA, "2026-10-11T10:00:00+03:00", minutes=30).json()
    client.post(f"{BOOK}/{own['appointment_id']}/cancel", headers=auth(SAAD))
    assert notifications_of(db, SAAD, "slot_freed") == []


def test_moving_is_only_earlier_the_same_day_and_never_onto_another_booking(client, auth):
    saad = auth(SAAD)
    later = client.post(f"{BOOK}/6/move", json={"starts_at": "2026-10-11T11:00:00+03:00"}, headers=saad)
    other_day = client.post(f"{BOOK}/7/move", json={"starts_at": "2026-10-11T10:00:00+03:00"}, headers=saad)
    for response in (later, other_day):
        assert (response.status_code, code(response)) == (422, "MOVE_NOT_EARLIER")
    book(client, auth(LAMA), NORA, "2026-10-11T10:00:00+03:00", minutes=30)
    taken = client.post(f"{BOOK}/6/move", json={"starts_at": "2026-10-11T10:15:00+03:00"}, headers=saad)
    assert (taken.status_code, code(taken)) == (409, "SLOT_TAKEN")
    off_grid = client.post(f"{BOOK}/6/move", json={"starts_at": "2026-10-11T09:55:00+03:00"}, headers=saad)
    assert code(off_grid) == "INVALID_SLOT"  # before the office hours


def test_only_the_student_who_booked_can_move_an_active_appointment(client, auth):
    target = {"starts_at": "2026-10-11T10:00:00+03:00"}
    assert client.post(f"{BOOK}/6/move", json=target, headers=auth(LAMA)).status_code == 404
    assert client.post(f"{BOOK}/6/move", json=target, headers=auth(NORA)).status_code == 403
    assert client.get(f"{BOOK}/6/earlier-starts", headers=auth(NORA)).status_code == 403
    finished = client.post(f"{BOOK}/1/move", json=target, headers=auth(SAAD))
    assert (finished.status_code, code(finished)) == (409, "INVALID_TRANSITION")
