"""Sign-in, token refresh and sign-out.

Access tokens (15 min) travel in the Authorization header and live only in
memory on the client. Refresh tokens: native clients receive them in the body
(stored in expo-secure-store); the web build receives an httpOnly,
SameSite=Strict cookie scoped to /api/v1/auth. Cookie-based calls must also send
X-Requested-With: mawjood, which a cross-site form cannot do (see docs/security.md).
"""

from fastapi import APIRouter, Depends, Request, Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.core.clock import Clock, get_clock
from app.core.errors import AppError
from app.core.rate_limit import RateLimiter
from app.core.security import create_token, decode_token, verify_password
from app.db import get_db
from app.deps import UNAUTHORIZED, get_current_user
from app.models import Professor, Student, User
from app.schemas import LoginIn, MeOut, ProfessorProfileOut, RefreshIn, StudentProfileOut, TokenOut

router = APIRouter(prefix="/auth", tags=["auth"])

REFRESH_COOKIE = "mawjood_refresh"
COOKIE_PATH = "/api/v1/auth"
CSRF_HEADER, CSRF_VALUE = "X-Requested-With", "mawjood"
login_limiter = RateLimiter(get_settings().login_attempts_per_minute, 60)


def me_out(db: Session, user: User) -> MeOut:
    out = MeOut(
        user_id=user.user_id,
        email=user.email,
        role=user.role,
        full_name_ar=user.full_name_ar,
        full_name_en=user.full_name_en,
        preferred_locale=user.preferred_locale,
    )
    if user.role == "student":
        out.student = StudentProfileOut.model_validate(db.get(Student, user.user_id))
    elif user.role == "professor":
        out.professor = ProfessorProfileOut.model_validate(db.get(Professor, user.user_id))
    return out


def issue_tokens(db: Session, user: User, client: str, response: Response, clock: Clock) -> TokenOut:
    now = clock.now()
    access, access_expires = create_token(user.user_id, user.role, "access", now)
    refresh, _ = create_token(user.user_id, user.role, "refresh", now)
    settings = get_settings()
    if client == "web":
        response.set_cookie(
            REFRESH_COOKIE,
            refresh,
            max_age=settings.refresh_token_days * 86400,
            path=COOKIE_PATH,
            httponly=True,
            samesite="strict",
            secure=settings.cookie_secure,
        )
    return TokenOut(
        access_token=access,
        access_expires_at=access_expires,
        refresh_token=refresh if client == "native" else None,
        user=me_out(db, user),
    )


def require_csrf_header(request: Request) -> None:
    if request.headers.get(CSRF_HEADER) != CSRF_VALUE:
        raise AppError(403, "CSRF_CHECK_FAILED", f"Cookie requests must send the {CSRF_HEADER} header.")


@router.post("/login", response_model=TokenOut, summary="Sign in with a university email")
def login(
    body: LoginIn,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
    clock: Clock = Depends(get_clock),
) -> TokenOut:
    client_ip = request.client.host if request.client else "unknown"
    login_limiter.check(f"{client_ip}|{body.email}")
    user = db.scalar(select(User).where(User.email == body.email))
    if not verify_password(body.password, user.password_hash if user else None):
        raise AppError(401, "INVALID_CREDENTIALS", "The email or password is incorrect.")
    if not user.is_active:
        raise AppError(
            403, "ACCOUNT_DISABLED", "This account has been deactivated. Contact the administrator."
        )
    return issue_tokens(db, user, body.client, response, clock)


@router.post("/refresh", response_model=TokenOut, summary="Get a new access token")
def refresh(
    request: Request,
    response: Response,
    body: RefreshIn | None = None,
    db: Session = Depends(get_db),
    clock: Clock = Depends(get_clock),
) -> TokenOut:
    if body and body.refresh_token:
        token, client = body.refresh_token, "native"
    else:
        token, client = request.cookies.get(REFRESH_COOKIE), "web"
        if token:
            require_csrf_header(request)
    claims = decode_token(token, "refresh", clock.now()) if token else None
    user = db.get(User, int(claims["sub"])) if claims else None
    if user is None or not user.is_active:
        raise UNAUTHORIZED
    return issue_tokens(db, user, client, response, clock)


@router.post("/logout", status_code=204, summary="Sign out (clears the web refresh cookie)")
def logout(request: Request) -> Response:
    if REFRESH_COOKIE in request.cookies:
        require_csrf_header(request)
    response = Response(status_code=204)
    response.delete_cookie(
        REFRESH_COOKIE,
        path=COOKIE_PATH,
        httponly=True,
        samesite="strict",
        secure=get_settings().cookie_secure,
    )
    return response


@router.get("/me", response_model=MeOut, summary="The signed-in account")
def me(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> MeOut:
    return me_out(db, user)
