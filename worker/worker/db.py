"""
db.py — asyncpg connection pool management.

Usage in lifespan:
    await init_pool(app)
    ...
    await close_pool(app)

In route handlers:
    pool = get_pool(request.app)
    async with pool.acquire() as conn:
        rows = await conn.fetch("SELECT ...")
"""
import asyncpg
import structlog
from fastapi import FastAPI

from worker.config import settings

logger = structlog.get_logger(__name__)


async def init_pool(app: FastAPI) -> None:
    """
    Create the asyncpg connection pool and store it on app.state.
    Called once during FastAPI lifespan startup.
    """
    # Strip the 'postgresql+asyncpg://' SQLAlchemy prefix if present so
    # asyncpg.create_pool receives a plain 'postgresql://' DSN.
    dsn = settings.database_url.replace("postgresql+asyncpg://", "postgresql://")

    logger.info("db.pool_creating", dsn_prefix=dsn[:30])
    app.state.db_pool = await asyncpg.create_pool(
        dsn,
        min_size=2,
        max_size=10,
        command_timeout=30,
    )
    logger.info("db.pool_ready")


async def close_pool(app: FastAPI) -> None:
    """
    Gracefully close the connection pool.
    Called during FastAPI lifespan shutdown.
    """
    pool: asyncpg.Pool | None = getattr(app.state, "db_pool", None)
    if pool:
        logger.info("db.pool_closing")
        await pool.close()
        logger.info("db.pool_closed")


def get_pool(app: FastAPI) -> asyncpg.Pool:
    """
    Return the live connection pool stored on app.state.
    Raises RuntimeError if init_pool() was never called.
    """
    pool: asyncpg.Pool | None = getattr(app.state, "db_pool", None)
    if pool is None:
        raise RuntimeError("Database pool not initialised — was init_pool() called?")
    return pool
