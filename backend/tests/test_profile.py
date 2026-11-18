"""Editing one's own account (owner request S5b, 2026-11-18): names, email, a professor's
office, and the profile photo with who may see it."""

import base64

from tests.conftest import ADMIN_EMAIL, DEMO_PASSWORD, EMAILS, KHALID, LAMA, NORA, SAAD

ACCOUNT = "/api/v1/me/account"
PHOTO = "/api/v1/me/photo"
JPEG = b"\xff\xd8\xff\xe0" + b"\x00" * 300  # starts like a JPEG; the API checks only that
PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 300


def photo_body(image: bytes = JPEG, content_type: str = "image/jpeg") -> dict:
    return {"content_type": content_type, "data": base64.b64encode(image).decode()}


def error(response) -> tuple[int, str]:
    return response.status_code, response.json()["error"]["code"]


def test_everyone_changes_their_own_names(client, auth):
    for who in (SAAD, NORA, ADMIN_EMAIL):
        response = client.patch(
            ACCOUNT, json={"full_name_ar": "  اسم جديد  ", "full_name_en": "New Name"}, headers=auth(who)
        )
        assert response.status_code == 200
        assert (response.json()["full_name_ar"], response.json()["full_name_en"]) == ("اسم جديد", "New Name")
    # The new name is what students see in the directory.
    seen = client.get(f"/api/v1/professors/{NORA}", headers=auth(SAAD)).json()
    assert seen["full_name_en"] == "New Name"
    assert client.patch(ACCOUNT, json={"full_name_en": "X"}, headers=auth(SAAD)).status_code == 422


def test_a_professor_changes_their_email_with_their_password(client, auth):
    new = {"email": " N.AlHarbi@UPM.edu.sa ", "current_password": DEMO_PASSWORD}
    assert error(client.patch(ACCOUNT, json={"email": new["email"]}, headers=auth(NORA))) == (
        400,
        "PASSWORD_NEEDED",
    )
    wrong = client.patch(ACCOUNT, json={**new, "current_password": "not-it-at-all"}, headers=auth(NORA))
    assert error(wrong) == (400, "WRONG_PASSWORD")
    other_domain = {**new, "email": "nora@gmail.com"}
    assert error(client.patch(ACCOUNT, json=other_domain, headers=auth(NORA))) == (422, "EMAIL_DOMAIN")
    changed = client.patch(ACCOUNT, json=new, headers=auth(NORA))
    assert changed.status_code == 200 and changed.json()["email"] == "n.alharbi@upm.edu.sa"
    signed_in = client.post(
        "/api/v1/auth/login", json={"email": "n.alharbi@upm.edu.sa", "password": DEMO_PASSWORD}
    )
    assert signed_in.status_code == 200
    # Someone else already at that address: said so, nothing changed.
    again = client.patch(ACCOUNT, json={**new, "email": "n.alharbi@upm.edu.sa"}, headers=auth(KHALID))
    assert error(again) == (409, "EMAIL_TAKEN")


def test_a_students_email_stays_with_the_administrator(client, auth):
    body = {"email": "9999999@upm.edu.sa", "current_password": DEMO_PASSWORD}
    assert error(client.patch(ACCOUNT, json=body, headers=auth(SAAD))) == (403, "STUDENT_EMAIL_FIXED")
    # The address they already have is not a change.
    same = client.patch(ACCOUNT, json={"email": EMAILS[SAAD]}, headers=auth(SAAD))
    assert same.status_code == 200


def test_through_the_public_link_a_demo_account_keeps_its_email(client, auth):
    tunnel = {"CF-Connecting-IP": "203.0.113.7", **auth(NORA)}
    body = {"email": "n.alharbi@upm.edu.sa", "current_password": DEMO_PASSWORD}
    assert error(client.patch(ACCOUNT, json=body, headers=tunnel)) == (403, "DEMO_ACCOUNT")
    # Names are not locked there: a reset of the database brings them back.
    assert client.patch(ACCOUNT, json={"full_name_en": "Nora H."}, headers=tunnel).status_code == 200


