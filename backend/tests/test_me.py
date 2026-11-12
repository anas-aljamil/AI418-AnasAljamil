"""Professor self-service (one-tap status, schedule, booking periods, chat closed hours,
settings) and student pins."""

from datetime import datetime, timedelta

from tests.conftest import HUDA, KHALID, NORA, SAAD

STATUS = "/api/v1/me/status"
SCHEDULE = "/api/v1/me/schedule"


def test_professor_sets_status_in_one_call_and_students_see_it(client, auth):
    response = client.post(STATUS, json={"status": "busy", "note": "  اجتماع قصير  "}, headers=auth(KHALID))
    assert response.status_code == 200
    mine = response.json()
    assert (mine["status"], mine["source"], mine["note"], mine["confirmed"]) == (
        "busy",
        "override",
        "اجتماع قصير",
        True,
    )
    assert mine["until"] == "2026-10-05T21:00:00Z"  # no return time: until Riyadh midnight
    seen = client.get(f"/api/v1/professors/{KHALID}", headers=auth(SAAD)).json()["status"]
    assert seen["status"] == "busy" and seen["updated_at"] == "2026-10-05T07:00:00Z"


def test_back_in_15_minutes_then_the_schedule_takes_over(client, auth, clock):
    client.post(
        STATUS, json={"status": "away", "expires_at": "2026-10-05T10:15:00+03:00"}, headers=auth(KHALID)
    )
    clock.at += timedelta(minutes=15)
    status = client.get(STATUS, headers=auth(KHALID)).json()
    # Back on schedule (office hours) and confirmed, because the manual update was 15 minutes ago.
    assert (status["status"], status["source"], status["confirmed"]) == ("in_office", "schedule", True)


def test_in_office_is_not_confirmed_more_than_4_hours_after_the_last_update(client, auth, clock):
    # Give Huda long office hours on Monday afternoon, then update her status at 10:00 Riyadh.
    client.post(
        SCHEDULE, json={"day_of_week": 1, "start_time": "12:00", "end_time": "17:00"}, headers=auth(HUDA)
    )
    client.post(
        STATUS, json={"status": "busy", "expires_at": "2026-10-05T10:05:00+03:00"}, headers=auth(HUDA)
    )
    clock.at = datetime(2026, 10, 5, 11, 0)  # 14:00 Riyadh: exactly 4 hours later
    assert client.get(STATUS, headers=auth(HUDA)).json()["confirmed"] is True
    clock.at += timedelta(seconds=1)  # now older than 4 hours
    status = client.get(f"/api/v1/professors/{HUDA}", headers=auth(SAAD)).json()["status"]
    assert (status["status"], status["confirmed"]) == ("in_office", False)


def test_a_meeting_in_the_timetable_shows_students_busy(client, auth, clock):
    # Huda's Monday office hours end at 12:00 Riyadh; she adds a meeting right after them.
    added = client.post(
        SCHEDULE,
        json={"kind": "meeting", "day_of_week": 1, "start_time": "12:00", "end_time": "13:00"},
        headers=auth(HUDA),
    )
    assert added.status_code == 201 and added.json()["kind"] == "meeting"
    clock.at = datetime(2026, 10, 5, 9, 15)  # 12:15 Riyadh
    status = client.get(f"/api/v1/professors/{HUDA}", headers=auth(SAAD)).json()["status"]
    assert (status["status"], status["source"]) == ("busy", "schedule")
    assert status["until"] == "2026-10-05T10:00:00Z"  # the meeting ends 13:00 Riyadh
    unknown = client.post(
        SCHEDULE,
        json={"kind": "lunch", "day_of_week": 1, "start_time": "13:00", "end_time": "14:00"},
        headers=auth(HUDA),
    )
    assert unknown.json()["error"]["code"] == "VALIDATION_ERROR"


def test_clearing_the_status_returns_to_the_schedule(client, auth):
    headers = auth(KHALID)
    client.post(STATUS, json={"status": "away"}, headers=headers)
    cleared = client.delete(STATUS, headers=headers).json()
    assert (cleared["status"], cleared["source"]) == ("in_office", "schedule")


