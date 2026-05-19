> Imported from the legacy resume-ai repo on 2026-05-14.
> This file documents the OLD system. Do not modify — it's reference
> material for the migration in scripts/migrate-from-legacy.ts.

# Resume-AI Legacy Codebase Audit Report

**Date:** 2026-05-14  
**Scope:** Read-only audit of resume-ai-bot (Telegram bot + FastAPI autoapply service)  
**Status:** Complete rebuild in progress

---

## 1. Git History Summary

Recent commits show a **staged, systematic hardening and stabilization pattern** over 30 commits spanning 6+ months:
- **Stage 0-2 (Jan-Feb)**: Foundation — backup, encryption, self-healer
- **Stage 3-4 (Mar)**: Security & reliability — CORS, SSRF protection, Sentry, rate limiting, idempotency
- **Stage 5-6 (Apr)**: Payments & compliance — Stripe checkout, Fernet encryption, consent tracking
- **Stage 7-9 (May)**: Operations — nginx rate limiting, marketing/analytics, SEO, CI/deploy hardening

The project transitioned from bug-fixing reactive mode into **deliberate, tracked feature stages** with infrastructure investment. Recent focus on CI/deploy automation, observability, and security indicates preparation for scale or acquisition.

---

## 2. Top-Level Python Files (Root Directory)

| File | Description | Classification |
|------|-------------|-----------------|
| `analytics_db.py` | Analytics data layer — computes daily stats from existing bot.db tables, creates new analytics-only tables | KEEP |
| `analytics_startup.py` | Init script — calls analytics_db.init_analytics_db() on bot startup | KEEP |
| `analytics_tracker.py` | Event tracker — logs payments, resumes, messages; integrates PostHog and Sentry | KEEP |
| `auto_test.py` | Automated test runner — smoke tests for bot commands and autoapply API endpoints | KEEP |
| `backup.py` | Database backup utility — backs up bot.db and autoapply.db to date-stamped files | EXTRACT |
| `bug_report.py` | Bug report generator — sends diagnostic reports and stack traces to admin via Telegram | EXTRACT |
| `daily_reporter.py` | Daily reporting service — computes and sends daily stats (users, revenue, campaigns) to admin | EXTRACT |
| `dashboard.py` | Streamlit analytics dashboard — web UI for metrics, cohorts, revenue, user activity | EXTRACT |
| `generate_seo_pages.py` | Static SEO page generator — creates landing pages from job-role templates (25+ roles) | KILL |
| `health_check.py` | Health checker — monitors bot.db, autoapply.db, disk space, process counts; sends alerts | EXTRACT |
| `health_monitor.py` | Health monitor service — periodically runs health_check.py via APScheduler | EXTRACT |
| `maintenance.py` | Maintenance mode handler — gracefully disables bot during deployments | EXTRACT |
| `marketing_cron.py` | Marketing scheduler — posts to VK, Telegram channels, schedules social content | KILL |
| `monitor.py` | Process monitor — watches bot and API processes, restarts on failure | EXTRACT |
| `run.py` | Main FastAPI server — serves autoapply API (port 8000/8080), mounts static files | KEEP |
| `run_checks.py` | Pre-deployment checks — validates OpenAI API, Stripe, bot connectivity before deploy | EXTRACT |
| `self_healer.py` | Self-healing agent — fixes known issues (hung locks, rate limit resets) | EXTRACT |
| `setup_linkedin_creds.py` | LinkedIn credential setup — Fernet-encrypts LinkedIn creds for encrypted vault | EXTRACT |
| `stripe_setup.py` | Stripe API initializer — configures Stripe SDK with secret key at startup | KEEP |
| `submit_sitemaps.py` | SEO sitemap submission — submits sitemaps to Google/Yandex Search Console | KILL |
| `submit_to_directories.py` | Directory submission — submits bot to Telegram directory, StoreBot, search engines | KILL |
| `update_webapp_url.py` | URL updater — updates Telegram bot webapp URL config | INVESTIGATE |

