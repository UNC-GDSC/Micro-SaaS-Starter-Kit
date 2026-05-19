# Resume AI Worker

A clean, English-only FastAPI worker extracted from the legacy `resume-ai` monolith.
Provides AI-powered resume generation, cover letter generation, job board scraping,
and automated job application via Playwright.

## Requirements

- Python 3.12+
- PostgreSQL 14+
- (Optional) Playwright Chromium — only needed for LinkedIn/CareerOps autoapply

## Quick Start

```bash
# 1. Copy and fill in secrets
cp .env.example .env
# Edit .env — WORKER_SECRET and DATABASE_URL are required at minimum

# 2. Install dependencies
pip install uv
uv pip install -e ".[dev]"

# 3. (Optional) Install Playwright Chromium for autoapply features
playwright install chromium
playwright install-deps chromium

# 4. Run the worker
uvicorn worker.main:app --reload --port 8000
```

## API

All routes require `Authorization: Bearer <WORKER_SECRET>`.

| Method | Route | Description |
|--------|-------|-------------|
| `POST` | `/jobs/resume/generate` | Generate a tailored resume |
| `POST` | `/jobs/cover-letter` | Generate a cover letter |
| `POST` | `/jobs/autoapply/linkedin` | Run LinkedIn Easy Apply campaign |
| `POST` | `/jobs/autoapply/careerops` | Submit via ATS form filler |
| `POST` | `/jobs/scrape/{board}` | Scrape a job board (`adzuna`, `arbeitnow`, `remoteok`, `themuse`) |
| `GET`  | `/jobs/{job_id}` | Get job status + result |
| `GET`  | `/health` | Liveness check + DB status |

Full interactive docs: http://localhost:8000/docs

## Run Tests

```bash
pytest tests/ -v
```

## Docker

```bash
docker build -t resume-ai-worker .
docker run --env-file .env -p 8000:8000 resume-ai-worker
```

## Configuration

See `.env.example` for all supported environment variables.
See `MIGRATION_NOTES.md` for the full porting changelog and known TODOs.
