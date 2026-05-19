"""
test_notifier.py — Integration tests for the notifier event handler.

Mocks: asyncpg pool, Redis, httpx client.
Verifies: correct message sent, toggle respected, rate-limit respected.
"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from unittest.mock import AsyncMock, MagicMock, patch
import pytest
import httpx
import respx

import main
import templates


def _mock_pool(chat: dict | None):
    pool = MagicMock()
    pool.fetchrow = AsyncMock(return_value=chat)
    return pool


def _mock_redis(allow: bool = True):
    redis = MagicMock()
    redis.incr = AsyncMock(return_value=1 if allow else 31)
    redis.expire = AsyncMock()
    redis.get = AsyncMock(return_value="1" if allow else "31")
    return redis


# ── handle_event ──────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_no_chat_skips_send():
    """If user has no TelegramChat, nothing is sent."""
    pool = _mock_pool(None)
    redis = _mock_redis()

    with respx.mock() as mock:
        await main.handle_event(
            {"type": "application_submitted", "userId": "u1", "jobTitle": "SWE", "company": "Acme"},
            pool, redis, httpx.AsyncClient()
        )
        assert len(mock.calls) == 0


@pytest.mark.asyncio
async def test_toggle_off_skips_send():
    """If notifyOnSubmit is False, message is suppressed."""
    pool = _mock_pool({
        "chatId": "123",
        "notifyOnSubmit": False,
        "notifyOnInterviewReply": True,
        "notifyOnLinkedInIssue": True,
    })
    redis = _mock_redis()

    with respx.mock() as mock:
        await main.handle_event(
            {"type": "application_submitted", "userId": "u1", "jobTitle": "SWE", "company": "Co"},
            pool, redis, httpx.AsyncClient()
        )
        assert len(mock.calls) == 0


@pytest.mark.asyncio
async def test_rate_limited_skips_send():
    """If rate limit exceeded, message is suppressed."""
    pool = _mock_pool({
        "chatId": "123",
        "notifyOnSubmit": True,
        "notifyOnInterviewReply": True,
        "notifyOnLinkedInIssue": True,
    })
    redis = _mock_redis(allow=False)

    with respx.mock() as mock:
        await main.handle_event(
            {"type": "application_submitted", "userId": "u1", "jobTitle": "SWE", "company": "Co"},
            pool, redis, httpx.AsyncClient()
        )
        assert len(mock.calls) == 0


@pytest.mark.asyncio
async def test_submitted_event_sends_correct_text():
    """A valid submitted event calls Telegram sendMessage with correct content."""
    pool = _mock_pool({
        "chatId": "9999",
        "notifyOnSubmit": True,
        "notifyOnInterviewReply": True,
        "notifyOnLinkedInIssue": True,
    })
    redis = _mock_redis()

    with respx.mock() as mock:
        mock.post("https://api.telegram.org/bot1234567890:AAtest_token_for_testing_only_stub/sendMessage").mock(
            return_value=httpx.Response(200, json={"ok": True, "result": {}})
        )
        async with httpx.AsyncClient() as http:
            await main.handle_event(
                {
                    "type": "application_submitted",
                    "userId": "u1",
                    "jobTitle": "Backend Engineer",
                    "company": "Stripe",
                    "applicationId": "app123",
                },
                pool, redis, http,
            )
        assert len(mock.calls) == 1
        body = mock.calls[0].request.content
        import json
        payload = json.loads(body)
        assert payload["chat_id"] == "9999"
        assert "Backend Engineer" in payload["text"]
        assert "Stripe" in payload["text"]


@pytest.mark.asyncio
async def test_interview_reply_event_sends():
    """An interview_reply event calls sendMessage with recruiter info."""
    pool = _mock_pool({
        "chatId": "8888",
        "notifyOnSubmit": True,
        "notifyOnInterviewReply": True,
        "notifyOnLinkedInIssue": True,
    })
    redis = _mock_redis()

    with respx.mock() as mock:
        mock.post("https://api.telegram.org/bot1234567890:AAtest_token_for_testing_only_stub/sendMessage").mock(
            return_value=httpx.Response(200, json={"ok": True, "result": {}})
        )
        async with httpx.AsyncClient() as http:
            await main.handle_event(
                {"type": "interview_reply", "userId": "u2", "company": "Anthropic"},
                pool, redis, http,
            )
        assert len(mock.calls) == 1
        import json
        payload = json.loads(mock.calls[0].request.content)
        assert "Anthropic" in payload["text"]


@pytest.mark.asyncio
async def test_linkedin_issue_event_sends():
    """A linkedin_issue event sends the re-auth notification."""
    pool = _mock_pool({
        "chatId": "7777",
        "notifyOnSubmit": True,
        "notifyOnInterviewReply": True,
        "notifyOnLinkedInIssue": True,
    })
    redis = _mock_redis()

    with respx.mock() as mock:
        mock.post("https://api.telegram.org/bot1234567890:AAtest_token_for_testing_only_stub/sendMessage").mock(
            return_value=httpx.Response(200, json={"ok": True, "result": {}})
        )
        async with httpx.AsyncClient() as http:
            await main.handle_event(
                {"type": "linkedin_issue", "userId": "u3"},
                pool, redis, http,
            )
        assert len(mock.calls) == 1
        import json
        payload = json.loads(mock.calls[0].request.content)
        assert "⚠️" in payload["text"]
