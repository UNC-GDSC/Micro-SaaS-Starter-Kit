"""
main.py — ResumeAI Telegram notification service.

Subscribes to Redis pub/sub channel `application_events` and sends
Telegram messages to users who have connected their chat.

Event types handled:
  application_submitted  → ✉️ Applied to <role> at <company>
  interview_reply        → 📬 Recruiter reply at <company>
  linkedin_issue         → ⚠️ LinkedIn needs re-auth

Rate limit: 30 msgs / user / hour (per-chat Redis counter).
"""
import asyncio
import json
import signal
import sys

import httpx
import redis.asyncio as aioredis
import structlog

import templates
from config import settings
from database import get_pool, get_telegram_chat
from rate_limiter import is_allowed

log = structlog.get_logger(__name__)

CHANNEL = "application_events"
TG_API = f"https://api.telegram.org/bot{settings.telegram_bot_token}"

# ── Telegram sender ────────────────────────────────────────────────────────────

async def send_message(client: httpx.AsyncClient, chat_id: str, text: str, url: str | None = None) -> bool:
    """Send a Telegram message. Returns True on success."""
    payload: dict = {
        "chat_id": chat_id,
        "text": text,
        "parse_mode": "HTML",
        "disable_web_page_preview": True,
    }
    if url:
        payload["reply_markup"] = {
            "inline_keyboard": [[{"text": "Open Dashboard", "url": url}]]
        }
    try:
        resp = await client.post(f"{TG_API}/sendMessage", json=payload, timeout=10)
        if not resp.is_success:
            data = resp.json()
            # 403 = bot blocked by user — clean up gracefully downstream
            log.warning("tg.send_failed", chat_id=chat_id, status=resp.status_code,
                        description=data.get("description"))
            return False
        return True
    except httpx.HTTPError as exc:
        log.error("tg.send_error", chat_id=chat_id, error=str(exc))
        return False


# ── Event handler ─────────────────────────────────────────────────────────────

TOGGLE_MAP = {
    "application_submitted": "notifyOnSubmit",
    "interview_reply":       "notifyOnInterviewReply",
    "linkedin_issue":        "notifyOnLinkedInIssue",
}

async def handle_event(
    event: dict,
    pool,
    redis: aioredis.Redis,
    http: httpx.AsyncClient,
) -> None:
    event_type = event.get("type")
    user_id = event.get("userId")

    if not event_type or not user_id:
        log.warning("event.invalid", event=event)
        return

    toggle_key = TOGGLE_MAP.get(event_type)
    if not toggle_key:
        log.debug("event.unknown_type", event_type=event_type)
        return

    # Look up chat
    chat = await get_telegram_chat(pool, user_id)
    if not chat:
        log.debug("event.no_chat", user_id=user_id)
        return

    if not chat.get(toggle_key, True):
        log.debug("event.toggled_off", event_type=event_type, user_id=user_id)
        return

    # Rate limit
    chat_id = chat["chatId"]
    if not await is_allowed(redis, chat_id, limit=settings.rate_limit_per_hour):
        log.info("event.rate_limited", chat_id=chat_id, event_type=event_type)
        return

    # Build message
    app_id = event.get("applicationId")
    if event_type == "application_submitted":
        msg = templates.submitted(
            job_title=event.get("jobTitle", "a position"),
            company=event.get("company", "a company"),
            application_id=app_id,
        )
    elif event_type == "interview_reply":
        msg = templates.interview_reply(
            company=event.get("company", "a recruiter"),
            application_id=app_id,
        )
    else:  # linkedin_issue
        msg = templates.linkedin_issue()

    ok = await send_message(http, chat_id, msg["text"], msg.get("url"))
    log.info(
        "event.sent" if ok else "event.send_failed",
        event_type=event_type,
        chat_id=chat_id,
        user_id=user_id,
    )


# ── Main loop ─────────────────────────────────────────────────────────────────

async def run() -> None:
    log.info("notifier.starting", channel=CHANNEL)

    pool = await get_pool()
    redis = aioredis.from_url(settings.redis_url, decode_responses=True)
    pubsub = redis.pubsub()
    await pubsub.subscribe(CHANNEL)

    async with httpx.AsyncClient() as http:
        log.info("notifier.ready", channel=CHANNEL)
        async for message in pubsub.listen():
            if message["type"] != "message":
                continue
            try:
                event = json.loads(message["data"])
            except json.JSONDecodeError as exc:
                log.warning("event.json_decode_error", error=str(exc))
                continue

            try:
                await handle_event(event, pool, redis, http)
            except Exception as exc:
                log.error("event.handler_error", error=str(exc), event=event)


def main() -> None:
    # Graceful shutdown on SIGTERM/SIGINT
    loop = asyncio.new_event_loop()

    def _shutdown(sig):
        log.info("notifier.shutdown", signal=sig.name)
        loop.stop()

    for sig in (signal.SIGTERM, signal.SIGINT):
        loop.add_signal_handler(sig, _shutdown, sig)

    try:
        loop.run_until_complete(run())
    finally:
        loop.close()
        log.info("notifier.stopped")


if __name__ == "__main__":
    main()
