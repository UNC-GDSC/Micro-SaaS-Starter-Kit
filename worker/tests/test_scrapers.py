"""
test_scrapers.py — Unit tests for job board scrapers.

Uses respx to mock outbound HTTP so no real network calls are made.
"""
import pytest
import respx
import httpx


# ── Arbeitnow ─────────────────────────────────────────────────────────────────

ARBEITNOW_RESPONSE = {
    "data": [
        {
            "slug": "python-dev-123",
            "title": "Python Developer",
            "company_name": "Acme Corp",
            "location": "Berlin",
            "remote": False,
            "url": "https://www.arbeitnow.com/jobs/python-dev-123",
            "description": "<p>Join our team.</p>",
            "tags": ["python", "django"],
        },
        {
            "slug": "remote-js-456",
            "title": "JavaScript Engineer",
            "company_name": "Remote Co",
            "location": "",
            "remote": True,
            "url": "https://www.arbeitnow.com/jobs/remote-js-456",
            "description": "Build cool stuff.",
            "tags": ["javascript"],
        },
    ]
}


@pytest.mark.asyncio
@respx.mock
async def test_arbeitnow_returns_normalized_list():
    """search() returns a normalized list with correct keys."""
    respx.get("https://www.arbeitnow.com/api/job-board-api").mock(
        return_value=httpx.Response(200, json=ARBEITNOW_RESPONSE)
    )

    from worker.scrapers.arbeitnow import search

    results = await search(query="python")

    assert len(results) == 2

    job = results[0]
    assert job["id"] == "arbeitnow_python-dev-123"
    assert job["title"] == "Python Developer"
    assert job["company"] == "Acme Corp"
    assert job["location"] == "Berlin"
    assert job["source"] == "arbeitnow"
    assert "url" in job
    assert "apply_url" in job
    assert "description" in job
    assert "tags" in job

    # Remote job should default location to "Remote"
    assert results[1]["location"] == "Remote"


@pytest.mark.asyncio
@respx.mock
async def test_arbeitnow_handles_http_error():
    """search() returns empty list on non-200 response."""
    respx.get("https://www.arbeitnow.com/api/job-board-api").mock(
        return_value=httpx.Response(503)
    )

    from worker.scrapers.arbeitnow import search

    results = await search(query="python")
    assert results == []


# ── RemoteOK ──────────────────────────────────────────────────────────────────

REMOTEOK_RESPONSE = [
    # First item is always the legal notice — must be skipped
    {"legal": "This API is provided by RemoteOK.com"},
    {
        "id": "123456",
        "position": "Senior Python Developer",
        "company": "Startup Inc",
        "location": "Worldwide",
        "salary_min": 80000,
        "salary_max": 120000,
        "url": "https://remoteok.com/jobs/123456",
        "apply_url": "https://startupinc.com/apply",
        "description": "<p>We are hiring!</p>",
        "tags": ["python", "fastapi"],
    },
    {
        "id": "789",
        "position": "Frontend Engineer",
        "company": "WebCo",
        "location": "",
        "salary_min": None,
        "salary_max": None,
        "url": "https://remoteok.com/jobs/789",
        "apply_url": "",
        "description": "React dev needed.",
        "tags": ["react"],
    },
]


@pytest.mark.asyncio
@respx.mock
async def test_remoteok_skips_legal_notice():
    """search() skips the first legal-notice item and returns real jobs."""
    respx.get("https://remoteok.com/api").mock(
        return_value=httpx.Response(200, json=REMOTEOK_RESPONSE)
    )

    from worker.scrapers.remoteok import search

    results = await search(query="python")

    # Should have 2 real jobs (legal notice excluded)
    assert len(results) == 2
    titles = [r["title"] for r in results]
    assert "Senior Python Developer" in titles
    assert "Frontend Engineer" in titles


@pytest.mark.asyncio
@respx.mock
async def test_remoteok_salary_formatting():
    """search() formats salary range correctly when both min and max are present."""
    respx.get("https://remoteok.com/api").mock(
        return_value=httpx.Response(200, json=REMOTEOK_RESPONSE)
    )

    from worker.scrapers.remoteok import search

    results = await search(query="python")
    senior_dev = next(r for r in results if "Senior" in r["title"])
    assert senior_dev["salary"] == "$80,000–$120,000/yr"


@pytest.mark.asyncio
@respx.mock
async def test_remoteok_empty_salary_when_missing():
    """search() leaves salary empty when salary_min/max are None."""
    respx.get("https://remoteok.com/api").mock(
        return_value=httpx.Response(200, json=REMOTEOK_RESPONSE)
    )

    from worker.scrapers.remoteok import search

    results = await search(query="python")
    frontend = next(r for r in results if "Frontend" in r["title"])
    assert frontend["salary"] == ""


# ── Adzuna — skips when credentials missing ───────────────────────────────────

@pytest.mark.asyncio
async def test_adzuna_skips_without_credentials():
    """search() returns [] without making any HTTP call when credentials are absent."""
    import importlib
    from unittest.mock import patch

    # Ensure adzuna_app_id / adzuna_app_key are empty
    with patch("worker.scrapers.adzuna.settings") as mock_settings:
        mock_settings.adzuna_app_id = ""
        mock_settings.adzuna_app_key = ""

        from worker.scrapers.adzuna import search

        results = await search(query="python")
        assert results == []
