"""Authentication and role checks shared by the routers."""

from collections.abc import Callable

from fastapi import Depends, Request
from sqlalchemy.orm import Session

from app.core.clock import Clock, get_clock
from app.core.errors import AppError, forbidden
from app.core.security import decode_token
from app.db import get_db
from app.models import User

UNAUTHORIZED = AppError(401, "UNAUTHORIZED", "Sign in to continue.", headers={"WWW-Authenticate": "Bearer"})


def get_current_user(
    request: Request, db: Session = Depends(get_db), clock: Clock = Depends(get_clock)
) -> User:
    scheme, _, token = request.headers.get("Authorization", "").partition(" ")
    if scheme.lower() != "bearer" or not token:
        raise UNAUTHORIZED
    claims = decode_token(token, "access", clock.now())
    if claims is None:
        raise UNAUTHORIZED
    user = db.get(User, int(claims["sub"]))
    if user is None or not user.is_active:
        raise UNAUTHORIZED
    return user


def require_role(*roles: str) -> Callable[..., User]:
    def checker(user: User = Depends(get_current_user)) -> User:
        if user.role not in roles:
            raise forbidden(f"This action is for {' or '.join(roles)} accounts.")
        return user

    return checker


current_student = require_role("student")
current_professor = require_role("professor")
current_admin = require_role("admin")
