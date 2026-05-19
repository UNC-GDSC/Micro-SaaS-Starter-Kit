"""
config.py — Notifier configuration loaded from environment variables.
"""
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    telegram_bot_token: str
    database_url: str           # postgresql://user:pass@host:port/dbname (sync pg driver)
    redis_url: str = "redis://localhost:6379"

    # Public app URL for deep-link buttons in messages
    app_url: str = "https://resumeai-bot.ru"

    # Rate-limit: max notifications per user per hour
    rate_limit_per_hour: int = 30

    model_config = SettingsConfigDict(env_file=".env", case_sensitive=False)


settings = Settings()
