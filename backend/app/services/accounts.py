"""Creating accounts, shared by the admin area and self sign-up (app/api/v1/auth.py)."""

from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.errors import AppError
from app.core.security import hash_password
from app.models import College, Department, Office, Student, User
from app.schemas import AccountIn


def ensure_email_free(db: Session, email: str, except_user_id: int | None = None) -> None:
    existing = db.scalar(select(User.user_id).where(User.email == email))
    if existing is not None and existing != except_user_id:
        raise AppError(409, "EMAIL_TAKEN", "Another account already uses this email.")


def ensure_university_no_free(db: Session, university_no: str) -> None:
    if db.scalar(select(Student.student_id).where(Student.university_no == university_no)):
        raise AppError(409, "UNIVERSITY_NO_TAKEN", "Another student already has this university number.")


def ensure_college_exists(db: Session, college_id: int | None) -> None:
    if college_id is not None and db.get(College, college_id) is None:
        raise AppError(422, "INVALID_REFERENCE", "The college does not exist.")


def ensure_exists(db: Session, department_id: int | None, office_id: int | None = None) -> None:
    if department_id is not None and db.get(Department, department_id) is None:
        raise AppError(422, "INVALID_REFERENCE", "The department does not exist.")
    if office_id is not None and db.get(Office, office_id) is None:
        raise AppError(422, "INVALID_REFERENCE", "The office does not exist.")


def create_user(db: Session, body: AccountIn, role: str, now: datetime, active: bool = True) -> User:
    """Add the users row (flushed, so user_id is set); the caller adds the subtype row."""
    ensure_email_free(db, body.email)
    user = User(
        email=body.email,
        password_hash=hash_password(body.password),
        role=role,
        full_name_ar=body.full_name_ar,
        full_name_en=body.full_name_en,
        preferred_locale=body.preferred_locale,
        is_active=active,
        created_at=now,
        updated_at=now,
    )
    db.add(user)
    db.flush()
    return user
