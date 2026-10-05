"""Sign-in, tokens (native body vs web cookie + CSRF header), roles and rate limiting."""

from datetime import timedelta

from tests.conftest import ADMIN_EMAIL, DEMO_PASSWORD, EMAILS, SAAD, ZIYAD, login

LOGIN = "/api/v1/auth/login"


def test_native_login_returns_both_tokens_in_body(client):
    body = login(client, EMAILS[SAAD])
    assert body["token_type"] == "bearer" and body["refresh_token"]
    assert body["user"]["role"] == "student"
    assert body["user"]["student"]["university_no"] == "S1001"
    assert body["access_expires_at"] == "2026-10-05T07:15:00Z"  # 15 minutes
    assert "mawjood_refresh" not in client.cookies  # native clients get no cookie


def test_web_login_sets_httponly_strict_cookie_instead_of_body_token(client):
    response = client.post(LOGIN, json={"email": EMAILS[SAAD], "password": DEMO_PASSWORD, "client": "web"})
    assert response.status_code == 200
    assert response.json()["refresh_token"] is None
    cookie = response.headers["set-cookie"].lower()
    assert "mawjood_refresh=" in cookie and "httponly" in cookie
    assert "samesite=strict" in cookie and "path=/api/v1/auth" in cookie


def test_email_is_case_insensitive_and_trimmed(client):
    response = client.post(
        LOGIN, json={"email": "  S.AlMutairi@University.Example ", "password": DEMO_PASSWORD}
    )
    assert response.status_code == 200


def test_wrong_password_and_unknown_email_give_the_same_error(client):
    for email in (EMAILS[SAAD], "nobody@university.example"):
        response = client.post(LOGIN, json={"email": email, "password": "wrong-password"})
        assert response.status_code == 401
        assert response.json() == {
            "error": {"code": "INVALID_CREDENTIALS", "message": "The email or password is incorrect."}
        }


def test_deactivated_account_cannot_sign_in(client):
    response = client.post(LOGIN, json={"email": EMAILS[ZIYAD], "password": DEMO_PASSWORD})
    assert (response.status_code, response.json()["error"]["code"]) == (403, "ACCOUNT_DISABLED")


def test_login_is_rate_limited_after_5_attempts_per_minute(client):
    for _ in range(5):
        client.post(LOGIN, json={"email": EMAILS[SAAD], "password": "wrong-password"})
    response = client.post(LOGIN, json={"email": EMAILS[SAAD], "password": DEMO_PASSWORD})
    assert response.status_code == 429
    assert response.json()["error"]["code"] == "RATE_LIMITED"
    assert int(response.headers["retry-after"]) > 0


def test_protected_routes_need_a_valid_access_token(client):
    assert client.get("/api/v1/auth/me").status_code == 401
    bad = client.get("/api/v1/auth/me", headers={"Authorization": "Bearer not-a-token"})
    assert bad.json()["error"]["code"] == "UNAUTHORIZED"


def test_access_token_expires_after_15_minutes(client, clock):
    token = login(client, EMAILS[SAAD])["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    clock.at += timedelta(minutes=14, seconds=59)
    assert client.get("/api/v1/auth/me", headers=headers).status_code == 200
    clock.at += timedelta(seconds=1)
    assert client.get("/api/v1/auth/me", headers=headers).status_code == 401


def test_refresh_token_cannot_be_used_as_access_token(client):
    refresh = login(client, EMAILS[SAAD])["refresh_token"]
    assert client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {refresh}"}).status_code == 401


def test_native_refresh_with_body_token(client, clock):
    refresh = login(client, EMAILS[SAAD])["refresh_token"]
    clock.at += timedelta(days=6)
    response = client.post("/api/v1/auth/refresh", json={"refresh_token": refresh})
    assert response.status_code == 200 and response.json()["refresh_token"]


def test_refresh_token_expires_after_7_days(client, clock):
    refresh = login(client, EMAILS[SAAD])["refresh_token"]
    clock.at += timedelta(days=7)
    assert client.post("/api/v1/auth/refresh", json={"refresh_token": refresh}).status_code == 401


def test_web_refresh_needs_the_csrf_header(client):
    client.post(LOGIN, json={"email": EMAILS[SAAD], "password": DEMO_PASSWORD, "client": "web"})
    without_header = client.post("/api/v1/auth/refresh")
    assert (without_header.status_code, without_header.json()["error"]["code"]) == (403, "CSRF_CHECK_FAILED")
    with_header = client.post("/api/v1/auth/refresh", headers={"X-Requested-With": "mawjood"})
    assert with_header.status_code == 200 and with_header.json()["refresh_token"] is None


def test_logout_clears_the_web_cookie(client):
    client.post(LOGIN, json={"email": EMAILS[SAAD], "password": DEMO_PASSWORD, "client": "web"})
    response = client.post("/api/v1/auth/logout", headers={"X-Requested-With": "mawjood"})
    assert response.status_code == 204
    assert (
        'mawjood_refresh=""' in response.headers["set-cookie"]
        or "max-age=0" in response.headers["set-cookie"].lower()
    )


def test_refresh_is_refused_once_the_account_is_deactivated(client, auth):
    refresh = login(client, EMAILS[SAAD])["refresh_token"]
    admin = auth(ADMIN_EMAIL)
    assert (
        client.patch(f"/api/v1/admin/students/{SAAD}", json={"is_active": False}, headers=admin).status_code
        == 200
    )
    assert client.post("/api/v1/auth/refresh", json={"refresh_token": refresh}).status_code == 401


def test_roles_are_enforced_server_side(client, auth):
    student = auth(SAAD)
    assert client.post("/api/v1/me/status", json={"status": "busy"}, headers=student).status_code == 403
    assert client.get("/api/v1/admin/departments", headers=student).status_code == 403
