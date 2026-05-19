"""
database.py — Minimal asyncpg helpers for the notifier.

The notifier only needs to read TelegramChat rows; it never writes
(writes are done by the Next.js app via Prisma).
"""
from __future__ import annotations

import asyncpg

from config import settings


async def get_pool() -> asyncpg.Pool:
    """Create and return a connection pool (call once at startup)."""
    # Convert prisma-style postgres:// URL → standard asyncpg URL
    url = settings.database_url.replace("postgresql+asyncpg://", "postgresql://")
    return await asyncpg.create_pool(url, min_size=1, max_size=4)


async def get_telegram_chat(pool: asyncpg.Pool, user_id: str) -> dict | None:
    """
    Return TelegramChat row for user_id as a plain dict, or None if not found.

    Returned keys: chatId, notifyOnSubmit, notifyOnInterviewReply, notifyOnLinkedInIssue
    """
    row = await pool.fetchrow(
        """
        SELECT "chatId",
               "notifyOnSubmit",
               "notifyOnInterviewReply",
               "notifyOnLinkedInIssue"
        FROM   "TelegramChat"
        WHERE  "userId" = $1
        """,
        user_id,
    )
    if row is None:
        return None
    return dict(row)
