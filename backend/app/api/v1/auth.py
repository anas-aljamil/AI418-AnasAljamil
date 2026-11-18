"""Sign-up, sign-in, token refresh and sign-out.

Access tokens (15 min) travel in the Authorization header and live only in
memory on the client. Refresh tokens: native clients receive them in the body
(stored in expo-secure-store); the web build receives an httpOnly,
SameSite=Strict cookie scoped to /api/v1/auth. Cookie-based calls must also send
X-Requested-With: mawjood, which a cross-site form cannot do (see docs/security.md).

Sign-up needs an address at the university domain (SIGNUP_EMAIL_DOMAIN). A
student's address is their university number (1234567@upm.edu.sa), so the
number is read from it. A student is signed in at once; a professor's account is created inactive and
waits for an admin to activate it, so nobody can make themselves a professor.

A forgotten password (owner request S5d, 2026-11-18) is reset through a link sent by email:
it works once, for 30 minutes, and only the SHA-256 of its token is stored. The answer to a
request is the same whether or not the email has an account (docs/security.md).
"""

import hashlib
import re
import secrets
from datetime import timedelta

from fastapi import APIRouter, BackgroundTasks, Depends, Request, Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.core.clock import Clock, get_clock
from app.core.errors import AppError
from app.core.network import came_through_tunnel, client_address, is_https, public_origin
from app.core.rate_limit import RateLimiter
from app.core.security import create_token, decode_token, hash_password, verify_password
from app.db import get_db
from app.deps import UNAUTHORIZED, get_current_user
from app.models import Professor, Student, User
from app.schemas import (
    ForgotPasswordIn,
    LoginIn,
    MeOut,
    PasswordChangeIn,
    PendingOut,
    ProfessorProfileOut,
    RefreshIn,
    ResetPasswordIn,
    SignUpIn,
    StudentProfileOut,
    StudentSignUpIn,
    TokenOut,
)
from app.services import accounts, mail

router = APIRouter(prefix="/auth", tags=["auth"])

REFRESH_COOKIE = "mawjood_refresh"
COOKIE_PATH = "/api/v1/auth"
CSRF_HEADER, CSRF_VALUE = "X-Requested-With", "mawjood"
login_limiter = RateLimiter(get_settings().login_attempts_per_minute, 60)
signup_limiter = RateLimiter(get_settings().signups_per_minute, 60)
reset_limiter = RateLimiter(get_settings().password_resets_per_minute, 60)
RESET_LINK_LIFETIME = timedelta(minutes=30)
STUDENT_NUMBER = re.compile(r"[0-9]{4,12}")  # the local part of a student's university email
# Every seed account shares this published password (db/seed.sql). Through the public link the
# demo students and professors may use it (fictional data, owner decision 2026-11-11), but an
# admin account still on it signs in only from this computer or its Wi-Fi: anyone who reads
# the password could otherwise run the whole site. scripts/set_password.py gives the admin a
# private password; after reset_db.py the admin is back on this one and blocked again.
SEED_PASSWORD = "Mawjood-Demo-2026"  # noqa: S105


def me_out(db: Session, user: User) -> MeOut:
    out = MeOut(
        user_id=user.user_id,
        email=user.email,
        role=user.role,
        full_name_ar=user.full_name_ar,
        full_name_en=user.full_name_en,
        preferred_locale=user.preferred_locale,
        photo_updated_at=user.photo_updated_at,
    )
    if user.role == "student":
        out.student = StudentProfileOut.model_validate(db.get(Student, user.user_id))
    elif user.role == "professor":
        out.professor = ProfessorProfileOut.model_validate(db.get(Professor, user.user_id))
    return out


def issue_tokens(
    db: Session, user: User, client: str, request: Request, response: Response, clock: Clock
) -> TokenOut:
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
            secure=settings.cookie_secure or is_https(request),
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
    login_limiter.check(f"{client_address(request)}|{body.email}")
    user = db.scalar(select(User).where(User.email == body.email))
    if not verify_password(body.password, user.password_hash if user else None):
        raise AppError(401, "INVALID_CREDENTIALS", "The email or password is incorrect.")
    # Checked after the password, so it reveals nothing to someone without it.
    if user.role == "admin" and body.password == SEED_PASSWORD and came_through_tunnel(request):
        raise AppError(
            403,
            "ADMIN_DEMO_PASSWORD",
            "The admin account still has the demo password, so it signs in only on the computer "
            "that runs Mawjood. Give it a private password: python3 scripts/set_password.py.",
        )
    if not user.is_active:
        raise AppError(
            403,
            "ACCOUNT_DISABLED",
            "This account is not active: it waits for an administrator or has been deactivated.",
        )
    return issue_tokens(db, user, body.client, request, response, clock)


