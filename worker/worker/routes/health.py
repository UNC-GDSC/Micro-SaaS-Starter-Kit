"""
health.py — Liveness / readiness endpoint.

GET /health  →  200  {"status": "ok", "version": "...", "db": "ok"|"error", "timestamp": "..."}
"""
from datetime import datetime, timezone

import structlog
from fastapi import APIRouter, Request

from worker.config import settings
from worker.db import get_pool

logger = structlog.get_logger(__name__)
router = APIRouter()


@router.get("/health")
async def health_check(request: Request) -> dict:
    """Return service health including database connectivity."""
    db_status = "error"
    try:
        pool = get_pool(request.app)
        async with pool.acquire() as conn:
            await conn.fetchval("SELECT 1")
        db_status = "ok"
    except Exception as exc:
        logger.warning("health.db_check_failed", error=str(exc))

    return {
        "status": "ok",
        "version": settings.worker_version,
        "db": db_status,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