**Rationale:**
- **KEEP**: Core business logic (payments, API server, event tracking)
- **EXTRACT**: Operational/reliability utilities — worth porting to new stack (backup, health, monitoring, self-healing)
- **KILL**: Marketing/SEO automation — separate module, low priority for rebuild
- **INVESTIGATE**: `update_webapp_url.py` — unclear if still needed (Telegram bot config change)

---

## 3. Cyrillic Strings Analysis

**Total files containing Cyrillic:** 163 files  
**Top 20 files with most Cyrillic content:**

| Rank | File | Count | Purpose |
|------|------|-------|---------|
| 1 | `autoapply/static/app.html` | 12,470 | Web UI navigation, labels, buttons (Russian i18n) |
| 2 | `seo/submit_directories.py` | 6,270 | Bot name, tagline, descriptions (Russian marketing) |
| 3 | `bot/utils/bot_translations.py` | 4,243 | Telegram bot messages (Russian greeting, features, help) |
| 4 | `landing/blog/ats-secrets-2026.html` | 4,088 | Blog article (Russian SEO content) |
| 5 | `seo/backlink_generator.py` | 4,083 | Reddit/social post templates (Russian marketing) |
| 6 | `landing/terms.html` | 4,002 | Terms of service (Russian legal) |
| 7 | `landing/blog/ai-job-applications-2026.html` | 3,943 | Blog article (Russian SEO content) |
| 8 | `landing/blog/resume-mistakes.html` | 3,868 | Blog article (Russian SEO content) |
| 9 | `landing/privacy.html` | 3,797 | Privacy policy (Russian legal) |
| 10 | `landing/blog/auto-apply-guide.html` | 3,485 | Blog article (Russian SEO content) |
| 11 | `landing/resume/cybersecurity-analyst.html` | 3,428 | Resume template (Russian role-specific) |
| 12 | `generate_seo_pages.py` | 3,422 | Hardcoded job role mapping (Russian titles) |
| 13 | `landing/resume/product-manager.html` | 3,302 | Resume template (Russian role-specific) |
| 14 | `landing/resume/system-administrator.html` | 3,302 | Resume template (Russian role-specific) |
| 15 | `landing/resume/accountant.html` | 3,284 | Resume template (Russian role-specific) |
| 16 | `landing/resume/marketing-manager.html` | 3,269 | Resume template (Russian role-specific) |
| 17 | `landing/blog/telegram-job-search.html` | 3,267 | Blog article (Russian SEO content) |
| 18 | `landing/resume/graphic-designer.html` | 3,249 | Resume template (Russian role-specific) |
| 19 | `landing/resume/technical-writer.html` | 3,238 | Resume template (Russian role-specific) |
| 20 | `landing/resume/frontend-developer.html` | 3,232 | Resume template (Russian role-specific) |

**Example Cyrillic Content:**
- `autoapply/static/app.html:402` → `<a class="nav-logo" ... data-i18n="login.title">АвтоОтклик</a>`
- `bot/utils/bot_translations.py:16` → `"👋 <b>Привет! Я — РезюмеАИ</b>\n\n"`
- `seo/submit_directories.py:29` → `BOT_NAME_RU = "РезюмеАИ — AI Карьерный Консультант"`

**Implication:** Strong Russian i18n across UI, marketing, and legal docs. New rebuild must support bilingual (RU/EN) from day one if internationalization is a requirement.

---

## 4. Database Schemas

### 4.1 Bot Database (`bot.db`)

**Source:** `analytics_db.py`, `bot/` handlers (inferred schema)

