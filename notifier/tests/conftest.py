"""
conftest.py — Inject stub environment variables so Settings() can be
instantiated during test collection without a real .env file.
"""
import os

os.environ.setdefault("TELEGRAM_BOT_TOKEN", "1234567890:AAtest_token_for_testing_only_stub")
os.environ.setdefault("DATABASE_URL", "postgresql://test:test@localhost:5432/test")
os.environ.setdefault("REDIS_URL", "redis://localhost:6379")
os.environ.setdefault("APP_URL", "https://resumeai-bot.ru")
