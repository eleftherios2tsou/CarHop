from __future__ import annotations

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Database
    database_url: str = Field(..., alias="DATABASE_URL")
    sql_echo: bool = Field(default=False, alias="SQL_ECHO")

    # JWT
    jwt_secret_key: str = Field("dev-secret-change-me", alias="JWT_SECRET_KEY")
    jwt_algorithm: str = Field("HS256", alias="JWT_ALGORITHM")
    access_token_expire_minutes: int = Field(15, alias="ACCESS_TOKEN_EXPIRE_MINUTES")

    # Refresh tokens
    refresh_token_pepper: str = Field(
        "dev-refresh-pepper-change-me",
        alias="REFRESH_TOKEN_PEPPER",
    )
    refresh_token_expire_days: int = Field(
        30,
        alias="REFRESH_TOKEN_EXPIRE_DAYS",
    )

    # Uploads
    uploads_dir: str = Field("/app/uploads", alias="UPLOADS_DIR")
    storage_backend: str = Field("local", alias="STORAGE_BACKEND")  # "local" | "azure"

    # Azure Blob Storage (used when STORAGE_BACKEND=azure)
    azure_storage_connection_string: str | None = Field(None, alias="AZURE_STORAGE_CONNECTION_STRING")
    azure_container_name: str = Field("carhop-uploads", alias="AZURE_CONTAINER_NAME")

    # Cookies

    cookie_secure: bool = Field(False, alias="COOKIE_SECURE")
    cookie_httponly: bool = Field(True, alias="COOKIE_HTTPONLY")
    cookie_samesite: str = Field("lax", alias="COOKIE_SAMESITE")
    cookie_domain: str | None = Field(None, alias="COOKIE_DOMAIN")

    # SMTP / email (all optional — emails are silently skipped if not configured)
    smtp_host: str | None = Field(None, alias="SMTP_HOST")
    smtp_port: int = Field(587, alias="SMTP_PORT")
    smtp_user: str | None = Field(None, alias="SMTP_USER")
    smtp_password: str | None = Field(None, alias="SMTP_PASSWORD")
    smtp_from: str = Field("noreply@carhop.com", alias="SMTP_FROM")

    # Optional
    api_base_url: str = Field("http://localhost:8000", alias="API_BASE_URL")
    cors_origins: str = Field("*", alias="CORS_ORIGINS")

    # OpenAI (optional — AI search disabled if not set)
    openai_api_key: str | None = Field(None, alias="OPENAI_API_KEY")

    # Stripe payments
    stripe_secret_key: str | None = Field(None, alias="STRIPE_SECRET_KEY")
    stripe_webhook_secret: str | None = Field(None, alias="STRIPE_WEBHOOK_SECRET")
    frontend_base_url: str = Field("http://localhost:5173", alias="FRONTEND_BASE_URL")
    payments_currency: str = Field("gbp", alias="PAYMENTS_CURRENCY")

    @property
    def cors_origins_list(self) -> list[str]:
        raw = (self.cors_origins or "").strip()
        if not raw:
            return []
        if raw == "*":
            return ["*"]
        return [x.strip() for x in raw.split(",") if x.strip()]


settings = Settings()