@router.post(
    "/signup",
    response_model=TokenOut | PendingOut,
    status_code=201,
    summary="Create an account (students are signed in; professors wait for an admin)",
)
def signup(
    body: SignUpIn,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
    clock: Clock = Depends(get_clock),
) -> TokenOut | PendingOut:
    signup_limiter.check(client_address(request))
    domain = get_settings().signup_email_domain
    if not body.email.endswith(f"@{domain}"):
        raise AppError(422, "EMAIL_DOMAIN", f"Use your university email address (@{domain}).")
    accounts.ensure_exists(db, body.department_id)
    now = clock.now()
    if isinstance(body, StudentSignUpIn):
        university_no = body.email.split("@")[0]
        if not STUDENT_NUMBER.fullmatch(university_no):
            raise AppError(
                422,
                "STUDENT_EMAIL",
                f"Students sign up with their university email: university number@{domain}.",
            )
        accounts.ensure_email_free(db, body.email)  # same address again: say so, not "number taken"
        accounts.ensure_university_no_free(db, university_no)
        user = accounts.create_user(db, body, "student", now)
        db.add(
            Student(
                student_id=user.user_id,
                university_no=university_no,
                department_id=body.department_id,
                study_year=body.study_year,
            )
        )
        db.commit()
        return issue_tokens(db, user, body.client, request, response, clock)
    user = accounts.create_user(db, body, "professor", now, active=False)
    db.add(
        Professor(
            professor_id=user.user_id,
            department_id=body.department_id,
            honorific=body.honorific,
            academic_rank=body.academic_rank,
        )
    )
    db.commit()
    response.status_code = 202
    return PendingOut(email=user.email)


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
    return issue_tokens(db, user, client, request, response, clock)


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
        secure=get_settings().cookie_secure or is_https(request),
    )
    return response


@router.post("/password", status_code=204, summary="Change my password (needs the current one)")
def change_password(
    body: PasswordChangeIn,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    clock: Clock = Depends(get_clock),
) -> Response:
    # Limited like sign-in, per account: a stolen access token must not be a way to guess the
    # current password.
    login_limiter.check(f"password|{user.user_id}")
    if not verify_password(body.current_password, user.password_hash):
        raise AppError(400, "WRONG_PASSWORD", "The current password is incorrect.")
    # The seed password is published, so anyone on the public link knows it: there, a demo
    # account keeps it, or one visitor could lock everyone else out of it.
    if body.current_password == SEED_PASSWORD and came_through_tunnel(request):
        raise AppError(
            403,
            "DEMO_ACCOUNT",
            "This is a shared demo account, so its password cannot be changed through the public link.",
        )
    if body.new_password == body.current_password:
        raise AppError(400, "PASSWORD_UNCHANGED", "The new password is the same as the current one.")
    user.password_hash = hash_password(body.new_password)
    user.updated_at = clock.now()
    db.commit()
    return Response(status_code=204)


@router.get("/me", response_model=MeOut, summary="The signed-in account")
def me(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> MeOut:
    return me_out(db, user)


# --- forgotten password (owner request S5d, 2026-11-18) -----------------------------------

RESET_SUBJECT = {"ar": "موجود: تعيين كلمة مرور جديدة", "en": "Mawjood: set a new password"}
RESET_BODY = {
    "ar": (
        "مرحبًا {name}،\n\nطلب أحدهم تعيين كلمة مرور جديدة لحسابك في موجود. لتعيينها افتح هذا الرابط"
        " خلال 30 دقيقة:\n\n{link}\n\nيعمل الرابط مرة واحدة. إن لم تطلب ذلك فتجاهل هذه الرسالة،"
        " وتبقى كلمة مرورك كما هي.\n"
    ),
    "en": (
        "Hello {name},\n\nSomeone asked to set a new password for your Mawjood account. To set it,"
        " open this link within 30 minutes:\n\n{link}\n\nThe link works once. If you did not ask for"
        " this, ignore this email; your password stays as it is.\n"
    ),
}


def token_hash(token: str) -> str:
    return hashlib.sha256(token.encode("ascii", "replace")).hexdigest()


@router.post("/forgot-password", status_code=202, summary="Email me a link to set a new password")
def forgot_password(
    body: ForgotPasswordIn,
    request: Request,
    background: BackgroundTasks,
    db: Session = Depends(get_db),
    clock: Clock = Depends(get_clock),
) -> Response:
    """Always 202 with no body, account or not, so the answer reveals no addresses. The email
    is sent after the response, so its time reveals nothing either."""
    reset_limiter.check(f"forgot|{client_address(request)}")
    reset_limiter.check(f"forgot|{body.email}")
    user = db.scalar(select(User).where(User.email == body.email))
    if user is None or not user.is_active:
        return Response(status_code=202)
    # Through the public link, a shared demo account keeps its published password: a reset
    # would lock every other visitor out of it (as for changing the password).
    if came_through_tunnel(request) and verify_password(SEED_PASSWORD, user.password_hash):
        return Response(status_code=202)
    token = secrets.token_urlsafe(32)
    user.password_reset_hash = token_hash(token)
    user.password_reset_expires_at = clock.now() + RESET_LINK_LIFETIME
    db.commit()
    language = "ar" if user.preferred_locale == "ar" else "en"
    link = f"{public_origin(request, get_settings().public_url)}/reset-password?token={token}"
    name = user.full_name_ar if language == "ar" else user.full_name_en
    background.add_task(
        mail.send,
        user.email,
        RESET_SUBJECT[language],
        RESET_BODY[language].format(name=name, link=link),
        user.user_id,
    )
    return Response(status_code=202)


@router.post("/reset-password", status_code=204, summary="Set a new password with the emailed link")
def reset_password(
    body: ResetPasswordIn,
    request: Request,
    db: Session = Depends(get_db),
    clock: Clock = Depends(get_clock),
) -> Response:
    reset_limiter.check(f"reset|{client_address(request)}")
    now = clock.now()
    user = db.scalar(select(User).where(User.password_reset_hash == token_hash(body.token)))
    if user is None or user.password_reset_expires_at <= now or not user.is_active:
        raise AppError(
            400,
            "RESET_LINK_INVALID",
            "This link no longer works: it was used, it is older than 30 minutes, or a newer one was sent.",
        )
    user.password_hash = hash_password(body.new_password)
    user.password_reset_hash = user.password_reset_expires_at = None
    user.updated_at = now
    db.commit()
    return Response(status_code=204)
