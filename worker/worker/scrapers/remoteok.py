"""
remoteok.py — RemoteOK job board scraper.

Open JSON API, no key required.
API docs: https://remoteok.com/api

Returns normalized job dicts with keys:
    id, title, company, location, salary, url, apply_url,
    description, source, apply_email, tags
"""
import re

import httpx
import structlog

logger = structlog.get_logger(__name__)

_HEADERS = {
    "User-Agent": "ResumeAI-Worker/1.0 (support@example.com)",
    "Accept": "application/json",
}


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
    Search RemoteOK for remote developer jobs.
    The `location` parameter is accepted for API compatibility but RemoteOK
    does not support server-side location filtering (all jobs are remote).
    """
    tag = query.lower().replace(" ", "-") if query else "dev"

    try:
        async with httpx.AsyncClient(timeout=10, headers=_HEADERS) as client:
            r = await client.get(f"https://remoteok.com/api?tag={tag}")
            if r.status_code != 200:
                logger.warning("remoteok.http_error", status=r.status_code)
                return []
            items: list = r.json()
    except Exception as exc:
        logger.warning("remoteok.request_failed", error=str(exc))
        return []

    # First item is always a legal notice object — skip it
    if items and isinstance(items[0], dict) and "legal" in items[0]:
        items = items[1:]

    jobs: list[dict] = []
    for item in items[:limit]:
        if not isinstance(item, dict):
            continue
        sal_min = item.get("salary_min")
        sal_max = item.get("salary_max")
        salary = f"${int(sal_min):,}–${int(sal_max):,}/yr" if sal_min and sal_max else ""
        jobs.append(
            _normalize(
                {
                    "id": f"remoteok_{item.get('id', '')}",
                    "title": item.get("position", ""),
                    "company": item.get("company", ""),
                    "location": item.get("location", "") or "Remote",
                    "salary": salary,
                    "url": item.get("url", ""),
                    "apply_url": item.get("apply_url", "") or item.get("url", ""),
                    "description": _clean_html(item.get("description", "")),
                    "source": "remoteok",
                    "tags": item.get("tags", []),
                }
            )
        )

    logger.info("remoteok.search_complete", count=len(jobs), query=query)
    return jobs
