"""
resume.py — AI-powered tailored resume generation.

Uses OpenAI chat completions via httpx (not aiohttp).
System prompt is loaded from prompts/resume.txt at import time.

Ported from: scrapers/resume_generator.py
Changes vs source:
  - Replaced aiohttp with httpx.AsyncClient
  - Replaced logging with structlog
  - Removed language="ru" default — worker is English-only
  - System prompt loaded from external file (prompts/resume.txt)
  - Removed PDF generation (kept in legacy scrapers/resume_pdf_generator.py)
"""
import asyncio
from pathlib import Path

import httpx
import structlog

from worker.config import settings

logger = structlog.get_logger(__name__)

_OPENAI_URL = "https://api.openai.com/v1/chat/completions"

# Load system prompt once at import time
_PROMPTS_DIR = Path(__file__).parent / "prompts"
_RESUME_SYSTEM_PROMPT: str = (_PROMPTS_DIR / "resume.txt").read_text(encoding="utf-8").strip()


async def _call_openai(
    prompt: str,
    system: str,
    api_key: str,
    model: str | None = None,
    max_tokens: int = 1500,
) -> str:
    """
    POST to OpenAI chat/completions.
    Returns the assistant message content.
    Raises ValueError on auth errors, RuntimeError on other failures.
    """
    if not api_key:
        raise ValueError("call_openai: api_key is empty")

    payload = {
        "model": model or settings.openai_model,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": prompt},
        ],
        "max_tokens": max_tokens,
        "temperature": 0.7,
    }

    try:
        async with httpx.AsyncClient(timeout=60) as client:
            r = await client.post(
                _OPENAI_URL,
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                json=payload,
            )

        if r.status_code == 200:
            data = r.json()
            content: str = (
                data.get("choices", [{}])[0]
                .get("message", {})
                .get("content", "")
                .strip()
            )
            logger.debug("openai.call_success", response_len=len(content))
            return content

        if r.status_code == 401:
            raise ValueError(f"OpenAI invalid API key (401): {r.text[:200]}")

        if r.status_code == 429:
            raise RuntimeError(f"OpenAI rate limited (429): {r.text[:200]}")

        if r.status_code == 400:
            raise ValueError(f"OpenAI bad request (400): {r.text[:300]}")

        raise RuntimeError(f"OpenAI HTTP {r.status_code}: {r.text[:300]}")

    except (ValueError, RuntimeError):
        raise
    except httpx.TimeoutException:
        raise RuntimeError("call_openai timed out after 60 seconds")
    except httpx.HTTPError as exc:
        raise RuntimeError(f"call_openai network error: {exc}")


async def generate_tailored_resume(
    user_profile: str,
    vacancy_description: str,
    vacancy_title: str,
    company_name: str,
    api_key: str,
    language: str = "en",
) -> str:
    """
    Generate a tailored resume using the OpenAI API.

    Args:
        user_profile:        Candidate background / existing resume text.
        vacancy_description: Full job description text.
        vacancy_title:       Job title (e.g. "Senior Python Engineer").
        company_name:        Hiring company name.
        api_key:             OpenAI API key.
        language:            Output language hint — "en" (default) or any BCP-47 tag.

    Returns:
        Resume as plain text (800-1200 words).

    Raises:
        RuntimeError on API failure or timeout.
    """
    lang_instruction = (
        "Write in English." if language.lower().startswith("en") else f"Write in {language}."
    )

    prompt = (
        f"Create a tailored professional resume for the following job posting.\n\n"
        f"JOB TITLE: {vacancy_title}\n"
        f"COMPANY: {company_name}\n\n"
        f"JOB DESCRIPTION:\n{vacancy_description[:3000]}\n\n"
        f"CANDIDATE PROFILE:\n{user_profile[:2000]}\n\n"
        f"Requirements:\n"
        f"- Length: 800-1200 words\n"
        f"- Include sections: Summary/Objective, Experience, Skills, Education\n"
        f"- Use keywords from the job description for ATS optimization\n"
        f"- Highlight the most relevant experience and skills for this specific role\n"
        f"- Professional tone and format\n"
        f"- Plain text only, no markdown symbols like ** or #\n"
        f"- {lang_instruction}\n\n"
        f"Write the complete resume now:"
    )

    logger.info(
        "resume.generate.started",
        vacancy_title=vacancy_title,
        company=company_name,
    )

    try:
        result = await asyncio.wait_for(
            _call_openai(
                prompt=prompt,
                system=_RESUME_SYSTEM_PROMPT,
                api_key=api_key,
                max_tokens=1800,
            ),
            timeout=45,
        )
        logger.info("resume.generate.complete", result_len=len(result))
        return result
    except asyncio.TimeoutError:
        raise RuntimeError("generate_tailored_resume timed out after 45 seconds")
