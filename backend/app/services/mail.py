"""Sending email (owner request S5d, 2026-11-18): only the "forgot password" link so far.

With SMTP_HOST set in .env, mail goes through that server with Python's own smtplib (STARTTLS
on port 587 by default; no new dependency). Without it, each message is written as an .eml
file to backend/outbox/ (git-ignored), so the flow can be tried without a mail account. A
message that cannot be sent is logged by recipient id only: never the address's link or token.
"""

import logging
import smtplib
from datetime import UTC, datetime
from email.message import EmailMessage
from pathlib import Path

from app.config import get_settings

log = logging.getLogger("mawjood")


def send(to: str, subject: str, body: str, user_id: int) -> None:
    settings = get_settings()
    message = EmailMessage()
    message["From"] = settings.smtp_from or settings.smtp_user or "mawjood@localhost"
    message["To"] = to
    message["Subject"] = subject
    message.set_content(body)
    try:
        if settings.smtp_host:
            with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=15) as server:
                if settings.smtp_starttls:
                    server.starttls()
                if settings.smtp_user:
                    server.login(settings.smtp_user, settings.smtp_password)
                server.send_message(message)
        else:
            outbox: Path = settings.outbox_dir
            outbox.mkdir(parents=True, exist_ok=True)
            stamp = datetime.now(UTC).strftime("%Y%m%dT%H%M%S%f")
            (outbox / f"{stamp}-user{user_id}.eml").write_bytes(message.as_bytes())
    except (OSError, smtplib.SMTPException) as exc:
        log.error("Could not send email to user %s: %s", user_id, type(exc).__name__)
