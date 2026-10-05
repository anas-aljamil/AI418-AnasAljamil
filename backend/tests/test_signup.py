"""Self sign-up: students are signed in at once; professors wait for an admin (docs/security.md)."""

import pytest
from sqlalchemy import select

from app.api.v1.auth import signup_limiter
from app.models import Professor, Student, User
from tests.conftest import ADMIN_EMAIL, EMAILS, SAAD

SIGNUP = "/api/v1/auth/signup"
LOGIN = "/api/v1/auth/login"


@pytest.fixture(autouse=True)
def fresh_limit():
    signup_limiter.reset()
    yield
    signup_limiter.reset()


def student(**changes) -> dict:
    body = {
        "role": "student",
        "email": "r.alqahtani@university.example",
        "password": "a-long-password",
        "full_name_ar": "رنا القحطاني",
        "full_name_en": "Rana Al-Qahtani",
        "preferred_locale": "ar",
        "department_id": 2,
        "university_no": "S2001",
        "study_year": 1,
    }
    return body | changes


def professor(**changes) -> dict:
    body = {
        "role": "professor",
        "email": "m.alfaraj@university.example",
        "password": "a-long-password",
        "full_name_ar": "منصور الفرج",
        "full_name_en": "Mansour Al-Faraj",
        "department_id": 1,
        "honorific": "dr",
        "academic_rank": "assistant_professor",
    }
    return body | changes


def code(response) -> str:
    return response.json()["error"]["code"]


def test_a_student_signs_up_and_is_signed_in_at_once(client, db):
    response = client.post(
        SIGNUP, json=student(email="  R.AlQahtani@University.Example ", university_no="s2001")
    )
    assert response.status_code == 201, response.text
    body = response.json()
    assert body["access_token"] and body["refresh_token"]
    assert body["user"]["email"] == "r.alqahtani@university.example"
    assert body["user"]["student"]["university_no"] == "S2001"
    assert body["user"]["student"]["department"]["code"] == "IS"

    user = db.scalar(select(User).where(User.email == "r.alqahtani@university.example"))
    assert (user.role, user.is_active) == ("student", True)
    assert db.get(Student, user.user_id).study_year == 1
    login = client.post(LOGIN, json={"email": user.email, "password": "a-long-password"})
    assert login.status_code == 200


def test_web_sign_up_sets_the_refresh_cookie_instead(client):
    response = client.post(SIGNUP, json=student(client="web"))
    assert response.status_code == 201
    assert response.json()["refresh_token"] is None
    cookie = response.headers["set-cookie"].lower()
    assert "mawjood_refresh=" in cookie and "httponly" in cookie and "samesite=strict" in cookie


def test_a_professor_signs_up_and_waits_for_an_admin(client, auth, db):
    response = client.post(SIGNUP, json=professor())
    assert response.status_code == 202, response.text
    assert response.json() == {"pending": True, "email": "m.alfaraj@university.example"}
    assert "set-cookie" not in response.headers

    user = db.scalar(select(User).where(User.email == "m.alfaraj@university.example"))
    assert (user.role, user.is_active) == ("professor", False)
    assert db.get(Professor, user.user_id).office_id is None

    # Not able to sign in, and not shown to students, until an admin activates the account.
    refused = client.post(LOGIN, json={"email": user.email, "password": "a-long-password"})
    assert (refused.status_code, code(refused)) == (403, "ACCOUNT_DISABLED")
    directory = client.get("/api/v1/professors?q=Mansour", headers=auth(SAAD)).json()
    assert directory["total"] == 0

    activated = client.patch(
        f"/api/v1/admin/professors/{user.user_id}", json={"is_active": True}, headers=auth(ADMIN_EMAIL)
    )
    assert activated.status_code == 200
    assert client.post(LOGIN, json={"email": user.email, "password": "a-long-password"}).status_code == 200


def test_only_the_university_domain_may_sign_up(client):
    for email in (
        "rana@gmail.com",
        "rana@evil.university.example",
        "rana@university.example.evil.com",
    ):
        response = client.post(SIGNUP, json=student(email=email))
        assert (response.status_code, code(response)) == (422, "EMAIL_DOMAIN"), email


def test_nobody_can_sign_up_as_an_admin(client):
    response = client.post(SIGNUP, json=student(role="admin"))
    assert (response.status_code, code(response)) == (422, "VALIDATION_ERROR")


def test_taken_email_and_university_number_are_refused(client):
    taken_email = client.post(SIGNUP, json=student(email=EMAILS[SAAD]))
    assert (taken_email.status_code, code(taken_email)) == (409, "EMAIL_TAKEN")
    taken_number = client.post(SIGNUP, json=student(university_no="S1001"))
    assert (taken_number.status_code, code(taken_number)) == (409, "UNIVERSITY_NO_TAKEN")


@pytest.mark.parametrize(
    "changes",
    [
        {"password": "short"},
        {"full_name_en": "R"},
        {"university_no": "S-1"},
        {"study_year": 7},
        {"university_no": None},
    ],
)
def test_sign_up_input_is_validated(client, changes):
    response = client.post(SIGNUP, json=student(**changes))
    assert (response.status_code, code(response)) == (422, "VALIDATION_ERROR")


def test_an_unknown_department_is_refused(client):
    response = client.post(SIGNUP, json=professor(department_id=999))
    assert (response.status_code, code(response)) == (422, "INVALID_REFERENCE")


def test_sign_up_is_rate_limited(client):
    for n in range(5):
        client.post(SIGNUP, json=student(email=f"bad{n}@gmail.com"))
    limited = client.post(SIGNUP, json=student())
    assert (limited.status_code, code(limited)) == (429, "RATE_LIMITED")


def test_departments_are_listed_without_signing_in(client):
    response = client.get("/api/v1/departments")
    assert response.status_code == 200
    assert response.json()["total"] == 6
