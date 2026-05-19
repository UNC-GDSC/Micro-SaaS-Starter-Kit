"""
cover_letter.py — AI-powered cover letter generation.

Uses OpenAI chat completions via httpx.
System prompt is loaded from prompts/cover_letter.txt at import time.

Ported from:
  - autoapply/english_job_engine.py (generate_cover_letter function)
  - scrapers/resume_generator.py   (generate_cover_letter function)
Changes vs source:
  - Replaced logging with structlog
  - System prompt loaded from external file (prompts/cover_letter.txt)
  - Unified interface: takes explicit job_title + company + job_description args
"""
import asyncio
from pathlib import Path

import structlog

from worker.ai.resume import _call_openai
from worker.config import settings

logger = structlog.get_logger(__name__)

# Load system prompt once at import time
_PROMPTS_DIR = Path(__file__).parent / "prompts"
_COVER_LETTER_SYSTEM_PROMPT: str = (
    (_PROMPTS_DIR / "cover_letter.txt").read_text(encoding="utf-8").strip()
)


async def generate_cover_letter(
    resume_text: str,
    job_title: str,
    company: str,
    job_description: str,
    api_key: str,
    language: str = "en",
) -> str:
    """
    Generate a professional cover letter tailored to a specific job posting.

    Args:
        resume_text:     Candidate's resume or background summary.
        job_title:       Target job title.
        company:         Hiring company name.
        job_description: Full job description text.
        api_key:         OpenAI API key.
        language:        Output language hint — "en" (default) or any BCP-47 tag.

    Returns:
        Cover letter as plain text (200-300 words).

    Raises:
        RuntimeError on API failure or timeout.
    """
    lang_instruction = (
        "Write in English." if language.lower().startswith("en") else f"Write in {language}."
    )

    prompt = (
        f"Write a concise professional cover letter for this job application.\n\n"
        f"JOB TITLE: {job_title}\n"
        f"COMPANY: {company}\n\n"
        f"JOB DESCRIPTION:\n{job_description[:2000]}\n\n"
        f"CANDIDATE RESUME/PROFILE:\n{resume_text[:1500]}\n\n"
        f"Requirements:\n"
        f"- Length: 200-300 words (keep it concise)\n"
        f"- Opening: Express interest and mention the specific role\n"
        f"- Body: Highlight 2-3 most relevant skills/experiences that match the job\n"
        f"- Closing: Call to action, express eagerness for an interview\n"
        f"- Professional but personable tone\n"
        f"- Plain text only, no markdown\n"
        f"- {lang_instruction}\n\n"
        f"Write the cover letter now:"
    )

    logger.info("cover_letter.generate.started", job_title=job_title, company=company)

    try:
        result = await asyncio.wait_for(
            _call_openai(
                prompt=prompt,
                system=_COVER_LETTER_SYSTEM_PROMPT,
                api_key=api_key or settings.openai_api_key,
                max_tokens=600,
            ),
            timeout=45,
        )
        logger.info("cover_letter.generate.complete", result_len=len(result))
        return result
    except asyncio.TimeoutError:
        raise RuntimeError("generate_cover_letter timed out after 45 seconds")
