"""
common.py — Shared helpers for autoapply modules.

Provides:
  - clean_user_data()          : validate / normalise user_data dicts before submission
  - not_available_result()     : standard error dict when a dependency is missing
  - prepare_application()      : run AI tailoring before submit, return enriched user_data
                                 + tailoring metadata for DB persistence
  - publish_linkedin_issue()   : P18 — fire-and-forget Redis event for LinkedIn auth failures
"""
import json
from datetime import datetime, timezone
from typing import Any

import structlog

from worker.ai.tailor import should_tailor, tailor_cover_letter, tailor_resume
from worker.config import settings

logger = structlog.get_logger(__name__)


async def publish_linkedin_issue(user_id: str) -> None:  # P18: ONE LINE publish
    """Publish a linkedin_issue event so the Telegram notifier can alert the user."""
    try:
        import redis.asyncio as aioredis  # lazy import — only if Redis available
        redis_url = getattr(settings, "redis_url", "")
        if not redis_url:
            return
        async with aioredis.from_url(redis_url, decode_responses=True) as r:
            await r.publish("application_events", json.dumps({
                "type": "linkedin_issue",
                "userId": user_id,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }))
    except Exception as exc:  # never let Redis outage break the autoapply flow
        logger.warning("publish_linkedin_issue.failed", error=str(exc))


def not_available_result(reason: str, context: str = "") -> dict[str, Any]:
    """Return a standardised error dict when a required dependency is unavailable."""
    return {
        "success": False,
        "status": "error",
        "error": reason,
        "context": context,
    }


def clean_user_data(data: dict[str, Any]) -> dict[str, Any]:
    """
    Normalise and fill defaults for user_data passed to ATS fillers.

    Expected keys (all optional — defaults provided):
        first_name, last_name, email, phone, linkedin_url,
        resume_text, cover_letter, current_company,
        portfolio_url, location, experience_years
    """
    name = data.get("name", "")
    parts = name.strip().split() if name else []

    # Build a plus-addressed reply-to so recruiter replies land in the user's
    # job-email inbox (Prompt 22).  Falls back to the real email when no
    # inboxHandle is set (e.g. legacy users not yet migrated).
    # P22: use root domain (free Resend plan supports only one domain).
    # inbox.resumeai-bot.ru requires a paid second-domain slot; root domain
    # resumeai-bot.ru has no personal mailboxes so enabling Resend receiving
    # on it is safe.
    inbox_domain = "resumeai-bot.ru"
    handle = data.get("inbox_handle", "")
    app_id = data.get("application_id", "")
    reply_to = (f"{handle}+{app_id}@{inbox_domain}" if handle and app_id else (f"{handle}@{inbox_domain}" if handle else data.get("email", "")))  # noqa: E501

    return {
        "first_name": data.get("first_name") or (parts[0] if parts else ""),
        "last_name": data.get("last_name") or (" ".join(parts[1:]) if len(parts) > 1 else ""),
        "email": data.get("email", ""),
        "reply_to": reply_to,
        "phone": data.get("phone", ""),
        "linkedin_url": data.get("linkedin_url", ""),
        "resume_text": data.get("resume_text", ""),
        "cover_letter": data.get("cover_letter", ""),
        "current_company": data.get("current_company", ""),
        "portfolio_url": data.get("portfolio_url", ""),
        "location": data.get("location", ""),
        "experience_years": str(data.get("experience_years", "1")),
    }


async def prepare_application(
    base_resume: dict,
    job: dict,
    plan_tier: str = "free",
    application_count: int = 0,
    job_id: str = "",
    api_key: str = "",
) -> dict[str, Any]:
    """
    Run AI tailoring BEFORE submitting an application.

    Called by autoapply routes immediately before passing user_data to an
    ATS applicator (CareerOps, LinkedIn).  Returns an enriched dict with:

        tailored_resume (dict)       — resume JSON to submit (may equal base_resume)
        tailored_cover_letter (str)  — per-job cover letter (may be "")
        tokens_used (int)            — total tokens consumed across both calls
        model_used (str)             — model name for cost tracking
        tailoring_skipped (bool)     — True when plan_tier gates tailoring off

    Never raises — all failures fall back to base_resume / empty cover letter.

    Args:
        base_resume:       Resume.generated JSON dict from DB.
        job:               Dict with keys: title, company, description, id (optional).
        plan_tier:         "free" | "trial" | "pro" | "unlimited"
        application_count: 0-indexed position in current session (for trial gate).
        job_id:            Stable job identifier for cache keying.
        api_key:           OpenAI API key override; falls back to settings.
    """
    if not should_tailor(plan_tier, application_count):
        logger.info(
            "prepare_application.skipped",
            plan_tier=plan_tier,
            application_count=application_count,
        )
        return {
            "tailored_resume": base_resume,
            "tailored_cover_letter": "",
            "tokens_used": 0,
            "model_used": "",
            "tailoring_skipped": True,
        }

    key = api_key or settings.openai_api_key

    # Run both tailoring calls concurrently to halve wall-clock time
    import asyncio
    resume_coro = tailor_resume(base_resume, job, key, job_id)
    cover_coro = tailor_cover_letter(base_resume, job, key, job_id)
    (tailored_resume, resume_tokens, model), (cover_letter, cover_tokens, _) = (
        await asyncio.gather(resume_coro, cover_coro)
    )

    total_tokens = resume_tokens + cover_tokens
    logger.info(
        "prepare_application.done",
        job_id=job_id,
        plan_tier=plan_tier,
        total_tokens=total_tokens,
        model=model,
    )

    return {
        "tailored_resume": tailored_resume,
        "tailored_cover_letter": cover_letter,
        "tokens_used": total_tokens,
        "model_used": model,
        "tailoring_skipped": False,
    }
