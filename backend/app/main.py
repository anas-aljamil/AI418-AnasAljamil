"""Mawjood API entry point: uvicorn app.main:app"""

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import APIRouter, FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import RequestResponseEndpoint
from starlette.middleware.gzip import GZipMiddleware

from app.api.v1 import admin, appointments, auth, contact, conversations, me, notifications, professors
from app.config import get_settings
from app.core import schema_check
from app.core.errors import AppError, install_error_handlers
from app.db import get_engine
from app.web import mount_web_build

# Sent with every answer, pages and API alike: the browser must not guess a file's type, no
# other site may show Mawjood inside a frame, and a link out carries only the site's address.
SECURITY_HEADERS = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "strict-origin-when-cross-origin",
}


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    app.state.schema_problems = schema_check.check_on_startup(get_engine())
    yield


def create_app() -> FastAPI:
    app = FastAPI(
        title="Mawjood API",
        version="0.2.0",
        description="Office-hours availability: live professor status, booking and messaging. "
        "All timestamps are UTC (ISO 8601, 'Z'); schedule times are Asia/Riyadh 'HH:MM'.",
        docs_url="/docs",
        lifespan=lifespan,
    )
    app.state.schema_problems = []  # filled in at startup (tests use their own database)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=get_settings().cors_origins,
        allow_origin_regex=get_settings().cors_origin_regex,
        allow_credentials=True,  # the web build's refresh cookie
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
        allow_headers=["Authorization", "Content-Type", "X-Requested-With"],
    )
    # The browser version is about 4 MB of scripts and fonts; gzip sends roughly a third of
    # that (answers under 1 KB are left alone).
    app.add_middleware(GZipMiddleware, minimum_size=1024)

    @app.middleware("http")
    async def security_headers(request: Request, call_next: RequestResponseEndpoint) -> Response:
        response = await call_next(request)
        for name, value in SECURITY_HEADERS.items():
            response.headers.setdefault(name, value)
        return response

    install_error_handlers(app)

    api = APIRouter(prefix="/api/v1")

    @api.get("/health", tags=["health"], summary="Liveness check (used to test the phone's connection)")
    def health() -> dict[str, str]:
        if app.state.schema_problems is None:
            # MySQL was not reachable when the API started: look again now, so starting MySQL
            # later is enough (no API restart).
            app.state.schema_problems = schema_check.schema_problems(get_engine())
        if app.state.schema_problems is None:
            raise AppError(503, "DATABASE_UNREACHABLE", schema_check.UNREACHABLE)
        if app.state.schema_problems:
            raise AppError(
                503,
                "SCHEMA_OUTDATED",
                f"The database is older than the code ({'; '.join(app.state.schema_problems)}). "
                f"{schema_check.FIX}",
            )
        return {"status": "ok"}

    for module in (auth, professors, me, appointments, conversations, notifications, admin, contact):
        api.include_router(module.router)
    app.include_router(api)
    mount_web_build(app, get_settings().web_dir)  # pages for paths no route matched
    return app


app = create_app()
