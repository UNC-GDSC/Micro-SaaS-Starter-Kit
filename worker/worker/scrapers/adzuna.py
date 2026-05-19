"""
adzuna.py — Adzuna job board scraper.

API docs: https://developer.adzuna.com/activedocs
Requires ADZUNA_APP_ID and ADZUNA_APP_KEY env vars.

Returns normalized job dicts with keys:
    id, title, company, location, salary, url, apply_url,
    description, source, apply_email, tags
"""
import re

import httpx
import structlog

from worker.config import settings

logger = structlog.get_logger(__name__)

_HEADERS = {"User-Agent": "ResumeAI-Worker/1.0 (support@example.com)"}


def _clean_html(text: str) -> str:
    text = re.sub(r"<[^>]+>", " ", text)
    return re.sub(r"\s+", " ", text).strip()[:2000]


def _normalize(data: dict) -> dict:
    return {
        "id": str(data.get("id", "")),
        "title": data.get("title", ""),
        "company": data.get("company", ""),
        "location": data.get("location", "Remote"),
        "salary": data.get("salary", ""),
        "url": data.get("url", ""),
        "apply_url": data.get("apply_url") or data.get("url", ""),
        "description": _clean_html(data.get("description", "")),
        "source": data.get("source", "unknown"),
        "apply_email": data.get("apply_email"),
        "tags": data.get("tags", []),
    }


async def search(
    query: str,
    location: str = "",
    country: str = "us",
    limit: int = 50,
) -> list[dict]:
    """
    Search Adzuna for jobs.
    Returns an empty list (and logs a debug message) if API credentials are missing.
    """
    if not settings.adzuna_app_id or not settings.adzuna_app_key:
        logger.debug("adzuna.skipped", reason="ADZUNA_APP_ID or ADZUNA_APP_KEY not set")
        return []

    params: dict = {
        "app_id": settings.adzuna_app_id,
        "app_key": settings.adzuna_app_key,
        "what": query,
        "results_per_page": min(limit, 50),
        "content-type": "application/json",
    }
    if location:
        params["where"] = location

    try:
        async with httpx.AsyncClient(timeout=12, headers=_HEADERS) as client:
            r = await client.get(
                f"https://api.adzuna.com/v1/api/jobs/{country}/search/1",
                params=params,
            )
            if r.status_code != 200:
                logger.warning(
                    "adzuna.http_error",
                    status=r.status_code,
                    body=r.text[:200],
                )
                return []
            data = r.json()
    except Exception as exc:
        logger.warning("adzuna.request_failed", error=str(exc))
        return []

    jobs: list[dict] = []
    for item in data.get("results", []):
        loc = item.get("location", {}).get("display_name", location or "US")
        sal_min = item.get("salary_min")
        sal_max = item.get("salary_max")
        salary = f"${int(sal_min):,}–${int(sal_max):,}/yr" if sal_min and sal_max else ""
        jobs.append(
            _normalize(
                {
                    "id": f"adzuna_{item.get('id', '')}",
                    "title": item.get("title", ""),
                    "company": item.get("company", {}).get("display_name", ""),
                    "location": loc,
                    "salary": salary,
                    "url": item.get("redirect_url", ""),
                    "apply_url": item.get("redirect_url", ""),
                    "description": _clean_html(item.get("description", "")),
                    "source": "adzuna",
                }
            )
        )

    logger.info("adzuna.search_complete", count=len(jobs), query=query, country=country)
    return jobs
