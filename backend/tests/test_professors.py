"""Directory: live status in lists, Arabic-aware search, filters, profile timeline, slots."""

from tests.conftest import HUDA, KHALID, NORA, REEM, SAAD

# At the default clock (Monday 10:00 Riyadh) Khalid, Huda and Reem are in
# scheduled office hours; nobody has updated their status by hand for days.


def names(page: dict) -> list[str]:
    return [p["full_name_en"] for p in page["items"]]


def test_available_professors_come_first_then_by_name(client, auth):
    items = client.get("/api/v1/professors?lang=en", headers=auth(SAAD)).json()["items"]
    statuses = [p["status"]["status"] for p in items]
    assert statuses[:3] == ["in_office"] * 3 and "in_office" not in statuses[3:]
    assert names({"items": items[:3]}) == ["Huda Al-Qahtani", "Khalid Al-Otaibi", "Reem Al-Dosari"]


def test_scheduled_office_hours_without_a_recent_update_are_not_confirmed(client, auth):
    huda = client.get(f"/api/v1/professors/{HUDA}", headers=auth(SAAD)).json()
    assert huda["status"]["status"] == "in_office" and huda["status"]["confirmed"] is False
    assert huda["status"]["source"] == "schedule" and huda["status"]["until"] == "2026-10-05T09:00:00Z"


def test_search_folds_arabic_letter_variants_and_diacritics(client, auth):
    headers = auth(SAAD)
    for query in ("هدي", "هُدى", "القحطانى"):  # alef maksura vs yeh, diacritics
        assert names(client.get("/api/v1/professors", params={"q": query}, headers=headers).json()) == [
            "Huda Al-Qahtani"
        ], query
    for query in ("نوره", "نورة"):  # teh marbuta vs heh
        assert names(client.get("/api/v1/professors", params={"q": query}, headers=headers).json()) == [
            "Noura Al-Harbi"
        ]


def test_search_matches_english_names_and_departments_case_insensitively(client, auth):
    headers = auth(SAAD)
    assert names(client.get("/api/v1/professors?q=MARSH", headers=headers).json()) == ["Helen Marsh"]
    civil = client.get("/api/v1/professors", params={"q": "الهندسة المدنية", "lang": "en"}, headers=headers)
    assert names(civil.json()) == ["Reem Al-Dosari", "Faisal Al-Zahrani"]  # Reem is in office


def test_filters_by_department_status_and_office_hours_today(client, auth):
    headers = auth(SAAD)
    software = client.get("/api/v1/professors?department_id=1&lang=en", headers=headers).json()
    assert names(software) == ["Khalid Al-Otaibi", "Noura Al-Harbi"]
    in_office = client.get("/api/v1/professors?status=in_office&status=busy", headers=headers).json()
    assert in_office["total"] == 3
    today = client.get("/api/v1/professors?has_office_hours_today=true", headers=headers).json()
    assert {p["professor_id"] for p in today["items"]} == {KHALID, HUDA, 5, REEM}


def test_students_see_which_professors_they_pinned(client, auth):
    items = client.get("/api/v1/professors", headers=auth(SAAD)).json()["items"]
    pinned = {p["professor_id"] for p in items if p["is_pinned"]}
    assert pinned == {NORA, KHALID, 6}


def test_profile_has_office_location_and_todays_timeline(client, auth):
    nora = client.get(f"/api/v1/professors/{NORA}", headers=auth(SAAD)).json()
    assert nora["office"] == {"office_id": 1, "building_code": "A", "floor": 2, "room_number": "214"}
    assert nora["today"]["date"] == "2026-10-05" and nora["today"]["now_local_time"] == "10:00"
    assert [(b["start_time"], b["end_time"], b["kind"]) for b in nora["today"]["blocks"]] == [
        ("13:00", "14:30", "class")
    ]
    assert nora["status"]["status"] == "away" and nora["slot_minutes"] == 15


def test_slots_follow_the_slot_length_and_mark_taken_and_past_times(client, auth):
    headers = auth(SAAD)
    next_monday = client.get(f"/api/v1/professors/{HUDA}/slots?date=2026-10-12", headers=headers).json()
    assert next_monday["slot_minutes"] == 15 and len(next_monday["slots"]) == 8  # 10:00-12:00
    first = next_monday["slots"][0]
    assert (first["local_time"], first["available"], first["reason"]) == ("10:00", False, "taken")
    assert first["starts_at"] == "2026-10-12T07:00:00Z"
    assert all(s["available"] for s in next_monday["slots"][1:])
    today = client.get(f"/api/v1/professors/{HUDA}/slots?date=2026-10-05", headers=headers).json()
    assert today["slots"][0]["reason"] == "past"  # 10:00 is now
    thirty = client.get(f"/api/v1/professors/{REEM}/slots?date=2026-10-12", headers=headers).json()
    assert [s["local_time"] for s in thirty["slots"]] == ["10:00", "10:30", "11:00", "11:30"]


def test_slots_outside_this_week_and_next_are_refused(client, auth):
    for day in ("2026-10-04", "2026-10-18"):
        response = client.get(f"/api/v1/professors/{HUDA}/slots?date={day}", headers=auth(SAAD))
        assert response.json()["error"]["code"] == "OUTSIDE_BOOKING_WINDOW", day


def test_departments_list(client, auth):
    page = client.get("/api/v1/departments", headers=auth(SAAD)).json()
    assert page["total"] == 12 and page["items"][0]["code"] == "ACC"
    assert page["items"][0]["college"]["name_en"] == "College of Business and Tourism"
