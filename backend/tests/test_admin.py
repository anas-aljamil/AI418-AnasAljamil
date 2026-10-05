"""Admin CRUD for departments, offices, professors and students (full CRUD on the real database)."""

from sqlalchemy import select

from app.models import Professor
from tests.conftest import ADMIN_EMAIL, DEMO_PASSWORD, NORA, SAAD

ADMIN = "/api/v1/admin"


def test_department_crud(client, auth):
    headers = auth(ADMIN_EMAIL)
    created = client.post(
        f"{ADMIN}/departments",
        json={"college_id": 2, "code": "PHYS", "name_ar": "الفيزياء", "name_en": "Physics"},
        headers=headers,
    )
    assert created.status_code == 201
    department_id = created.json()["department_id"]
    renamed = client.patch(
        f"{ADMIN}/departments/{department_id}", json={"name_en": "Applied Physics"}, headers=headers
    )
    assert renamed.json()["name_en"] == "Applied Physics"
    moved = client.patch(f"{ADMIN}/departments/{department_id}", json={"college_id": 1}, headers=headers)
    assert moved.json()["college"]["code"] == "CCS"
    assert client.delete(f"{ADMIN}/departments/{department_id}", headers=headers).status_code == 204
    assert client.patch(f"{ADMIN}/departments/{department_id}", json={}, headers=headers).status_code == 404


def test_department_with_people_cannot_be_deleted(client, auth):
    response = client.delete(f"{ADMIN}/departments/1", headers=auth(ADMIN_EMAIL))
    assert (response.status_code, response.json()["error"]["code"]) == (409, "IN_USE")


def test_department_input_is_validated(client, auth):
    headers = auth(ADMIN_EMAIL)
    lower = client.post(
        f"{ADMIN}/departments",
        json={"college_id": 2, "code": "phys", "name_ar": "الفيزياء", "name_en": "Physics"},
        headers=headers,
    )
    assert lower.json()["error"]["code"] == "VALIDATION_ERROR"
    duplicate = client.post(
        f"{ADMIN}/departments",
        json={"college_id": 1, "code": "SE", "name_ar": "جديد", "name_en": "New"},
        headers=headers,
    )
    assert (duplicate.status_code, duplicate.json()["error"]["code"]) == (409, "CONFLICT")
    unknown = client.post(
        f"{ADMIN}/departments",
        json={"college_id": 99, "code": "PHYS", "name_ar": "الفيزياء", "name_en": "Physics"},
        headers=headers,
    )
    assert (unknown.status_code, unknown.json()["error"]["code"]) == (422, "INVALID_REFERENCE")


def test_office_crud_and_deleting_an_office_unassigns_its_professors(client, auth, db):
    headers = auth(ADMIN_EMAIL)
    created = client.post(
        f"{ADMIN}/offices", json={"building_code": "D", "floor": 1, "room_number": "101"}, headers=headers
    )
    assert created.status_code == 201
    assert (
        client.patch(
            f"{ADMIN}/offices/{created.json()['office_id']}", json={"floor": 2}, headers=headers
        ).json()["floor"]
        == 2
    )
    assert client.delete(f"{ADMIN}/offices/1", headers=headers).status_code == 204
    assert db.scalar(select(Professor.office_id).where(Professor.professor_id == NORA)) is None


