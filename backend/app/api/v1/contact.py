"""Messages from Help and contact (owner request 2026-11-16).

Anyone may write, signed in or not: a person who cannot sign in is the one most likely to need
the administrator. The message keeps the name and reply address the sender gave; when an
access token comes with it, the account is linked too. The administrator lists, marks and
deletes the messages under /admin/contact-messages (app/api/v1/admin.py).
"""

from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.config import get_settings
from app.core.clock import Clock, get_clock
from app.core.network import client_address
from app.core.rate_limit import RateLimiter
from app.db import get_db
from app.deps import optional_user
from app.models import ContactMessage, User
from app.schemas import ContactIn, ContactOut

router = APIRouter(prefix="/contact", tags=["contact"])

# Per client address, like sign-up: the form is open to anyone.
contact_limiter = RateLimiter(get_settings().contact_messages_per_minute, 60)


@router.post("", response_model=ContactOut, status_code=201, summary="Send a message to the administrator")
def send_contact_message(
    body: ContactIn,
    request: Request,
    user: User | None = Depends(optional_user),
    db: Session = Depends(get_db),
    clock: Clock = Depends(get_clock),
) -> ContactOut:
    contact_limiter.check(client_address(request))
    message = ContactMessage(
        user_id=user.user_id if user else None,
        sender_name=body.name,
        sender_email=body.email,
        topic=body.topic,
        body=body.body,
        created_at=clock.now(),
    )
    db.add(message)
    db.commit()
    return ContactOut.model_validate(message)
