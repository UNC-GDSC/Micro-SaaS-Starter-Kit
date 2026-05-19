"""
config.py — Worker configuration loaded from environment variables.
All secrets are read at startup via Pydantic Settings (never hardcoded).
"""
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # Required — no defaults so startup fails fast if omitted
    worker_secret: str
    database_url: str  # postgresql+asyncpg://user:pass@host:port/dbname

    # OpenAI
    openai_api_key: str = ""
    openai_model: str = "gpt-4o-mini"

    # Encryption — MUST match old .env to decrypt existing LinkedIn passwords
    encryption_key: str = ""

    # Adzuna job board API (https://developer.adzuna.com)
    adzuna_app_id: str = ""
    adzuna_app_key: str = ""

    # Which job boards to query (comma-separated in env, list in code)
    english_job_sources: list[str] = ["adzuna", "themuse", "arbeitnow", "remoteok"]

    # Redis (optional — used by P18 Telegram notifier pub/sub)
    redis_url: str = ""

    # LinkedIn automation rate-limit delays (seconds)
    min_apply_delay: int = 30
    max_apply_delay: int = 90

    worker_version: str = "1.0.0"

    model_config = SettingsConfigDict(env_file=".env", case_sensitive=False)


settings = Settings()
