"""In-app notifications. The text is rendered by the client from the type."""

from datetime import datetime

from sqlalchemy.orm import Session

from app.models import Notification


def notify(
    db: Session,
    user_id: int,
    kind: str,
    now: datetime,
    *,
    appointment_id: int | None = None,
    conversation_id: int | None = None,
) -> None:
    db.add(
        Notification(
            user_id=user_id,
            type=kind,
            appointment_id=appointment_id,
            conversation_id=conversation_id,
            created_at=now,
        )
    )
