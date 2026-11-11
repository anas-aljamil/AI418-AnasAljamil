"""Mawjood API entry point: uvicorn app.main:app"""

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import APIRouter, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1 import admin, appointments, auth, conversations, me, notifications, professors
from app.config import get_settings
from app.core import schema_check
from app.core.errors import AppError, install_error_handlers
from app.db import get_engine


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
        allow_credentials=True,  # the web build's refresh cookie
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
        allow_headers=["Authorization", "Content-Type", "X-Requested-With"],
    )
    install_error_handlers(app)

    api = APIRouter(prefix="/api/v1")

    @api.get("/health", tags=["health"], summary="Liveness check (used to test the phone's connection)")
    def health() -> dict[str, str]:
        if app.state.schema_problems:
            raise AppError(
                503,
                "SCHEMA_OUTDATED",
                f"The database is older than the code ({'; '.join(app.state.schema_problems)}). "
                f"{schema_check.FIX}",
            )
        return {"status": "ok"}

    for module in (auth, professors, me, appointments, conversations, notifications, admin):
        api.include_router(module.router)
    app.include_router(api)
    return app


app = create_app()