def test_a_professor_chooses_an_office_from_the_list(client, auth):
    offices = client.get("/api/v1/offices", headers=auth(NORA))
    assert offices.status_code == 200 and offices.json()["total"] >= 5
    office = offices.json()["items"][-1]
    chosen = client.patch("/api/v1/me/professor", json={"office_id": office["office_id"]}, headers=auth(NORA))
    assert chosen.json()["professor"]["office"] == office
    seen = client.get(f"/api/v1/professors/{NORA}", headers=auth(SAAD)).json()
    assert seen["office"]["office_id"] == office["office_id"]
    none = client.patch("/api/v1/me/professor", json={"office_id": None}, headers=auth(NORA))
    assert none.json()["professor"]["office"] is None
    missing = client.patch("/api/v1/me/professor", json={"office_id": 999}, headers=auth(NORA))
    assert error(missing) == (422, "INVALID_REFERENCE")
    # Students neither list offices nor have one.
    assert client.get("/api/v1/offices", headers=auth(SAAD)).status_code == 403
    assert client.patch("/api/v1/me/professor", json={"office_id": 1}, headers=auth(SAAD)).status_code == 403


def test_a_photo_is_added_shown_replaced_and_removed(client, auth, clock):
    assert client.get(f"/api/v1/users/{NORA}/photo", headers=auth(SAAD)).status_code == 404
    added = client.put(PHOTO, json=photo_body(), headers=auth(NORA))
    assert added.status_code == 200 and added.json()["photo_updated_at"] == "2026-10-05T07:00:00Z"
    # Students see the professor's photo, and the directory says it changed.
    photo = client.get(f"/api/v1/users/{NORA}/photo", headers=auth(SAAD))
    assert photo.status_code == 200 and "private" in photo.headers["Cache-Control"]
    assert (photo.json()["content_type"], base64.b64decode(photo.json()["data"])) == ("image/jpeg", JPEG)
    profile = client.get(f"/api/v1/professors/{NORA}", headers=auth(SAAD)).json()
    assert profile["photo_updated_at"] == "2026-10-05T07:00:00Z"
    replaced = client.put(PHOTO, json=photo_body(PNG, "image/png"), headers=auth(NORA))
    assert replaced.json()["photo_updated_at"] is not None
    assert client.get(f"/api/v1/users/{NORA}/photo", headers=auth(SAAD)).json()["content_type"] == "image/png"
    removed = client.delete(PHOTO, headers=auth(NORA))
    assert removed.status_code == 200 and removed.json()["photo_updated_at"] is None
    assert client.delete(PHOTO, headers=auth(NORA)).status_code == 200  # idempotent
    assert client.get(f"/api/v1/users/{NORA}/photo", headers=auth(SAAD)).status_code == 404


def test_only_real_small_images_are_accepted(client, auth):
    as_png = photo_body(JPEG, "image/png")  # the bytes are a JPEG
    assert error(client.put(PHOTO, json=as_png, headers=auth(SAAD))) == (422, "PHOTO_INVALID")
    too_big = photo_body(b"\xff\xd8\xff" + b"\x00" * 262_200)
    assert client.put(PHOTO, json=too_big, headers=auth(SAAD)).status_code == 422
    not_base64 = {"content_type": "image/jpeg", "data": "%" * 200}
    assert error(client.put(PHOTO, json=not_base64, headers=auth(SAAD))) == (422, "PHOTO_INVALID")
    gif = {**photo_body(), "content_type": "image/gif"}
    assert client.put(PHOTO, json=gif, headers=auth(SAAD)).status_code == 422


def test_a_students_photo_is_for_them_professors_and_admins(client, auth):
    client.put(PHOTO, json=photo_body(), headers=auth(SAAD))
    url = f"/api/v1/users/{SAAD}/photo"
    assert client.get(url, headers=auth(SAAD)).status_code == 200
    assert client.get(url, headers=auth(NORA)).status_code == 200
    assert client.get(url, headers=auth(ADMIN_EMAIL)).status_code == 200
    # Another student gets the same answer as for a photo that does not exist.
    assert error(client.get(url, headers=auth(LAMA))) == (404, "NOT_FOUND")
    assert client.get(url).status_code == 401
    # A conversation shows the student's photo time to the professor.
    opened = client.post("/api/v1/conversations", json={"student_id": SAAD}, headers=auth(NORA)).json()
    assert opened["other"]["photo_updated_at"] == "2026-10-05T07:00:00Z"
