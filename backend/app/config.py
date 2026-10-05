"""Application settings, read from the repository's .env file and the environment."""

from datetime import datetime
from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy import URL

REPO_ROOT = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=REPO_ROOT / ".env", extra="ignore", env_ignore_empty=True)

    db_host: str = "127.0.0.1"
    db_port: int = 3306
    db_user: str = "root"
    db_password: str = ""
    db_name: str = "mawjood"

    # Signing key for access and refresh tokens; must be long and random.
    jwt_secret: str = Field(min_length=32)
    access_token_minutes: int = 15
    refresh_token_days: int = 7
    # Set to true behind HTTPS so the refresh cookie is only sent over TLS.
    cookie_secure: bool = False

    # Browser origins allowed to call the API (the Expo web dev server by default).
    cors_origins: list[str] = ["http://localhost:8081", "http://127.0.0.1:8081"]

    login_attempts_per_minute: int = 5
    signups_per_minute: int = 5
    # Self sign-up accepts only addresses at this domain (there is no email verification).
    signup_email_domain: str = "university.example"
    messages_per_minute: int = 20

    # Freeze the API clock for screenshots and demos, e.g. 2026-10-05T07:00:00Z. Empty = real time.
    demo_now: datetime | None = None

    def database_url(self, database: str | None = None) -> URL:
        return URL.create(
            "mysql+pymysql",
            username=self.db_user,
            password=self.db_password,
            host=self.db_host,
            port=self.db_port,
            database=database or self.db_name,
            query={"charset": "utf8mb4"},
        )


@lru_cache
def get_settings() -> Settings:
    return Settings()