def test_professor_account_lifecycle(client, auth):
    headers = auth(ADMIN_EMAIL)
    new = {
        "email": "a.alsaleh@university.example",
        "password": "Long-enough-1",
        "full_name_ar": "عادل الصالح",
        "full_name_en": "Adel Al-Saleh",
        "department_id": 1,
        "office_id": 7,
        "slot_minutes": 30,
    }
    created = client.post(f"{ADMIN}/professors", json=new, headers=headers)
    assert created.status_code == 201, created.text
    professor_id = created.json()["user_id"]
    assert created.json()["office"]["room_number"] == "410"

    signed_in = client.post("/api/v1/auth/login", json={"email": new["email"], "password": new["password"]})
    assert signed_in.json()["user"]["professor"]["slot_minutes"] == 30

    edited = client.patch(
        f"{ADMIN}/professors/{professor_id}",
        json={"academic_rank": "associate_professor", "is_active": False},
        headers=headers,
    )
    assert (edited.json()["academic_rank"], edited.json()["is_active"]) == ("associate_professor", False)
    blocked = client.post("/api/v1/auth/login", json={"email": new["email"], "password": new["password"]})
    assert blocked.json()["error"]["code"] == "ACCOUNT_DISABLED"

    assert client.delete(f"{ADMIN}/professors/{professor_id}", headers=headers).status_code == 204
    assert client.patch(f"{ADMIN}/professors/{professor_id}", json={}, headers=headers).status_code == 404


def test_deleting_a_professor_cascades_to_their_appointments(client, auth):
    headers = auth(ADMIN_EMAIL)
    assert client.delete(f"{ADMIN}/professors/{NORA}", headers=headers).status_code == 204
    upcoming = client.get("/api/v1/appointments", headers=auth(SAAD)).json()
    assert upcoming["total"] == 0  # both of Saad's upcoming appointments were with Noura


def test_student_account_lifecycle(client, auth):
    headers = auth(ADMIN_EMAIL)
    new = {
        "email": "r.alfahad@university.example",
        "password": "Long-enough-1",
        "full_name_ar": "رنا الفهد",
        "full_name_en": "Rana Al-Fahad",
        "university_no": "S2001",
        "department_id": 2,
        "study_year": 2,
    }
    created = client.post(f"{ADMIN}/students", json=new, headers=headers)
    assert created.status_code == 201, created.text
    student_id = created.json()["user_id"]
    listed = client.get(f"{ADMIN}/students", params={"q": "رنا"}, headers=headers).json()
    assert [s["user_id"] for s in listed["items"]] == [student_id]
    moved = client.patch(
        f"{ADMIN}/students/{student_id}",
        json={"department_id": 1, "password": "Another-pass-2"},
        headers=headers,
    )
    assert moved.json()["department"]["code"] == "SE"
    assert (
        client.post(
            "/api/v1/auth/login", json={"email": new["email"], "password": "Another-pass-2"}
        ).status_code
        == 200
    )
    assert client.delete(f"{ADMIN}/students/{student_id}", headers=headers).status_code == 204


def test_account_rules(client, auth):
    headers = auth(ADMIN_EMAIL)
    base = {
        "password": "Long-enough-1",
        "full_name_ar": "اسم",
        "full_name_en": "Name",
        "university_no": "S3001",
        "department_id": 1,
    }
    taken = client.post(
        f"{ADMIN}/students", json={**base, "email": "s.almutairi@university.example"}, headers=headers
    )
    assert (taken.status_code, taken.json()["error"]["code"]) == (409, "EMAIL_TAKEN")
    short = client.post(
        f"{ADMIN}/students",
        json={**base, "email": "x@university.example", "password": "short"},
        headers=headers,
    )
    assert short.json()["error"]["code"] == "VALIDATION_ERROR"
    missing = client.post(
        f"{ADMIN}/students",
        json={**base, "email": "y@university.example", "department_id": 99},
        headers=headers,
    )
    assert missing.json()["error"]["code"] == "INVALID_REFERENCE"


def test_admin_lists_include_inactive_accounts(client, auth):
    page = client.get(f"{ADMIN}/students", headers=auth(ADMIN_EMAIL)).json()
    assert page["total"] == 7 and any(not s["is_active"] for s in page["items"])


def test_non_admins_cannot_use_the_admin_api(client, auth):
    assert client.get(f"{ADMIN}/professors", headers=auth(NORA)).status_code == 403
    assert (
        client.post("/api/v1/auth/login", json={"email": ADMIN_EMAIL, "password": DEMO_PASSWORD}).status_code
        == 200
    )
