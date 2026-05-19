"""
test_health.py — Integration test for the /health endpoint.

Uses httpx.AsyncClient as the test client (no external server needed).
"""
import pytest
from httpx import ASGITransport, AsyncClient
from unittest.mock import AsyncMock, MagicMock, patch


@pytest.fixture()
def app_with_mock_db():
    """
    Return the FastAPI app with a mock database pool attached to app.state
    so that /health does not require a real Postgres connection.
    """
    # Patch Settings so the app can be imported without a real .env
    with patch.dict(
        "os.environ",
        {
            "WORKER_SECRET": "test-secret",
            "DATABASE_URL": "postgresql+asyncpg://user:pass@localhost/test",
        },
    ):
        from worker.main import app

        # Attach a mock pool that returns 1 for SELECT 1
        mock_conn = AsyncMock()
        mock_conn.fetchval = AsyncMock(return_value=1)

        mock_pool = MagicMock()
        mock_pool.acquire = MagicMock(
            return_value=MagicMock(
                __aenter__=AsyncMock(return_value=mock_conn),
                __aexit__=AsyncMock(return_value=None),
            )
        )

        app.state.db_pool = mock_pool
        yield app


@pytest.mark.asyncio
async def test_health_returns_200(app_with_mock_db):
    """GET /health returns HTTP 200 with status='ok'."""
    transport = ASGITransport(app=app_with_mock_db)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/health")

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert "version" in body
    assert "timestamp" in body


@pytest.mark.asyncio
async def test_health_db_status_ok(app_with_mock_db):
    """GET /health reports db='ok' when pool responds normally."""
    transport = ASGITransport(app=app_with_mock_db)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/health")

    assert response.json()["db"] == "ok"


@pytest.mark.asyncio
async def test_health_db_status_error():
    """GET /health reports db='error' when the pool raises an exception."""
    with patch.dict(
        "os.environ",
        {
            "WORKER_SECRET": "test-secret",
            "DATABASE_URL": "postgresql+asyncpg://user:pass@localhost/test",
        },
    ):
        from worker.main import app

        # Pool that always raises
        mock_pool = MagicMock()
        mock_pool.acquire = MagicMock(
            return_value=MagicMock(
                __aenter__=AsyncMock(side_effect=Exception("connection refused")),
                __aexit__=AsyncMock(return_value=None),
            )
        )
        app.state.db_pool = mock_pool

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.get("/health")

    assert response.status_code == 200
    assert response.json()["db"] == "error"
