"""Professor self-service (one-tap status, schedule, settings) and student pins."""

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
    assert client.get(SCHEDULE, headers=headers).json()["total"] == 5


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


def test_professor_changes_slot_length_and_open_messages(client, auth):
    headers = auth(NORA)
    updated = client.patch(
        "/api/v1/me/professor-settings", json={"slot_minutes": 30, "open_messages": True}, headers=headers
    ).json()
    assert (updated["slot_minutes"], updated["open_messages"]) == (30, True)
    bad = client.patch("/api/v1/me/professor-settings", json={"slot_minutes": 20}, headers=headers)
    assert bad.json()["error"]["code"] == "VALIDATION_ERROR"


def test_student_pins_and_unpins_professors(client, auth):
    headers = auth(SAAD)
    assert client.put(f"/api/v1/me/pins/{HUDA}", headers=headers).status_code == 204
    assert client.put(f"/api/v1/me/pins/{HUDA}", headers=headers).status_code == 204  # idempotent
    pins = client.get("/api/v1/me/pins", headers=headers).json()
    assert pins["total"] == 4 and pins["items"][0]["professor_id"] in {KHALID, HUDA}  # in office first
    assert client.delete(f"/api/v1/me/pins/{HUDA}", headers=headers).status_code == 204
    assert client.get("/api/v1/me/pins", headers=headers).json()["total"] == 3
    assert client.put("/api/v1/me/pins/999", headers=headers).status_code == 404
