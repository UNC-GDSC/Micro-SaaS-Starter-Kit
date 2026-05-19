"""
jobs.py — All job-related API routes.

All endpoints require Authorization: Bearer <WORKER_SECRET>.

Job lifecycle (MVP — in-memory, synchronous async processing):
  POST  /jobs/...          creates job, runs work, returns {job_id, status, result}
  GET   /jobs/{job_id}     returns stored job status + result

In-memory storage resets on worker restart.  A persistent job queue
(e.g. Redis + ARQ or Celery) can replace this without changing the public API.
"""
import uuid
from datetime import datetime, timezone
from typing import Any
from typing import Literal

import structlog
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from worker.ai.cover_letter import generate_cover_letter
from worker.ai.resume import generate_tailored_resume
from worker.autoapply.careerops import CareerOpsApplicator
from worker.autoapply.common import prepare_application
from worker.autoapply.linkedin import LinkedInApplicator
from worker.config import settings
from worker.deps import verify_bearer
from worker.scrapers import adzuna, arbeitnow, remoteok, themuse

logger = structlog.get_logger(__name__)
router = APIRouter()

# ── In-memory job store (MVP) ─────────────────────────────────────────────────

JobStatusLiteral = Literal["pending", "running", "done", "error"]


class JobRecord(BaseModel):
    job_id: str
    status: JobStatusLiteral
    result: Any = None
    error: str | None = None
    created_at: datetime
    completed_at: datetime | None = None


_jobs: dict[str, JobRecord] = {}


def _new_job() -> JobRecord:
    job = JobRecord(
        job_id=str(uuid.uuid4()),
        status="running",
        created_at=datetime.now(timezone.utc),
    )
    _jobs[job.job_id] = job
    return job


def _finish(job: JobRecord, result: Any) -> JobRecord:
    job.status = "done"
    job.result = result
    job.completed_at = datetime.now(timezone.utc)
    return job


def _fail(job: JobRecord, error: str) -> JobRecord:
    job.status = "error"
    job.error = error
    job.completed_at = datetime.now(timezone.utc)
    return job


# ── Request bodies ────────────────────────────────────────────────────────────

class ResumeGenerateRequest(BaseModel):
    user_id: int
    resume_input: str
    job_title: str
    company: str
    job_description: str


class CoverLetterRequest(BaseModel):
    user_id: int
    resume_text: str
    job_title: str
    company: str
    job_description: str


class LinkedInApplyRequest(BaseModel):
    user_id: int
    campaign_id: int
    email: str
    password_encrypted: str
    job_title: str
    location: str


class CareerOpsApplyRequest(BaseModel):
    user_id: int
    campaign_id: int
    apply_url: str
    user_data: dict


class ScrapeRequest(BaseModel):
    keywords: str
    location: str = ""
    since: str | None = None  # reserved for future filtering


class TailorRequest(BaseModel):
    """
    Request body for POST /jobs/autoapply/prepare.

    The web app calls this BEFORE submitting an application to get the
    tailored resume + cover letter. It then saves both to JobApplication
    and passes the tailored text to the ATS applicator.
    """
    base_resume: dict           # Resume.generated JSON from DB
    job: dict                   # {title, company, description, id?}
    plan_tier: str = "free"     # "free" | "trial" | "pro" | "unlimited"
    application_count: int = 0  # 0-indexed count in session (for trial gate)
    job_id: str = ""            # stable job identifier for cache key


# ── Routes ────────────────────────────────────────────────────────────────────

@router.post("/resume/generate", dependencies=[Depends(verify_bearer)])
async def resume_generate(body: ResumeGenerateRequest) -> dict:
    """Generate a tailored resume using OpenAI."""
    job = _new_job()
    logger.info("job.resume_generate.started", job_id=job.job_id, user_id=body.user_id)
    try:
        text = await generate_tailored_resume(
            user_profile=body.resume_input,
            vacancy_description=body.job_description,
            vacancy_title=body.job_title,
            company_name=body.company,
            api_key=settings.openai_api_key,
        )
        _finish(job, {"resume_text": text})
        logger.info("job.resume_generate.done", job_id=job.job_id)
    except Exception as exc:
        _fail(job, str(exc))
        logger.error("job.resume_generate.error", job_id=job.job_id, error=str(exc))

    return job.model_dump()


@router.post("/cover-letter", dependencies=[Depends(verify_bearer)])
async def cover_letter(body: CoverLetterRequest) -> dict:
    """Generate a tailored cover letter using OpenAI."""
    job = _new_job()
    logger.info("job.cover_letter.started", job_id=job.job_id, user_id=body.user_id)
    try:
        text = await generate_cover_letter(
            resume_text=body.resume_text,
            job_title=body.job_title,
            company=body.company,
            job_description=body.job_description,
            api_key=settings.openai_api_key,
        )
        _finish(job, {"cover_letter_text": text})
        logger.info("job.cover_letter.done", job_id=job.job_id)
    except Exception as exc:
        _fail(job, str(exc))
        logger.error("job.cover_letter.error", job_id=job.job_id, error=str(exc))

    return job.model_dump()


