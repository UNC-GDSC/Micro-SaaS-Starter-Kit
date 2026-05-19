"""
main.py — FastAPI application entry point.

Lifespan:
  - Startup: initialise asyncpg pool, configure structlog
  - Shutdown: close pool

Run locally:
    uvicorn worker.main:app --reload --port 8000
"""
import time
from contextlib import asynccontextmanager
from typing import AsyncGenerator

import structlog
from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware

from worker.config import settings
from worker.db import close_pool, init_pool
from worker.routes.health import router as health_router
from worker.routes.jobs import router as jobs_router

# ── structlog configuration ─────────────────────────────────────────────────

structlog.configure(
    processors=[
        structlog.contextvars.merge_contextvars,
        structlog.processors.add_log_level,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
        structlog.dev.ConsoleRenderer(),
    ],
    wrapper_class=structlog.make_filtering_bound_logger(20),  # INFO
    context_class=dict,
    logger_factory=structlog.PrintLoggerFactory(),
    cache_logger_on_first_use=True,
)

logger = structlog.get_logger(__name__)


# ── Lifespan ─────────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    logger.info("worker.starting", version=settings.worker_version)
    await init_pool(app)
    logger.info("worker.ready")
    yield
    logger.info("worker.shutting_down")
    await close_pool(app)
    logger.info("worker.stopped")


# ── App ───────────────────────────────────────────────────────────────────────

app = FastAPI(
    title="Resume AI Worker",
    version=settings.worker_version,
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# CORS — restrict to internal / same-origin traffic only
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost", "http://127.0.0.1"],
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["Authorization", "Content-Type"],
)


# ── Request logging middleware ────────────────────────────────────────────────

@app.middleware("http")
async def log_requests(request: Request, call_next) -> Response:
    start = time.perf_counter()
    structlog.contextvars.clear_contextvars()
    structlog.contextvars.bind_contextvars(
        method=request.method,
        path=request.url.path,
    )
    response: Response = await call_next(request)
    duration_ms = round((time.perf_counter() - start) * 1000, 1)
    logger.info(
        "http.request",
        status=response.status_code,
        duration_ms=duration_ms,
    )
    return response


# ── Routers ───────────────────────────────────────────────────────────────────

app.include_router(health_router)
app.include_router(jobs_router, prefix="/jobs")
