"""Mawjood API entry point: uvicorn app.main:app"""

from fastapi import APIRouter, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1 import admin, appointments, auth, me, professors
from app.config import get_settings
from app.core.errors import install_error_handlers


def create_app() -> FastAPI:
    app = FastAPI(
        title="Mawjood API",
        version="0.2.0",
        description="Office-hours availability: live professor status, booking and messaging. "
        "All timestamps are UTC (ISO 8601, 'Z'); schedule times are Asia/Riyadh 'HH:MM'.",
        docs_url="/docs",
    )
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
        return {"status": "ok"}

    for module in (auth, professors, me, appointments, admin):
        api.include_router(module.router)
    app.include_router(api)
    return app


app = create_app()