@router.post("/autoapply/prepare", dependencies=[Depends(verify_bearer)])
async def autoapply_prepare(body: TailorRequest) -> dict:
    """
    Tailor a resume + generate a cover letter for a specific job.

    Called by the web app before each autoapply submission.  Returns:
      tailored_resume (dict), tailored_cover_letter (str),
      tokens_used (int), model_used (str), tailoring_skipped (bool).

    Cost guardrail: gpt-4o-mini only; plan_tier gates Free/Trial users.
    """
    job = _new_job()
    logger.info(
        "job.autoapply_prepare.started",
        job_id=job.job_id,
        plan_tier=body.plan_tier,
        company=body.job.get("company"),
    )
    try:
        result = await prepare_application(
            base_resume=body.base_resume,
            job=body.job,
            plan_tier=body.plan_tier,
            application_count=body.application_count,
            job_id=body.job_id,
        )
        _finish(job, result)
        logger.info(
            "job.autoapply_prepare.done",
            job_id=job.job_id,
            tokens=result.get("tokens_used", 0),
            skipped=result.get("tailoring_skipped", False),
        )
    except Exception as exc:
        _fail(job, str(exc))
        logger.error("job.autoapply_prepare.error", job_id=job.job_id, error=str(exc))

    return job.model_dump()


@router.post("/autoapply/linkedin", dependencies=[Depends(verify_bearer)])
async def autoapply_linkedin(body: LinkedInApplyRequest) -> dict:
    """Run a LinkedIn Easy Apply campaign session."""
    from worker.crypto import decrypt

    job = _new_job()
    logger.info(
        "job.linkedin.started",
        job_id=job.job_id,
        user_id=body.user_id,
        campaign_id=body.campaign_id,
    )
    try:
        password = decrypt(body.password_encrypted)
        applicator = LinkedInApplicator()
        result = await applicator.apply(
            email=body.email,
            password=password,
            job_title=body.job_title,
            location=body.location,
        )
        _finish(job, result)
        logger.info("job.linkedin.done", job_id=job.job_id)
    except Exception as exc:
        _fail(job, str(exc))
        logger.error("job.linkedin.error", job_id=job.job_id, error=str(exc))

    return job.model_dump()


@router.post("/autoapply/careerops", dependencies=[Depends(verify_bearer)])
async def autoapply_careerops(body: CareerOpsApplyRequest) -> dict:
    """Submit a job application via the CareerOps ATS filler."""
    job = _new_job()
    logger.info(
        "job.careerops.started",
        job_id=job.job_id,
        user_id=body.user_id,
        campaign_id=body.campaign_id,
    )
    try:
        applicator = CareerOpsApplicator()
        await applicator.start()
        try:
            result = await applicator.apply(body.apply_url, body.user_data)
        finally:
            await applicator.close()
        _finish(job, result)
        logger.info("job.careerops.done", job_id=job.job_id)
    except Exception as exc:
        _fail(job, str(exc))
        logger.error("job.careerops.error", job_id=job.job_id, error=str(exc))

    return job.model_dump()


_SCRAPER_MAP = {
    "adzuna": adzuna.search,
    "arbeitnow": arbeitnow.search,
    "remoteok": remoteok.search,
    "themuse": themuse.search,
}


@router.post("/scrape/{board}", dependencies=[Depends(verify_bearer)])
async def scrape_board(board: str, body: ScrapeRequest) -> dict:
    """Scrape a specific job board and return normalized job listings."""
    if board not in _SCRAPER_MAP:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Unknown board '{board}'. Valid: {list(_SCRAPER_MAP)}",
        )
    job = _new_job()
    logger.info("job.scrape.started", job_id=job.job_id, board=board, keywords=body.keywords)
    try:
        results = await _SCRAPER_MAP[board](
            query=body.keywords,
            location=body.location,
        )
        _finish(job, {"jobs": results, "count": len(results)})
        logger.info("job.scrape.done", job_id=job.job_id, count=len(results))
    except Exception as exc:
        _fail(job, str(exc))
        logger.error("job.scrape.error", job_id=job.job_id, error=str(exc))

    return job.model_dump()


@router.get("/{job_id}", dependencies=[Depends(verify_bearer)])
async def get_job(job_id: str) -> dict:
    """Return the current status and result of a previously submitted job."""
    record = _jobs.get(job_id)
    if record is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Job {job_id!r} not found",
        )
    return record.model_dump()
