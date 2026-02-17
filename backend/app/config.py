from __future__ import annotations

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Core
    environment: str = Field(default="dev")  # dev | prod
    database_url: str

    # JWT
    jwt_secret_key: str
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60  # 1 hour

    # Refresh hashing
    refresh_token_pepper: str

    # Cookies
    cookie_secure: bool = False
    cookie_samesite: str = "lax"  # "lax" or "strict" (avoid "none" unless HTTPS)
    cookie_domain: str | None = None

    # CORS
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"

    # SQLAlchemy
    sql_echo: bool = False


settings = Settings()