Existing tables (READ ONLY):
| Table Name | Key Columns | Purpose | Used By |
|------------|------------|---------|---------|
| `users` | telegram_id, username, full_name, referral_code, referred_by, credits_*, total_resumes_generated, total_assistant_messages, total_spent_rub, created_at, last_active | User profiles, referral tracking, credit balance | bot/handlers/*, analytics_db.py |
| `payments` | id, telegram_id, amount_rub, package, status, payment_id, created_at | Payment records (no method column) | analytics_tracker.py, daily_reporter.py |
| `generation_logs` | id, telegram_id, type, input_text, result_text, tokens_used, cost_usd, created_at | Resume/cover letter/interview/analysis logs | analytics_db.py, health_check.py |
| `assistant_conversations` | id, telegram_id, role, content, tokens_used, created_at | Chat history with AI assistant | analytics_db.py |

New analytics tables (created by `analytics_db.py`):
| Table Name | Key Columns | Purpose | Used By |
|------------|------------|---------|---------|
| `daily_stats` | date (PK), new_users, active_users, new_paid_users, total_paid_users, revenue_crypto, revenue_card, revenue_revolut, resumes_generated, letters_generated, interviews_done, vacancy_analyses, ai_messages, referrals_made, outreach_conversions | Daily aggregated metrics | daily_reporter.py, dashboard.py |
| `join_sources` | user_id (PK), source, recorded_at | User acquisition source tracking | analytics_db.py |
| `outreach_log` | id (PK), date, messages_sent, estimated_conversions | Outreach campaign metrics | analytics_db.py |
| `content_log` | id (PK), date, platform, post_title, post_url, estimated_clicks | Content/blog post metrics | analytics_db.py |

---

### 4.2 AutoApply Database (`autoapply.db`)

**Source:** `autoapply/autoapply_db.py`

| Table Name | Key Columns | Purpose | Used By |
|------------|------------|---------|---------|
| `autoapply_users` | id (PK), telegram_id, email (UNIQUE), password_hash, plan, created_at, last_active, daily_limit, applications_today, applications_total, responses_received, hh_token, hh_resume_id, linkedin_email, linkedin_password_enc, resume_text, is_verified, consent_at, stripe_customer_id | User accounts, auth, job site tokens, encrypted credentials | autoapply_main.py, email_sender.py |
| `campaigns` | id (PK), user_id (FK), job_title, location, salary_min, experience, platforms, daily_limit, status, created_at, applications_sent, responses, last_run | Auto-apply job search campaigns | autoapply_main.py, autoapply_db.py |
| `applications` | id (PK), campaign_id (FK), user_id (FK), platform, vacancy_id, vacancy_title, company_name, vacancy_url, resume_used, status, sent_at, response_at | Submitted job applications | autoapply_main.py, autoapply_db.py |
| `vacancies_cache` | id (PK), platform (TEXT), vacancy_id (UNIQUE), title, company, location, salary, description, url, fetched_at, applied | Cached job postings | autoapply_main.py (scraper) |
| `email_tokens` | id (PK), user_id (FK), token (UNIQUE), kind ('verify'/'reset'), expires_at, used | Email verification/password reset tokens | autoapply_main.py (auth) |
| `email_drip` | id (PK), user_id (FK), step, next_send_at, completed, created_at | Email drip campaign state | email_sender.py, scripts/email_drip_cron.py |
| `testimonials` | id (PK), user_id, name, text, rating, approved, created_at | User testimonials (not displayed yet) | autoapply_main.py |
| `web_generations` | id (PK), user_id, type ('resume'/'cover_letter'/'analysis'/'demo_analysis'), created_at | Document generation events | autoapply_main.py |
| `page_views` | id (PK), page, referrer, ip_hash, created_at | Analytics page views | autoapply_main.py |
| `rate_limits` | key (PK), last_hit | Rate limiter state per IP/endpoint | autoapply_main.py |

**Indexes:** 15+ indexes on email, campaign_user, application_user, token, drip_scheduler, timestamps

---

### 4.3 Other Databases

**Worker Lock** (`worker.py`):
```sql
CREATE TABLE IF NOT EXISTS worker_lock (
    id TEXT PRIMARY KEY,
    locked_at TIMESTAMP
)
```
Purpose: Distributed lock to prevent concurrent job runs

**CryptoBot Events** (`payments.py`):
```sql
CREATE TABLE IF NOT EXISTS cryptobot_events (
    id INTEGER PRIMARY KEY,
    update_id INTEGER,
    invoice_id TEXT,
    payload TEXT,
    created_at TIMESTAMP
)
```
Purpose: Crypto payment webhook events

**Stripe Events** (`api/routes/stripe.py`):
```sql
CREATE TABLE IF NOT EXISTS stripe_events (
    id TEXT PRIMARY KEY,
    event_json TEXT,
    processed INTEGER,
    created_at TIMESTAMP
)
```
Purpose: Stripe webhook events

---

## 5. Environment Variables / Secrets

**Identified env vars** (from grep analysis of os.getenv/os.environ):

| Variable Name | Used In Files | Looks Like |
|---------------|---------------|-----------|
| `BOT_TOKEN` | backup.py, monitor.py, maintenance.py, health_monitor.py, marketing_cron.py, run_checks.py, health_check.py, auto_test.py, self_healer.py, bug_report.py, daily_reporter.py, autoapply/config.py, bot/main.py | Telegram Bot Token (47+ chars, numeric) |
| `ADMIN_ID` | daily_reporter.py, backup.py, maintenance.py, health_monitor.py, health_check.py, auto_test.py, self_healer.py, bug_report.py, monitor.py | Telegram Admin Chat ID (numeric) |
| `ADMIN_SECRET` | marketing_cron.py, autoapply/autoapply_main.py | Generic secret key |
| `OPENAI_API_KEY` | run_checks.py, autoapply/config.py, autoapply/english_job_engine.py, autoapply/autoapply_main.py, tests/test_autoapply.py, scripts/email_outreach.py, scripts/auto_blogger.py | OpenAI API Key (sk-*) |
| `OPENROUTER_API_KEY` | run_checks.py, autoapply/config.py, autoapply/english_job_engine.py, autoapply/autoapply_main.py, scripts/lead_scraper.py, scripts/auto_blogger.py, scripts/email_outreach.py | OpenRouter API Key (sk-*) |
| `STRIPE_SECRET_KEY` | stripe_setup.py, autoapply/config.py, autoapply/autoapply_main.py | Stripe Secret Key (sk_live_* or sk_test_*) |
| `STRIPE_WEBHOOK_SECRET` | autoapply/config.py, autoapply/autoapply_main.py | Stripe Webhook Secret (whsec_*) |
| `STRIPE_PUBLISHABLE_KEY` | autoapply/config.py | Stripe Publishable Key (pk_live_* or pk_test_*) |
| `CRYPTOBOT_TOKEN` | autoapply/config.py, autoapply/payments.py | CryptoBot API Token |
| `CRYPTOBOT_AUTOAPPLY_TOKEN` | autoapply/config.py, autoapply/payments.py, tests/end_to_end_test.py | CryptoBot Token (autoapply service) |
| `CRYPTOBOT_WEBHOOK_SECRET` | autoapply/config.py | CryptoBot Webhook Secret |
| `ENCRYPTION_KEY` | autoapply/crypto.py | Fernet encryption key (base64-encoded) |
| `LINKEDIN_FERNET_KEY` | setup_linkedin_creds.py | Fernet key for LinkedIn credential encryption |
| `ADZUNA_APP_KEY` | autoapply/config.py | Adzuna job board API key |
| `JWT_SECRET` | autoapply/config.py | JWT signing secret (default: "autoapply-change-in-production-2025") |
| `API_PORT` | run.py | API server port (default: 8000) |
| `API_HOST` | run.py | API server host (default: 0.0.0.0) |
| `DATABASE_URL` | run.py | SQLAlchemy DB URL (default: sqlite+aiosqlite:///./bot.db) |
| `BOT_DB` | backup.py, health_check.py, maintenance.py | Bot database path (default: /opt/resumeaibot/bot.db) |
| `AUTOAPPLY_DB` | daily_reporter.py, backup.py, health_check.py | AutoApply database path (default: /opt/resumeaibot/autoapply.db) |
| `BACKUP_DIR` | backup.py | Backup directory (default: /opt/resumeaibot/backups) |
| `LOGS_DIR` | health_check.py | Logs directory (default: /opt/resumeaibot/logs) |
| `ADMIN_EMAIL` | health_check.py | Admin email for alerts |
| `SMTP_HOST` | health_check.py, autoapply/config.py, autoapply/email_sender.py | SMTP server hostname |
| `SMTP_PORT` | health_check.py | SMTP port (default: 587) |
| `SMTP_USER` | health_check.py, autoapply/config.py, autoapply/email_sender.py | SMTP username |
| `SMTP_PASSWORD` | health_check.py, autoapply/config.py, autoapply/email_sender.py | SMTP password |
| `SMTP_FROM` | health_check.py | SMTP sender email (default: SMTP_USER) |
| `RESEND_API_KEY` | autoapply/email_sender.py | Resend email service API key |
| `VK_API_TOKEN` | marketing_cron.py, autoapply/autoapply_main.py | VKontakte API token |
| `VK_GROUP_ID` | marketing_cron.py | VK group ID (default: 237549969) |
| `VK_ACCESS_TOKEN` | content_marketing/config.py | VK access token (alternate) |
| `TG_CHANNEL` | marketing_cron.py | Telegram channel handle (default: @resumeai_channel) |
| `WEBAPP_BASE_URL` | marketing_cron.py, autoapply/config.py | Web app base URL (default: https://resumeai-bot.ru) |
| `AUTOAPPLY_API` | marketing_cron.py | AutoApply API URL (default: http://127.0.0.1:8080) |
| `REDDIT_CLIENT_SECRET` | content_marketing/config.py, scripts/reddit_outreach.py | Reddit OAuth secret |
| `REDDIT_PASSWORD` | content_marketing/config.py, scripts/reddit_outreach.py | Reddit account password |
| `MAINTENANCE` | maintenance.py | Enable/disable maintenance mode ('1'/'true'/'yes') |
| `OPENAI_MODEL` | autoapply/autoapply_main.py | OpenAI model name (default: gpt-4o-mini) |

**High-Risk Secrets:** `BOT_TOKEN`, `OPENAI_API_KEY`, `STRIPE_SECRET_KEY`, `CRYPTOBOT_TOKEN`, `ENCRYPTION_KEY`, `LINKEDIN_FERNET_KEY`, `SMTP_PASSWORD`, `REDDIT_CLIENT_SECRET`

---

## 6. Python Dependencies Analysis

### 6.1 Core Packages (Framework + Business Logic)

| Package | Version | Import Status | Purpose | Notes |
|---------|---------|----------------|---------|-------|
| `aiogram` | 3.27.0 | USED | Telegram bot framework | Async handlers, FSM, callbacks |
| `fastapi` | 0.136.1 | USED | Web API framework | REST API, middleware, validation |
| `uvicorn[standard]` | 0.46.0 | POSSIBLY_UNUSED | ASGI server | Likely imported via FastAPI runner |
| `stripe` | 15.1.0 | USED | Payments library | Checkout, webhooks, customer mgmt |
| `openai` | 2.33.0 | USED | LLM API client | Resume generation, analysis, interviews |
| `playwright` | >=1.40,<2.0 | USED | Browser automation | Job scraping, form filling |
| `sqlalchemy` | >=2.0,<3.0 | USED | ORM | Database models, async sessions |
| `aiohttp` | >=3.9,<4.0 | USED | Async HTTP client | API requests, webhooks |
| `aiosqlite` | 0.22.1 | USED | Async SQLite | Direct SQLite queries for analytics |
| `requests` | >=2.31,<3.0 | USED | HTTP client | Sync requests (legacy or fallback) |
| `httpx` | 0.28.1 | USED | Async HTTP client | API requests |
| `beautifulsoup4` | >=4.12,<5.0 | POSSIBLY_UNUSED | HTML parser | Job posting parsing (likely unused now) |
| `fpdf2` | >=2.7,<3.0 | USED | PDF generation | Resume PDFs |
| `reportlab` | >=4.0,<5.0 | USED | PDF toolkit | Advanced PDF features |
| `apscheduler` | >=3.10,<4.0 | USED | Job scheduler | Cron jobs, repeating tasks |
| `python-jose[cryptography]` | 3.5.0 | USED | JWT/JWE | API auth, token signing |
| `bcrypt` | 5.0.0 | USED | Password hashing | User auth |
| `cryptography` | 47.0.0 | USED | Crypto primitives | Fernet encryption for LinkedIn creds |
| `python-dotenv` | >=1.0,<2.0 | USED | Env loading | .env file parsing |
| `python-multipart` | 0.0.27 | USED | Form parsing | File uploads, multipart forms |
| `greenlet` | >=3.0,<4.0 | POSSIBLY_UNUSED | Async support | May be indirect dependency of SQLAlchemy |
| `aiocryptopay` | 0.4.8 | USED | CryptoBot API | Crypto payments |
| `dnspython` | 2.8.0 | USED | DNS library | Email validation |

**Summary:** 23 core packages, 20 actively used, 3 possibly unused (beautifulsoup4, greenlet, uvicorn)

---

### 6.2 Monitoring / Observability

| Package | Version | Import Status | Purpose | Notes |
|---------|---------|----------------|---------|-------|
| `sentry-sdk[fastapi]` | 2.58.0 | USED | Error tracking | Exception logging, performance monitoring |
| `posthog` | 7.13.2 | USED | Product analytics | User behavior tracking, funnels |

**Summary:** 2 observability packages, both actively used. Strong monitoring infrastructure.

---

### 6.3 Resilience / Retry

| Package | Version | Import Status | Purpose | Notes |
|---------|---------|----------------|---------|-------|
| `tenacity` | 9.1.4 | USED | Retry decorator | Exponential backoff for API calls |

---

### 6.4 Social / Marketing

| Package | Version | Import Status | Purpose | Notes |
|---------|---------|----------------|---------|-------|
| `tweepy` | >=4.14,<5.0 | USED | Twitter API | Twitter posting and monitoring |
| `praw` | >=7.7,<8.0 | USED | Reddit API | Subreddit posting and scraping |

**Summary:** Marketing/content automation packages — should be extracted or killed based on rebuild priorities.

---

### 6.5 Summary Table

| Category | Package Count | Actively Used | Recommendation |
|----------|---------------|--------------|-----------------|
| Core (Framework + Business) | 23 | 20 | Keep all; investigate beautifulsoup4, greenlet, uvicorn |
| Monitoring | 2 | 2 | Keep both |
| Resilience | 1 | 1 | Keep |
| Social/Marketing | 2 | 2 | Extract or kill (low priority) |
| **Total** | **28** | **25** | **3 candidates for removal** |

---

## 7. Scripts and Docs

### 7.1 Scripts Directory (`scripts/`)

| Script | Description | Classification | Rationale |
|--------|-------------|-----------------|-----------|
| `auto_blogger.py` | Generates AI blog posts using OpenAI | KILL | Content marketing — separate module, low rebuild priority |
| `backup_db.sh` | Backs up bot.db and autoapply.db to dated archives | KILL | Infrastructure — should use Docker volumes, K8s backups, or managed services |
| `check_i18n.py` | Validates i18n translations (data-i18n keys vs translation files) | KEEP_AS_IS | Useful QA tool; can be adapted to new i18n strategy |
| `check_ssl.sh` | SSL cert expiration checker, alerts admin via Telegram | KILL | Infrastructure — use Kubernetes cert-manager or Let's Encrypt auto-renewal |
| `deploy.sh` | Safe deploy script (never uses --delete-excluded) | KILL | Infrastructure — replace with Kubernetes/Docker deployment |
| `deploy_report_timer.sh` | Systemd timer runner for daily reporting | KILL | Infrastructure — use Kubernetes CronJob or APScheduler |
| `email_drip_cron.py` | Email drip campaign executor (multi-step sequences) | KEEP_PORT | Core user engagement; port to new job scheduler |
| `email_outreach.py` | Cold email outreach (extract emails, generate pitches with AI, log deliverability) | KEEP_PORT | Core lead generation; port domain logic to new stack |
| `lead_scraper.py` | Job posting scraper (multiple job boards, AI enrichment) | KEEP_PORT | Core data collection; port scraper logic to new stack |
| `reconcile_payments.py` | Payment reconciliation (match Stripe/Crypto events with user actions) | KEEP_PORT | Critical financial ops; port to new accounting system |
| `reddit_outreach.py` | Reddit marketing (generate posts, submit to subreddits with backlinks) | KILL | Content marketing — separate module |
| `resumeai-report.service` | Systemd service for daily_reporter.py | INVESTIGATE | Check if still needed; likely replaced by Kubernetes Service |
| `resumeai-report.timer` | Systemd timer for daily_reporter.py | INVESTIGATE | Check if still needed; likely replaced by Kubernetes CronJob |
| `send_daily_report.sh` | Bash wrapper for daily_reporter.py | KILL | Infrastructure — inline into Python or use container entrypoint |
| `smoke_test_payments.py` | Payment API test (Stripe/Crypto checkout, webhooks) | KEEP_PORT | Critical QA; port to new test framework |
| `telegram_outreach.py` | Telegram outreach (find job posting groups, send bot invites) | KILL | Marketing-only; low rebuild priority |
| `twitter_poster.py` | Twitter automation (post job tips, monitor mentions, reply with DMs) | KILL | Content marketing — separate module |
| `weekly_blog.py` | Weekly blog generator (SEO content automation) | KILL | Content marketing — separate module |

**Summary:**
- **KEEP_PORT:** 5 scripts (email_drip, email_outreach, lead_scraper, reconcile_payments, smoke_test)
- **KILL:** 10 scripts (bash/shell infrastructure, marketing/content, Telegram directory)
- **INVESTIGATE:** 2 scripts (systemd units — may be obsolete)
- **KEEP_AS_IS:** 1 script (i18n validation)

---

### 7.2 Docs Directory (`docs/`)

| File | Description | Classification | Rationale |
|------|-------------|-----------------|-----------|
| `docs/architecture/29-canonical-structure.md` | System architecture overview (bot, autoapply, payments, analytics) | KEEP_AS_IS | Reference documentation; useful for rebuild planning |
| `docs/runbooks/deploy.md` | Deployment runbook | KILL | Infrastructure docs — rewrite for new deployment model |
| `docs/runbooks/incident-bot-down.md` | Bot outage incident response | KEEP_PORT | Adapt runbook to new stack; logic remains applicable |
| `docs/runbooks/incident-payment-stuck.md` | Payment stuck incident response | KEEP_PORT | Adapt runbook to new stack; payment logic transfers |
| `docs/runbooks/restore-db.md` | Database restoration procedures | KEEP_PORT | Adapt to new backup/restore strategy; domain logic applies |

**Summary:**
- **KEEP_AS_IS:** 1 doc (architecture reference)
- **KEEP_PORT:** 3 docs (incident response, restore procedures)
- **KILL:** 1 doc (deployment — rewrite for new infra)

---

## 8. Key Findings & Recommendations

### 8.1 Architecture Observations

1. **Clear separation of concerns:**
   - Bot (Telegram via aiogram)
   - AutoApply service (FastAPI REST API)
   - Analytics layer (read-only views into bot.db)
   - Payments (Stripe + CryptoBot)

2. **Multi-stage hardening approach:**
   - Security stage: CORS, SSRF, idempotency, encryption
   - Reliability stage: Sentry, rate limiting, self-healing
   - Operations stage: health checks, monitoring, backups

3. **Internationalization (Russian + English):**
   - i18n is deeply embedded in UI, marketing, and legal docs
   - 163 files contain Cyrillic; first-class Russian support needed

4. **Data flow complexity:**
   - Bot reads user input → stores in bot.db
   - AutoApply service has separate user pool → autoapply.db
   - Analytics layer aggregates bot.db only (not autoapply.db)
   - Payments scattered between bot.db (legacy) and autoapply.db (new)

### 8.2 Extraction Candidates

**High Priority (Core logic):**
- Resume/cover letter generation (OpenAI integration)
- Interview simulator (multi-turn conversation)
- Vacancy analysis (job posting evaluation)
- Payment reconciliation (Stripe + Crypto)
- Job scraping (Playwright-based vacancy collection)
- Email drip campaigns (user engagement)
- LinkedIn credential vault (Fernet encryption)

**Medium Priority (Operational):**
- Health monitoring (bot.db, autoapply.db, disk, processes)
- Self-healing agent (lock cleanup, rate limit resets)
- Daily/hourly reporting (analytics aggregation)
- Backup procedures (database snapshots)
- Pre-deployment checks (API validation)

**Low Priority (Delete):**
- Marketing automation (Twitter, Reddit, social posting)
- SEO automation (blog generation, sitemap submission)
- Bash/shell scripts (modernize with container orchestration)

### 8.3 Database Design Notes

- **bot.db:** Tightly coupled to Telegram bot logic; read-heavy for analytics
- **autoapply.db:** Growing rapidly with users, campaigns, applications; needs careful migration strategy
- **No foreign keys across databases** — clean separation but complex sync logic
- **Crypto/Stripe events** stored separately — reconciliation logic needed

### 8.4 Security Concerns

- **26 environment variables** including 8+ high-risk secrets
- **Fernet encryption** used for LinkedIn credentials (good)
- **JWT with weak default secret** ("autoapply-change-in-production-2025" in code)
- **No audit logging** for sensitive operations (password resets, payment changes)
- **SMTP/email credentials in env** — should use secrets manager

### 8.5 Test Coverage

- **auto_test.py:** Smoke tests exist but limited
- **smoke_test_payments.py:** Payment flow testing (good)
- **tests/test_autoapply.py:** Some unit tests
- **No integration tests** for full user flows
- **No load tests** before scaling

---

## 9. Rebuild Priority Matrix

| Component | Criticality | Complexity | Extract First | Notes |
|-----------|------------|-----------|----------------|-------|
| Payment processing | CRITICAL | High | Yes | Stripe + Crypto; compliance-heavy |
| Resume generation | CRITICAL | High | Yes | OpenAI integration, format/accuracy |
| Job scraping | CRITICAL | High | Yes | Playwright-based, multi-platform |
| Email drip campaigns | HIGH | Medium | Yes | User engagement, retention |
| Analytics/reporting | HIGH | Medium | Yes | PostHog/Sentry integration |
| Health monitoring | MEDIUM | Low | Yes | Operational awareness |
| LinkedIn vault | MEDIUM | Low | Yes | Fernet encryption, credential mgmt |
| Bot core handlers | MEDIUM | High | Later | Aiogram logic; can be refactored |
| Marketing automation | LOW | Medium | No | Content/social; separate rebuild phase |
| SEO/directory submission | LOW | Low | No | Marketing-only; not core product |

---

## 10. Migration Checklist

- [ ] Extract resume/cover letter generation logic
- [ ] Extract job scraping engine (Playwright)
- [ ] Extract payment reconciliation (Stripe + Crypto events)
- [ ] Extract email/drip campaign logic
- [ ] Port analytics aggregation queries
- [ ] Port LinkedIn credential encryption scheme
- [ ] Migrate bot.db schema (understand existing structure)
- [ ] Migrate autoapply.db schema (preserve all tables/indexes)
- [ ] Rewrite health checks for new stack
- [ ] Rewrite deployment procedures (K8s/Docker)
- [ ] Review and update all 26 environment variables
- [ ] Build comprehensive test suite (unit, integration, smoke)
- [ ] Document new architecture and runbooks
- [ ] Validate Russian i18n support in new UI
- [ ] Set up Sentry + PostHog in new stack

---

## Appendix: File Structure

```
resume-ai/
├── bot/                          # Telegram bot (aiogram)
│   ├── handlers/
│   ├── utils/
│   │   └── bot_translations.py   (4,243 Cyrillic lines)
│   └── main.py
├── autoapply/                    # FastAPI service
│   ├── autoapply_main.py
│   ├── autoapply_db.py
│   ├── config.py
│   ├── crypto.py
│   ├── english_job_engine.py
│   ├── payments.py
│   ├── email_sender.py
│   ├── worker.py
│   └── static/app.html           (12,470 Cyrillic lines)
├── api/                          # REST API routes
│   └── routes/
├── seo/                          # SEO/marketing (to KILL)
├── landing/                      # Static landing pages
├── scripts/                      # Standalone utilities
├── docs/                         # Architecture + runbooks
├── analytics_db.py               (analytics layer)
├── analytics_tracker.py          (event logging)
├── run.py                        (FastAPI server)
├── daily_reporter.py             (reporting service)
├── dashboard.py                  (Streamlit UI)
├── health_check.py               (monitoring)
├── backup.py                     (backup utility)
├── requirements.txt              (28 dependencies)
└── README_*.md                   (project docs)
```

---

**Report generated:** 2026-05-14  
**Auditor:** Claude Code (READ-ONLY)  
**Next step:** Prioritize extraction tasks and begin modular rebuild
