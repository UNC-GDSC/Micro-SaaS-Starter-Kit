"""
test_tailor.py — Unit tests for worker/ai/tailor.py and common.prepare_application.

Tests run without a real OpenAI key by mocking _call_openai.
"""
import asyncio
import json
from unittest.mock import AsyncMock, patch

import pytest

from worker.ai.tailor import (
    TAILOR_MODEL,
    should_tailor,
    tailor_cover_letter,
    tailor_resume,
)
from worker.autoapply.common import prepare_application

# ── Fixtures ──────────────────────────────────────────────────────────────────

BASE_RESUME = {
    "summary": "Backend engineer with 5 years in Python and distributed systems.",
    "experience": [
        {
            "company": "Acme Corp",
            "title": "Senior Engineer",
            "years": "2021-2024",
            "bullets": [
                "Reduced API latency by 40%",
                "Led migration to Kubernetes",
                "Built internal CI/CD pipeline",
            ],
        }
    ],
    "skills": ["Python", "Kubernetes", "PostgreSQL", "FastAPI"],
    "education": [{"degree": "BSc Computer Science", "school": "MIT", "year": "2019"}],
}

JOB = {
    "id": "job-001",
    "title": "Staff Backend Engineer",
    "company": "Stripe",
    "description": (
        "We are looking for a Staff Backend Engineer with deep expertise in Python, "
        "distributed systems, and payment processing APIs. You will lead architecture "
        "decisions and mentor a team of 5 engineers."
    ),
}


# ── should_tailor ─────────────────────────────────────────────────────────────

class TestShouldTailor:
    def test_free_never(self):
        assert should_tailor("free", 0) is False
        assert should_tailor("free", 99) is False

    def test_trial_every_third(self):
        assert should_tailor("trial", 0) is True    # 0 % 3 == 0
        assert should_tailor("trial", 1) is False
        assert should_tailor("trial", 2) is False
        assert should_tailor("trial", 3) is True    # 3 % 3 == 0
        assert should_tailor("trial", 6) is True

    def test_pro_always(self):
        assert should_tailor("pro", 0) is True
        assert should_tailor("pro", 100) is True

    def test_unlimited_always(self):
        assert should_tailor("unlimited", 0) is True

    def test_case_insensitive(self):
        assert should_tailor("FREE", 0) is False
        assert should_tailor("PRO", 0) is True


# ── tailor_resume ─────────────────────────────────────────────────────────────

class TestTailorResume:
    @pytest.mark.asyncio
    async def test_returns_valid_dict(self):
        tailored_json = json.dumps({**BASE_RESUME, "summary": "Tailored summary for Stripe."})
        with patch("worker.ai.tailor._call_openai", new_callable=AsyncMock) as mock_ai:
            mock_ai.return_value = tailored_json
            result, tokens, model = await tailor_resume(BASE_RESUME, JOB, "sk-test", "job-001")

        assert isinstance(result, dict)
        assert result["summary"] == "Tailored summary for Stripe."
        assert model == TAILOR_MODEL
        assert tokens > 0

    @pytest.mark.asyncio
    async def test_strips_markdown_fences(self):
        tailored = {**BASE_RESUME, "summary": "Clean output."}
        fenced = f"```json\n{json.dumps(tailored)}\n```"
        with patch("worker.ai.tailor._call_openai", new_callable=AsyncMock) as mock_ai:
            mock_ai.return_value = fenced
            result, _, _ = await tailor_resume(BASE_RESUME, JOB, "sk-test", "job-002")

        assert result["summary"] == "Clean output."

    @pytest.mark.asyncio
    async def test_falls_back_on_invalid_json(self):
        with patch("worker.ai.tailor._call_openai", new_callable=AsyncMock) as mock_ai:
            mock_ai.return_value = "not valid json {{{"
            result, tokens, model = await tailor_resume(BASE_RESUME, JOB, "sk-test", "job-003")

        # Non-destructive fallback: returns original resume unchanged
        assert result == BASE_RESUME
        assert tokens == 0
        assert model == TAILOR_MODEL

    @pytest.mark.asyncio
    async def test_falls_back_on_api_error(self):
        with patch("worker.ai.tailor._call_openai", new_callable=AsyncMock) as mock_ai:
            mock_ai.side_effect = RuntimeError("API unavailable")
            result, tokens, _ = await tailor_resume(BASE_RESUME, JOB, "sk-test", "job-004")

        assert result == BASE_RESUME
        assert tokens == 0

    @pytest.mark.asyncio
    async def test_cache_deduplication(self):
        """Second call with same (resume, job_id) should not hit OpenAI."""
        tailored = json.dumps({**BASE_RESUME, "summary": "Cached."})
        with patch("worker.ai.tailor._call_openai", new_callable=AsyncMock) as mock_ai:
            mock_ai.return_value = tailored
            await tailor_resume(BASE_RESUME, JOB, "sk-test", "job-cache-1")
            await tailor_resume(BASE_RESUME, JOB, "sk-test", "job-cache-1")
            assert mock_ai.call_count == 1  # second call served from cache


