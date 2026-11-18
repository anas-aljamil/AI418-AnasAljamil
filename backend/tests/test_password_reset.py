"""Forgotten password by email (owner request S5d, 2026-11-18)."""

import re
from datetime import timedelta

import pytest
from starlette.requests import Request

from app.core.network import public_origin
from tests.conftest import DEMO_PASSWORD, EMAILS, SAAD

FORGOT = "/api/v1/auth/forgot-password"
RESET = "/api/v1/auth/reset-password"


@pytest.fixture
def outbox(monkeypatch) -> list[dict]:
    """Every email the API sends, instead of sending it."""
    sent: list[dict] = []
    monkeypatch.setattr(
        "app.services.mail.send",
        lambda to, subject, body, user_id: sent.append({"to": to, "subject": subject, "body": body}),
    )
    return sent


def token_in(mail: dict) -> str:
    match = re.search(r"/reset-password\?token=([A-Za-z0-9_-]+)", mail["body"])
    assert match, mail["body"]
    return match.group(1)


def sign_in(client, password: str) -> int:
    return client.post("/api/v1/auth/login", json={"email": EMAILS[SAAD], "password": password}).status_code


def test_the_answer_is_the_same_with_or_without_an_account(client, outbox):
    assert client.post(FORGOT, json={"email": "nobody@university.example"}).status_code == 202
    assert outbox == []
    known = client.post(FORGOT, json={"email": " S.AlMutairi@University.Example "})
    assert (known.status_code, known.content) == (202, b"")
    assert [mail["to"] for mail in outbox] == [EMAILS[SAAD]]


def test_the_emailed_link_sets_a_new_password_once(client, outbox):
    client.post(FORGOT, json={"email": EMAILS[SAAD]})
    mail = outbox[0]
    # Saad's account is in Arabic, so the email is too; the link uses PUBLIC_URL here.
    assert mail["subject"] == "موجود: تعيين كلمة مرور جديدة"
    assert "http://localhost:8000/reset-password?token=" in mail["body"]
    token = token_in(mail)
    assert client.post(RESET, json={"token": token, "new_password": "short"}).status_code == 422
    assert client.post(RESET, json={"token": token, "new_password": "Brand-new-2026"}).status_code == 204
    assert sign_in(client, "Brand-new-2026") == 200
    assert sign_in(client, DEMO_PASSWORD) == 401
    again = client.post(RESET, json={"token": token, "new_password": "Another-one-2026"})
    assert (again.status_code, again.json()["error"]["code"]) == (400, "RESET_LINK_INVALID")


def test_a_link_stops_working_after_30_minutes(client, outbox, clock):
    client.post(FORGOT, json={"email": EMAILS[SAAD]})
    clock.at += timedelta(minutes=31)
    late = client.post(RESET, json={"token": token_in(outbox[0]), "new_password": "Brand-new-2026"})
    assert late.json()["error"]["code"] == "RESET_LINK_INVALID"


def test_a_new_request_replaces_the_old_link(client, outbox):
    client.post(FORGOT, json={"email": EMAILS[SAAD]})
    client.post(FORGOT, json={"email": EMAILS[SAAD]})
    first, second = (token_in(mail) for mail in outbox)
    assert client.post(RESET, json={"token": first, "new_password": "Brand-new-2026"}).status_code == 400
    assert client.post(RESET, json={"token": second, "new_password": "Brand-new-2026"}).status_code == 204


def test_through_the_public_link_a_demo_account_gets_no_email(client, outbox):
    tunnel = {"CF-Connecting-IP": "203.0.113.7"}
    assert client.post(FORGOT, json={"email": EMAILS[SAAD]}, headers=tunnel).status_code == 202
    assert outbox == []  # same answer, nothing sent: the shared password stays


def test_requests_are_limited(client, outbox):
    for _ in range(3):
        assert client.post(FORGOT, json={"email": EMAILS[SAAD]}).status_code == 202
    assert client.post(FORGOT, json={"email": EMAILS[SAAD]}).status_code == 429


def request_with(host: str, client_host: str, tunnel: bool) -> Request:
    headers = [(b"host", host.encode())]
    if tunnel:
        headers.append((b"cf-connecting-ip", b"203.0.113.7"))
    return Request({"type": "http", "headers": headers, "client": (client_host, 5000)})


def test_a_link_points_at_the_public_link_only_when_the_tunnel_really_sent_the_request():
    configured = "http://localhost:8000/"
    real = request_with("mawjood-demo.trycloudflare.com", "127.0.0.1", tunnel=True)
    assert public_origin(real, configured) == "https://mawjood-demo.trycloudflare.com"
    # A forged Host from the Wi-Fi, or a host that is not the tunnel's, falls back to PUBLIC_URL.
    from_wifi = request_with("evil.trycloudflare.com", "192.168.1.20", tunnel=True)
    other_host = request_with("evil.example", "127.0.0.1", tunnel=True)
    direct = request_with("evil.example", "127.0.0.1", tunnel=False)
    for request in (from_wifi, other_host, direct):
        assert public_origin(request, configured) == "http://localhost:8000"


def test_without_smtp_the_email_is_written_to_the_outbox(monkeypatch, tmp_path):
    from app.services import mail

    class Settings:
        smtp_host = ""
        smtp_from = smtp_user = ""
        outbox_dir = tmp_path / "outbox"

    monkeypatch.setattr(mail, "get_settings", lambda: Settings)
    mail.send("s.almutairi@university.example", "Mawjood: set a new password", "Hello\n", 9)
    [written] = list((tmp_path / "outbox").glob("*-user9.eml"))
    text = written.read_text(encoding="utf-8")
    assert "To: s.almutairi@university.example" in text and "Hello" in text