def test_clearing_after_several_updates_in_one_second_still_returns_to_the_schedule(client, auth, clock):
    # Bug found end to end: with the clock frozen (DEMO_NOW), clearing removed only the
    # latest update, so the one set just before it counted again.
    headers = auth(KHALID)
    client.post(STATUS, json={"status": "away", "expires_at": "2026-10-05T10:15:00+03:00"}, headers=headers)
    client.post(STATUS, json={"status": "busy", "note": "Meeting"}, headers=headers)
    cleared = client.delete(STATUS, headers=headers).json()
    assert (cleared["status"], cleared["source"]) == ("in_office", "schedule")

    # An update from earlier stays in the history and ends now.
    client.post(STATUS, json={"status": "away"}, headers=headers)
    clock.at += timedelta(minutes=5)
    client.post(STATUS, json={"status": "busy"}, headers=headers)
    cleared = client.delete(STATUS, headers=headers).json()
    assert (cleared["status"], cleared["source"]) == ("in_office", "schedule")


def test_status_input_is_validated(client, auth):
    headers = auth(KHALID)
    too_long = client.post(STATUS, json={"status": "busy", "note": "x" * 61}, headers=headers)
    assert too_long.json()["error"]["code"] == "VALIDATION_ERROR"
    unknown = client.post(STATUS, json={"status": "lunch"}, headers=headers)
    assert unknown.json()["error"]["code"] == "VALIDATION_ERROR"
    past = client.post(
        STATUS, json={"status": "busy", "expires_at": "2026-10-05T09:00:00+03:00"}, headers=headers
    )
    assert past.json()["error"]["code"] == "INVALID_RETURN_TIME"


def test_professor_manages_the_weekly_schedule(client, auth):
    headers = auth(NORA)
    created = client.post(
        SCHEDULE, json={"day_of_week": 1, "start_time": "15:00", "end_time": "16:00"}, headers=headers
    )
    assert created.status_code == 201
    block = created.json()
    assert (block["kind"], block["start_time"], block["end_time"]) == ("office_hours", "15:00", "16:00")
    moved = client.put(
        f"{SCHEDULE}/{block['block_id']}",
        json={"day_of_week": 3, "start_time": "09:00", "end_time": "10:30", "label": "Extra"},
        headers=headers,
    )
    assert moved.json()["day_of_week"] == 3
    assert client.delete(f"{SCHEDULE}/{block['block_id']}", headers=headers).status_code == 204
    # 5 weekly blocks and the dated exam committee (block 34).
    assert client.get(SCHEDULE, headers=headers).json()["total"] == 6


def test_schedule_blocks_cannot_overlap(client, auth):
    response = client.post(
        SCHEDULE, json={"day_of_week": 1, "start_time": "13:30", "end_time": "14:00"}, headers=auth(NORA)
    )  # Noura teaches 13:00-14:30 on Monday
    assert (response.status_code, response.json()["error"]["code"]) == (409, "SCHEDULE_OVERLAP")


def test_schedule_input_is_validated(client, auth):
    headers = auth(NORA)
    for bad in (
        {"day_of_week": 5, "start_time": "10:00", "end_time": "11:00"},  # Friday
        {"day_of_week": 1, "start_time": "10:10", "end_time": "11:00"},  # off the grid
        {"day_of_week": 1, "start_time": "11:00", "end_time": "10:00"},
    ):  # backwards
        assert client.post(SCHEDULE, json=bad, headers=headers).json()["error"]["code"] == "VALIDATION_ERROR"


def test_professors_cannot_edit_each_others_schedule(client, auth):
    assert client.delete(f"{SCHEDULE}/1", headers=auth(KHALID)).status_code == 404  # block 1 is Noura's


def test_a_dated_block_counts_on_its_date_only_and_may_share_a_skipped_weekly_time(client, auth, clock):
    headers = auth(KHALID)
    # Khalid's weekly office hours are Monday 09:00-11:00 (block 6).
    clash = client.post(
        SCHEDULE,
        json={"on_date": "2026-10-12", "kind": "meeting", "start_time": "10:00", "end_time": "11:00"},
        headers=headers,
    )
    assert clash.json()["error"]["code"] == "SCHEDULE_OVERLAP"
    # Skip that Monday, and the meeting fits.
    skipped = client.post(f"{SCHEDULE}/6/skips", json={"skip_date": "2026-10-12"}, headers=headers)
    assert skipped.status_code == 201 and skipped.json()["skipped_dates"] == ["2026-10-12"]
    meeting = client.post(
        SCHEDULE,
        json={"on_date": "2026-10-12", "kind": "meeting", "start_time": "10:00", "end_time": "11:00"},
        headers=headers,
    )
    assert meeting.status_code == 201, meeting.text
    assert (meeting.json()["day_of_week"], meeting.json()["on_date"]) == (None, "2026-10-12")
    # Bringing the office hours back would clash with the meeting now.
    back = client.delete(f"{SCHEDULE}/6/skips/2026-10-12", headers=headers)
    assert back.json()["error"]["code"] == "SCHEDULE_OVERLAP"

    clock.at = datetime(2026, 10, 12, 7, 30)  # Monday 12 October, 10:30 Riyadh
    status = client.get(f"/api/v1/professors/{KHALID}", headers=auth(SAAD)).json()
    assert (status["status"]["status"], status["status"]["source"]) == ("busy", "schedule")
    assert [b["kind"] for b in status["today"]["blocks"]] == ["meeting", "class"]
    clock.at = datetime(2026, 10, 5, 7, 30)  # the Monday before: office hours as every week
    assert client.get(STATUS, headers=auth(KHALID)).json()["status"] == "in_office"


