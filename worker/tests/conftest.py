"""
conftest.py — Worker test fixtures.

Sets stub environment variables so worker.config.Settings can be
instantiated during test collection without a real .env file.
"""
import os

# Inject required settings before any worker module is imported.
# These are test-only stubs — never real credentials.
os.environ.setdefault("WORKER_SECRET", "test-worker-secret-stub")
os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://test:test@localhost:5432/test")
os.environ.setdefault("OPENAI_API_KEY", "sk-test-stub")
