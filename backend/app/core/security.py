"""Password hashing (argon2id) and JWT access/refresh tokens."""

from datetime import datetime, timedelta

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError

from app.config import get_settings
from app.core.clock import to_aware_utc

ALGORITHM = "HS256"
_hasher = PasswordHasher()
# Verified against when the email is unknown, so a wrong email and a wrong
# password take the same time (no account enumeration by timing).
_DUMMY_HASH = _hasher.hash("timing-equalizer-not-a-real-password")


def hash_password(password: str) -> str:
    return _hasher.hash(password)


def verify_password(password: str, password_hash: str | None) -> bool:
    try:
        return _hasher.verify(password_hash or _DUMMY_HASH, password) and password_hash is not None
    except (VerificationError, InvalidHashError):
        return False


def create_token(user_id: int, role: str, kind: str, now: datetime) -> tuple[str, datetime]:
    """Return (token, expiry as naive UTC). kind is 'access' or 'refresh'."""
    settings = get_settings()
    lifetime = (
        timedelta(minutes=settings.access_token_minutes)
        if kind == "access"
        else timedelta(days=settings.refresh_token_days)
    )
    expires = now + lifetime
    payload = {
        "sub": str(user_id),
        "role": role,
        "type": kind,
        "iat": int(to_aware_utc(now).timestamp()),
        "exp": int(to_aware_utc(expires).timestamp()),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=ALGORITHM), expires


def decode_token(token: str, kind: str, now: datetime) -> dict | None:
    """Return the claims if the token is valid, of the given kind and unexpired at `now`.

    Expiry is checked against the application clock (not the system clock) so
    the same rule applies everywhere time matters.
    """
    try:
        claims = jwt.decode(
            token,
            get_settings().jwt_secret,
            algorithms=[ALGORITHM],
            options={"require": ["sub", "type", "exp"], "verify_exp": False, "verify_iat": False},
        )
    except jwt.PyJWTError:
        return None
    if claims.get("type") != kind or claims["exp"] <= to_aware_utc(now).timestamp():
        return None
    return claims
