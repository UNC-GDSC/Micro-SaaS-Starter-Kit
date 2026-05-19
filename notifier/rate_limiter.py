"""
rate_limiter.py — Per-user Telegram notification rate limiter.

Uses Redis with a sliding 1-hour counter keyed by chat_id.
Default: 30 messages/user/hour.  Excess events are silently dropped.
"""
import redis.asyncio as aioredis

KEY_PREFIX = "rl:tg:"
WINDOW_S = 3600  # 1 hour


async def is_allowed(redis: aioredis.Redis, chat_id: str, limit: int = 30) -> bool:
    """
    Increment the counter for this chat_id and return True if the message
    may be sent.  The counter resets after WINDOW_S seconds.
    """
    key = f"{KEY_PREFIX}{chat_id}"
    count = await redis.incr(key)
    if count == 1:
        # First message in this window — set TTL
        await redis.expire(key, WINDOW_S)
    return count <= limit


async def remaining(redis: aioredis.Redis, chat_id: str) -> int:
    """Return how many more messages this chat_id can receive in the current window."""
    key = f"{KEY_PREFIX}{chat_id}"
    count = await redis.get(key)
    return max(0, 30 - int(count or 0))