def test_skipped_dates_must_be_dates_of_a_weekly_row(client, auth):
    headers = auth(KHALID)
    wrong_day = client.post(f"{SCHEDULE}/6/skips", json={"skip_date": "2026-10-13"}, headers=headers)
    assert wrong_day.json()["error"]["code"] == "SKIP_WRONG_DATE"  # block 6 is on Mondays
    dated = client.post(
        SCHEDULE,
        json={"on_date": "2026-10-14", "start_time": "15:00", "end_time": "16:00"},
        headers=headers,
    ).json()
    not_weekly = client.post(
        f"{SCHEDULE}/{dated['block_id']}/skips", json={"skip_date": "2026-10-14"}, headers=headers
    )
    assert not_weekly.json()["error"]["code"] == "SKIP_NOT_WEEKLY"
    # Someone else's row is not found.
    other = client.post(f"{SCHEDULE}/2/skips", json={"skip_date": "2026-10-11"}, headers=headers)
    assert other.status_code == 404


def test_weekly_or_dated_input_is_validated(client, auth):
    headers = auth(KHALID)
    for body in (
        {"start_time": "15:00", "end_time": "16:00"},  # neither
        {"day_of_week": 2, "on_date": "2026-10-13", "start_time": "15:00", "end_time": "16:00"},  # both
        {"on_date": "2026-10-16", "start_time": "15:00", "end_time": "16:00"},  # a Friday
        {"on_date": "2026-10-14", "ends_on": "2026-12-31", "start_time": "15:00", "end_time": "16:00"},
    ):
        assert client.post(SCHEDULE, json=body, headers=headers).json()["error"]["code"] == "VALIDATION_ERROR"
    # Closed hours may be dated on a Friday; a weekly row may end on a date.
    friday = client.post(
        "/api/v1/me/chat-closed-hours",
        json={"on_date": "2026-10-16", "start_time": "00:00", "end_time": "00:00"},
        headers=headers,
    )
    assert friday.status_code == 201, friday.text
    until = client.post(
        "/api/v1/me/booking-periods",
        json={"day_of_week": 4, "ends_on": "2026-12-31", "start_time": "13:00", "end_time": "14:00"},
        headers=headers,
    )
    assert until.json()["ends_on"] == "2026-12-31"


def test_student_pins_and_unpins_professors(client, auth):
    headers = auth(SAAD)
    assert client.put(f"/api/v1/me/pins/{HUDA}", headers=headers).status_code == 204
    assert client.put(f"/api/v1/me/pins/{HUDA}", headers=headers).status_code == 204  # idempotent
    pins = client.get("/api/v1/me/pins", headers=headers).json()
    assert pins["total"] == 4 and pins["items"][0]["professor_id"] in {KHALID, HUDA}  # in office first
    assert client.delete(f"/api/v1/me/pins/{HUDA}", headers=headers).status_code == 204
    assert client.get("/api/v1/me/pins", headers=headers).json()["total"] == 3
    assert client.put("/api/v1/me/pins/999", headers=headers).status_code == 404


# --- booking periods (owner decision 2026-11-07) ---------------------------------------

PERIODS = "/api/v1/me/booking-periods"
CLOSED = "/api/v1/me/chat-closed-hours"


def test_professor_manages_booking_periods_independently_of_the_timetable(client, auth):
    headers = auth(NORA)
    assert client.get(PERIODS, headers=headers).json()["total"] == 3
    # Monday 15:00-16:00 is outside every schedule block: still a valid booking period.
    created = client.post(
        PERIODS, json={"day_of_week": 1, "start_time": "15:00", "end_time": "16:00"}, headers=headers
    )
    assert created.status_code == 201, created.text
    period = created.json()
    assert (period["day_of_week"], period["start_time"], period["end_time"]) == (1, "15:00", "16:00")
    # Over a class block is allowed too: periods only clash with other periods.
    moved = client.put(
        f"{PERIODS}/{period['period_id']}",
        json={"day_of_week": 1, "start_time": "13:00", "end_time": "14:00"},
        headers=headers,
    )
    assert moved.status_code == 200 and moved.json()["start_time"] == "13:00"
    assert client.delete(f"{PERIODS}/{period['period_id']}", headers=headers).status_code == 204
    assert client.get(PERIODS, headers=headers).json()["total"] == 3