# ── tailor_cover_letter ────────────────────────────────────────────────────────

class TestTailorCoverLetter:
    @pytest.mark.asyncio
    async def test_returns_string_in_range(self):
        letter = " ".join(["word"] * 250)  # 250 words
        with patch("worker.ai.tailor._call_openai", new_callable=AsyncMock) as mock_ai:
            mock_ai.return_value = letter
            text, tokens, model = await tailor_cover_letter(BASE_RESUME, JOB, "sk-test", "job-cl-1")

        assert isinstance(text, str)
        assert len(text) > 0
        assert model == TAILOR_MODEL
        assert tokens > 0

    @pytest.mark.asyncio
    async def test_falls_back_on_error(self):
        with patch("worker.ai.tailor._call_openai", new_callable=AsyncMock) as mock_ai:
            mock_ai.side_effect = RuntimeError("timeout")
            text, tokens, _ = await tailor_cover_letter(BASE_RESUME, JOB, "sk-test", "job-cl-err")

        assert text == ""
        assert tokens == 0


# ── prepare_application ────────────────────────────────────────────────────────

class TestPrepareApplication:
    @pytest.mark.asyncio
    async def test_skipped_for_free_tier(self):
        result = await prepare_application(
            base_resume=BASE_RESUME,
            job=JOB,
            plan_tier="free",
            application_count=0,
        )
        assert result["tailoring_skipped"] is True
        assert result["tailored_resume"] == BASE_RESUME
        assert result["tailored_cover_letter"] == ""
        assert result["tokens_used"] == 0

    @pytest.mark.asyncio
    async def test_runs_for_pro_tier(self):
        tailored_resume = json.dumps({**BASE_RESUME, "summary": "Pro tailored."})
        cover = " ".join(["word"] * 240)
        with patch("worker.ai.tailor._call_openai", new_callable=AsyncMock) as mock_ai:
            mock_ai.side_effect = [tailored_resume, cover]
            result = await prepare_application(
                base_resume=BASE_RESUME,
                job=JOB,
                plan_tier="pro",
                application_count=0,
                job_id="job-prep-1",
            )

        assert result["tailoring_skipped"] is False
        assert isinstance(result["tailored_resume"], dict)
        assert result["tailored_resume"]["summary"] == "Pro tailored."
        assert isinstance(result["tailored_cover_letter"], str)
        assert len(result["tailored_cover_letter"]) > 0
        assert result["tokens_used"] > 0
        assert result["model_used"] == TAILOR_MODEL

    @pytest.mark.asyncio
    async def test_skipped_for_trial_non_third(self):
        result = await prepare_application(
            base_resume=BASE_RESUME,
            job=JOB,
            plan_tier="trial",
            application_count=1,  # not a multiple of 3
        )
        assert result["tailoring_skipped"] is True
