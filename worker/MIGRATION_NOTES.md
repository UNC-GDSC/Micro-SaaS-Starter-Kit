# Migration Notes

## Files Ported

| New file | Source file | Notes |
|---|---|---|
| `worker/config.py` | `autoapply/config.py` | Converted to Pydantic BaseSettings; removed Telegram, Stripe, CryptoBot, SMTP, JWT fields; database is Postgres only (no SQLite) |
| `worker/crypto.py` | `autoapply/crypto.py` | Logic unchanged; replaced `logging` with `structlog`; reads key from `settings.encryption_key` instead of `os.getenv` |
| `worker/autoapply/linkedin.py` | `scrapers/linkedin_applicator.py` | All log messages already in English; replaced `logging` with `structlog`; wrapped module-level functions in `LinkedInApplicator` class; removed Russian placeholder keywords from `_fill_form_defaults` |
| `worker/autoapply/careerops.py` | `autoapply/ats_filler.py` | Replaced `logging` with `structlog`; renamed `ATSFiller` → `CareerOpsApplicator`; no logic changes |
| `worker/autoapply/common.py` | (new) | Shared helpers: `clean_user_data()`, `not_available_result()` |
| `worker/scrapers/adzuna.py` | `autoapply/english_job_engine.py` (search_adzuna) | Extracted to own file; reads credentials from `settings` |
| `worker/scrapers/arbeitnow.py` | `autoapply/english_job_engine.py` (search_arbeitnow) | Extracted to own file |
| `worker/scrapers/remoteok.py` | `autoapply/english_job_engine.py` (search_remoteok) | Extracted to own file |
| `worker/scrapers/themuse.py` | `autoapply/english_job_engine.py` (search_themuse) | Extracted to own file |
| `worker/ai/resume.py` | `scrapers/resume_generator.py` | Replaced `aiohttp` with `httpx`; replaced `logging` with `structlog`; system prompt loaded from `prompts/resume.txt`; removed PDF generation (kept in legacy `scrapers/resume_pdf_generator.py`) |
| `worker/ai/cover_letter.py` | `autoapply/english_job_engine.py` + `scrapers/resume_generator.py` | Merged both `generate_cover_letter` implementations into one; unified interface with explicit `job_title`, `company`, `job_description` args; system prompt loaded from `prompts/cover_letter.txt` |
| `worker/ai/prompts/resume.txt` | `bot/prompts/resume_prompt.py` (RESUME_SYSTEM_PROMPT) | Translated from Russian to English; kept the same rules and structure |
| `worker/ai/prompts/cover_letter.txt` | `bot/prompts/cover_letter_prompt.py` (COVER_LETTER_SYSTEM_PROMPT) | Translated from Russian to English; kept the same structure |
| `worker/deps.py` | (new) | FastAPI Bearer token auth dependency |
| `worker/db.py` | (new) | asyncpg pool lifecycle (init/close/get) |
| `worker/main.py` | (new) | FastAPI app: lifespan, CORS, structlog request middleware, router registration |
| `worker/routes/health.py` | (new) | `GET /health` with DB connectivity check |
| `worker/routes/jobs.py` | (new) | All 7 job API routes with in-memory job store |

---

## Logic Simplified or Removed

### Removed (out of scope for the worker)

- **Telegram / aiogram** — all bot code removed; the worker is a pure HTTP API
- **SQLite databases** (`AUTOAPPLY_DB`, `BOT_DB`) — replaced with a single Postgres pool
- **JWT auth** — replaced with a simple Bearer token (`WORKER_SECRET`)
- **Stripe / CryptoBot payments** — removed from config; not needed in the worker
- **SMTP email** — removed from config
- **PDF generation** (`generate_resume_pdf`, `reportlab` usage in resume_generator) — the worker returns resume text; PDF rendering is a separate concern
- **Resume caching** (`scrapers/resume_cache.py`) — omitted in MVP; add Redis caching later if needed
- **`search_english_jobs` aggregator** — replaced by individual per-board scrapers called directly by the `/jobs/scrape/{board}` route
- **RESUME_USER_PROMPT_TEMPLATE / COVER_LETTER_USER_PROMPT** — the new `worker/ai/resume.py` and `cover_letter.py` build prompts inline from function arguments

### Simplified

- **Job store** — in-memory `dict` instead of a database queue. Jobs process synchronously (await) before the HTTP response is returned. For high throughput, replace with ARQ or Celery.
- **`_fill_form_defaults` in linkedin.py** — removed Russian-language placeholder keywords (`"let"` / years, `"opyt"` / experience) that were leftover in the original.

---

## TODOs Requiring Human Review

1. **Test with real LinkedIn credentials** — the Playwright automation has not been tested with a live account after the port. Verify CAPTCHA detection still works.

2. **Persistent job store** — current in-memory store resets on restart. Add a `jobs` table in Postgres or a Redis-backed queue (ARQ) before going to production.

3. **PDF resume delivery** — the `/jobs/resume/generate` endpoint returns plain text. If the caller needs a PDF, wire up `generate_resume_pdf()` from the legacy `scrapers/resume_pdf_generator.py` (it is not deleted, just not ported here).

4. **Rate limiting** — add per-IP or per-user rate limiting on `/jobs/autoapply/*` routes to prevent abuse.

5. **Database schema** — `worker/db.py` creates a pool but no tables. Add a migration (Alembic or raw SQL) for any persistent data you add (job history, apply logs, etc.).

6. **Playwright in Docker** — the Dockerfile does not install Chromium system dependencies. Add `playwright install-deps chromium` in the builder stage if LinkedIn/CareerOps autoapply is used inside the container.

7. **OpenRouter support** — the legacy `english_job_engine.py` supported OpenRouter as a fallback API. The ported `cover_letter.py` sends requests only to `api.openai.com`. Re-add OpenRouter support if needed.

---

## ENCRYPTION_KEY Warning

> **CRITICAL**: The `ENCRYPTION_KEY` in `.env` must be copied **verbatim** from the old deployment's `.env` file.
>
> LinkedIn passwords stored in the database are encrypted with Fernet using this key. If you use a different key (or no key), all existing encrypted passwords become unreadable and users will need to re-enter their credentials.
>
> To rotate the key in the future: decrypt all stored passwords with the old key, re-encrypt with the new key, then update `ENCRYPTION_KEY`.