def test_booking_periods_cannot_overlap_and_are_validated(client, auth):
    headers = auth(NORA)
    overlap = client.post(  # Noura takes bookings on Sunday 10:00-12:00
        PERIODS, json={"day_of_week": 0, "start_time": "11:30", "end_time": "12:30"}, headers=headers
    )
    assert (overlap.status_code, overlap.json()["error"]["code"]) == (409, "BOOKING_PERIOD_OVERLAP")
    touching = client.post(
        PERIODS, json={"day_of_week": 0, "start_time": "12:00", "end_time": "12:30"}, headers=headers
    )
    assert touching.status_code == 201
    for bad in (
        {"day_of_week": 5, "start_time": "10:00", "end_time": "11:00"},  # Friday
        {"day_of_week": 1, "start_time": "10:10", "end_time": "11:00"},  # off the grid
        {"day_of_week": 1, "start_time": "11:00", "end_time": "11:00"},  # empty
    ):
        assert client.post(PERIODS, json=bad, headers=headers).json()["error"]["code"] == "VALIDATION_ERROR"


def test_booking_periods_and_closed_hours_belong_to_their_professor(client, auth):
    assert client.delete(f"{PERIODS}/1", headers=auth(KHALID)).status_code == 404  # Noura's
    assert (
        client.put(
            f"{CLOSED}/1",
            json={"day_of_week": 1, "start_time": "08:00", "end_time": "09:00"},
            headers=auth(KHALID),
        ).status_code
        == 404
    )
    assert client.get(PERIODS, headers=auth(SAAD)).status_code == 403  # students have none


# --- chat closed hours -------------------------------------------------------------


def test_professor_closes_chat_overnight_and_for_whole_days(client, auth):
    headers = auth(KHALID)
    night = client.post(
        CLOSED, json={"day_of_week": 3, "start_time": "20:00", "end_time": "08:00"}, headers=headers
    )
    assert night.status_code == 201, night.text
    friday = client.post(
        CLOSED, json={"day_of_week": 5, "start_time": "00:00", "end_time": "00:00"}, headers=headers
    )
    assert friday.status_code == 201
    listed = client.get(CLOSED, headers=headers).json()["items"]
    assert [(c["day_of_week"], c["start_time"], c["end_time"]) for c in listed] == [
        (3, "20:00", "08:00"),
        (5, "00:00", "00:00"),
    ]
    # Wednesday's night closure runs into Thursday morning: Thursday 07:00 overlaps it.
    clash = client.post(
        CLOSED, json={"day_of_week": 4, "start_time": "07:00", "end_time": "09:00"}, headers=headers
    )
    assert (clash.status_code, clash.json()["error"]["code"]) == (409, "CHAT_CLOSURE_OVERLAP")
    after = client.post(
        CLOSED, json={"day_of_week": 4, "start_time": "08:00", "end_time": "09:00"}, headers=headers
    )
    assert after.status_code == 201
    assert client.delete(f"{CLOSED}/{night.json()['closure_id']}", headers=headers).status_code == 204


def test_a_saturday_night_closure_wraps_into_sunday(client, auth):
    headers = auth(KHALID)
    saturday = client.post(
        CLOSED, json={"day_of_week": 6, "start_time": "22:00", "end_time": "06:00"}, headers=headers
    )
    assert saturday.status_code == 201
    sunday = client.post(
        CLOSED, json={"day_of_week": 0, "start_time": "05:00", "end_time": "07:00"}, headers=headers
    )
    assert sunday.json()["error"]["code"] == "CHAT_CLOSURE_OVERLAP"


def test_closed_hours_input_is_validated(client, auth):
    headers = auth(KHALID)
    for bad in (
        {"day_of_week": 7, "start_time": "10:00", "end_time": "11:00"},
        {"day_of_week": 1, "start_time": "10:10", "end_time": "11:00"},
        {"day_of_week": 1, "start_time": "24:00", "end_time": "11:00"},
    ):
        assert client.post(CLOSED, json=bad, headers=headers).json()["error"]["code"] == "VALIDATION_ERROR"
