"""
themuse.py — The Muse job board scraper.

Open API, no key required.
API docs: https://www.themuse.com/developers/api/v2

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
    limit: int = 20,
) -> list[dict]:
    """
    Search The Muse for US tech/startup jobs.
    Uses `category` param for keyword filtering.
    """
    params: dict = {"page": 0}
    if query:
        params["category"] = query
    if location:
        params["location"] = location

    try:
        async with httpx.AsyncClient(timeout=10, headers=_HEADERS) as client:
            r = await client.get("https://www.themuse.com/api/public/jobs", params=params)
            if r.status_code != 200:
                logger.warning("themuse.http_error", status=r.status_code)
                return []
            data = r.json()
    except Exception as exc:
        logger.warning("themuse.request_failed", error=str(exc))
        return []

    jobs: list[dict] = []
    for item in data.get("results", [])[:limit]:
        locations = ", ".join(loc.get("name", "") for loc in item.get("locations", []))
        jobs.append(
            _normalize(
                {
                    "id": f"themuse_{item.get('id', '')}",
                    "title": item.get("name", ""),
                    "company": item.get("company", {}).get("name", ""),
                    "location": locations or "US",
                    "salary": "",
                    "url": item.get("refs", {}).get("landing_page", ""),
                    "apply_url": item.get("refs", {}).get("landing_page", ""),
                    "description": _clean_html(item.get("contents", "")),
                    "source": "themuse",
                }
            )
        )

    logger.info("themuse.search_complete", count=len(jobs), query=query)
    return jobs
