"""
arbeitnow.py — Arbeitnow job board scraper.

Open API, no key required.
API docs: https://www.arbeitnow.com/api

Returns normalized job dicts with keys:
    id, title, company, location, salary, url, apply_url,
    description, source, apply_email, tags
"""
import re

import httpx
import structlog

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
    limit: int = 30,
) -> list[dict]:
    """
    Search Arbeitnow for remote English-speaking jobs.
    The `location` parameter is accepted for API compatibility but Arbeitnow
    does not support server-side location filtering.
    """
    params: dict = {}
    if query:
        params["search"] = query

    try:
        async with httpx.AsyncClient(timeout=10, headers=_HEADERS) as client:
            r = await client.get(
                "https://www.arbeitnow.com/api/job-board-api",
                params=params,
            )
            if r.status_code != 200:
                logger.warning(
                    "arbeitnow.http_error",
                    status=r.status_code,
                )
                return []
            data = r.json()
    except Exception as exc:
        logger.warning("arbeitnow.request_failed", error=str(exc))
        return []

    jobs: list[dict] = []
    for item in data.get("data", [])[:limit]:
        jobs.append(
            _normalize(
                {
                    "id": f"arbeitnow_{item.get('slug', '')}",
                    "title": item.get("title", ""),
                    "company": item.get("company_name", ""),
                    "location": (
                        item.get("location", "")
                        or ("Remote" if item.get("remote") else "Europe")
                    ),
                    "salary": "",
                    "url": item.get("url", ""),
                    "apply_url": item.get("url", ""),
                    "description": _clean_html(item.get("description", "")),
                    "source": "arbeitnow",
                    "tags": item.get("tags", []),
                }
            )
        )

    logger.info("arbeitnow.search_complete", count=len(jobs), query=query)
    return jobs
