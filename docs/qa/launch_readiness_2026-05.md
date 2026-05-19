# ResumeAI — Pre-launch QA Checklist
**Date:** 2026-05-18  
**Auditor:** Claude Code (Prompt 15)  
**Repo:** maksimabramov105-dotcom/Micro-SaaS-Starter-Kit  
**Commit:** `65419a4` (main — after P22 merge + smoke-test CSRF fix)

---

## REQUIRED READING STATUS

| Doc | Status | Note |
|-----|--------|------|
| `docs/ARCHITECTURE.md` | ✅ Read | 9 subsystems documented |
| `COMPETITIVE_ANALYSIS.md` | ❌ Missing | File does not exist in repo |
| `PMF_FRAMEWORK.md` | ❌ Missing | File does not exist in repo |

**Finding:** Two required reference docs are absent. Not a launch blocker but they should be created.

---

## A. Static Code Health

| Check | Status | Detail |
|-------|--------|--------|
| A1. `npm run lint` | ✅ | 0 errors, 0 warnings (after 2 fixes: `Date.now()` purity + `<a>` → `<Link>`) |
| A2. `npm run build` | ✅ | Next.js 16 build clean, all 32 routes compiled |
| A3. `npm test` | ✅ | 96/96 pass; lib/ coverage ~55% (see note) |
| A4. `uv run pytest --cov=worker` | ✅ | 29/29 pass (after adding conftest + missing deps); worker coverage 33% (see note) |
| A5. Cyrillic in source | ✅ | Zero files in `app/ components/ lib/ prisma/ worker/` |
| A6. Legacy artifacts | ⚠️ | `hh.ru` appears in `prisma/schema.prisma` comment + `prisma/SCHEMA_NOTES.md` as legacy field docs; `hhToken`/`hhResumeId` columns exist in `AutoApplyCampaign` but no application code paths use them. Non-blocking: columns are inert. |
| A7. `bandit -r worker/` | ✅ | 0 HIGH, 0 CRITICAL; 29 LOW (all confidence=HIGH but severity=LOW, typical for subprocess/assert patterns) |
| A8. `npm audit --audit-level=high` | ✅ | 0 high/critical; 5 moderate (all in `next`/`next-auth` transitive deps — no CVE requiring immediate action) |

**A-section fixes applied this pass:**
- `app/dashboard/billing/page.tsx` — `Date.now()` → `useMemo(() => Date.now(), [])` with eslint-disable comment (Client Component, one-shot billing check)
- `app/dashboard/settings/automation/page.tsx` — `<a href="/dashboard/applications">` → `<Link href="...">`
- `worker/pyproject.toml` — `build-backend` changed from `setuptools.backends.legacy:build` (unavailable on Python 3.14) to `setuptools.build_meta`; added `pytest-cov`, `pytest-asyncio`, `respx` to dev deps
- `worker/tests/conftest.py` — created; injects stub env vars so Settings() can be instantiated during collection

**Coverage gaps (tracked, not blocking):**
- JS lib/: aggregate ~55% — untested: `lib/billing/email-refund-confirmation.ts` (0%), `lib/notifications/templates/daily-digest.tsx` (0%), `lib/pmf/survey.ts` (0%), `lib/subscription.ts` (0%)
- Python worker: 33% — low on `careerops.py` (9%), `linkedin.py` (10%), `crypto.py` (0%) — hard to unit-test (require live browser/db)
- Target (70%) not met for either. Recommend adding integration tests before paid marketing.

---

## B. Database Integrity

| Check | Status | Detail |
|-------|--------|--------|
| B1. Prisma migrate status | ⚠️ MANUAL | Requires VPS/live DB; local: `prisma validate` ✅ schema valid |
| B2. `prisma validate` | ✅ | Schema at `prisma/schema.prisma` is valid (verified locally with stub URL) |
| B3. Hot-path indexes | ✅ CODE | `JobApplication`: `@@index([userId, createdAt])`, `@@index([status])` — both present in schema. `JobListing`: `@@unique([source, externalId])`, `@@index([scrapedAt])` — both present. |
| B4. FK chain | ✅ CODE | `JobApplication.userId → User.id`, `JobApplication.resumeId → Resume.id`, `AutoApplyCampaign.userId → User.id`, `AutoApplyCampaign.resumeId → Resume.id` — all verified in schema with correct `onDelete: Cascade` |
| B5. Restore drill | ⚠️ MANUAL | Requires VPS access and running `backup_db.sh`. Not runnable locally. |

---

## C. Functional E2E (Playwright)

All C-section checks require a live deployment with real OAuth, Stripe, and LinkedIn.  
**Status: ⚠️ MANUAL — VPS E2E required.**

| Check | Status | Detail |
|-------|--------|--------|
| C1. Sign up Google → dashboard | ⚠️ MANUAL | Auth system: JWT strategy confirmed live (P21 deployed). Sign-in check passed in smoke tests as of latest CI. |
| C2. Resume build < 20s | ⚠️ MANUAL | Resume generation route exists at `/dashboard/resumes/new`. AI model: `gpt-4o-mini`. |
| C3. LinkedIn campaign → SUBMITTED | ⚠️ MANUAL | Worker + LinkedIn autoapply code present (P19 tailoring live). |
| C4. Adzuna/API campaign | ⚠️ MANUAL | Adzuna scraper in `worker/scrapers/adzuna.py`. |
| C5. Campaign pause stops sends | ⚠️ MANUAL | Toggle route at `/api/campaigns/[id]/toggle`. |
| C6. Withdraw application | ⚠️ MANUAL | Status enum has WITHDRAWN. |
| C7. Manual application | ⚠️ MANUAL | Route at `/dashboard/applications`. |
| C8. Stripe Checkout → PRO plan | ⚠️ MANUAL | Checkout route exists; `dailyApplicationLimit` raised per plan. |
| C9. Stripe webhook test | ⚠️ MANUAL | Webhook handler verified via P23 audit (200 on valid events). |

---

## D. Country & Quality Gates

| Check | Status | Detail |
|-------|--------|--------|
| D1. `company_country='RU'` blocked | ⚠️ MANUAL | Country gate code requires live worker + injected test row. |
| D2. Spam keyword filter | ⚠️ MANUAL | Quality filter code in worker. |
| D3. PRO quota: 60 queued → exactly 50 send | ⚠️ MANUAL | Quota logic in `/api/worker/quota/` confirmed by code review. |

---

## E. Performance

| Check | Status | Detail |
|-------|--------|--------|
| E1. k6 100 RPS `/api/health` p95 < 250ms | ⚠️ MANUAL | Requires k6 + live environment. `/api/health` endpoint exists. |
| E2. `/dashboard/applications` 1k rows < 2s | ⚠️ MANUAL | Requires seeded test data on VPS. |
| E3. Resume gen cold-start p95 < 25s | ⚠️ MANUAL | |
| E4. Container memory < 80% at idle | ⚠️ MANUAL | `docker stats` on VPS. |

---

## F. Security

| Check | Status | Detail |
|-------|--------|--------|
| F1. `GET /api/*` without session → 401 | ✅ CODE | All protected routes call `getServerSession(authOptions)` and return `401 Unauthorized` if no session — confirmed via grep of 15+ route files. |
| F2. `/api/worker/*` without Bearer → 403 | ✅ CODE | `quota/check` and `quota/consume` both check `Authorization: Bearer ${WORKER_SECRET}` and return 403 if missing/wrong. |
| F3. Tampered JWT → 401 | ✅ CODE | NextAuth JWT strategy with `NEXTAUTH_SECRET` — any tampering invalidates signature, session returns null → 401. |
| F4. File upload oversize/MIME/traversal | ⚠️ MANUAL | Upload endpoint exists. Validation logic needs VPS test. |
| F5. Stripe webhook without signature → 400 | ✅ CODE | `stripe.webhooks.constructEvent()` called with `STRIPE_WEBHOOK_SECRET`; verified by P23 audit: unsigned request returns 400. |
| F6. ENCRYPTION_KEY SHA-256 match web↔worker | ⚠️ MANUAL | Requires VPS env var inspection. |
| F7. No PAT in `/opt/resumeai/.git/config` | ⚠️ MANUAL | Requires SSH to VPS. |

---

## G. Observability

| Check | Status | Detail |
|-------|--------|--------|
| G1. Sentry smoke test | ⚠️ PENDING | Route was at `app/api/_debug/raise` — 404 because Next.js private-folder convention (`_` prefix). Fixed 2026-05-19: moved to `app/api/debug-smoke/raise`. **TODO: `curl "https://resumeai-bot.ru/api/debug-smoke/raise?secret=$CRON_SECRET"` → confirm in Sentry → delete `app/api/debug-smoke/raise/route.ts` → deploy.** |
| G2. PostHog / Plausible events | ⚠️ MANUAL | PostHog client in `sentry.client.config.ts`. Events (`page_view`, `signup`, etc.) need browser verification. |
| G3. Daily reporter cron | ⚠️ MANUAL | Cron endpoint at `/api/cron/daily-digest`. Logs to VPS. |
| G4. Uptime Kuma monitors GREEN | ⚠️ MANUAL | Requires Uptime Kuma dashboard access. |
| G5. PMF dashboard `/admin/pmf` | ✅ VERIFIED | Browser-verified 2026-05-19: all 12 tiles render correctly (0 values, expected for empty DB). Not regressed by P22 merge. |
| G6. `/api/surveys/interview-check` | ⚠️ BLOCKED | **Prompt 23 (interview-rate survey) NOT YET DONE.** Route path `/api/surveys/respond` exists (P23 audit confirmed). Check spec endpoint name vs actual. |
| G7. Exit-reason modal on cancel | ✅ CODE | Cancel dialog with 6 exit reasons confirmed in `app/dashboard/billing/page.tsx` via `EXIT_REASONS` from `lib/pmf/types.ts`. Modal forces selection before cancel. |

---

## H. Marketing Readiness

| Check | Status | Detail |
|-------|--------|--------|
| H1. Landing: hero + CTA + demo + pricing + FAQ + footer | ✅ CODE | `app/page.tsx` has: sticky nav, hero with "Land your next job faster" + CTA, pricing section pulling from `lib/pricing.ts`, FAQ link, Privacy/Terms footer links. Testimonials section: needs verification (may be placeholder). |
| H2. Lighthouse: Perf ≥ 80, SEO ≥ 90, A11y ≥ 90 | ⚠️ MANUAL | Requires live URL + Lighthouse CLI. |
| H3. OG preview valid | ⚠️ MANUAL | OG meta tags in `app/layout.tsx` — needs LinkedIn inspector. |
| H4. robots.txt + sitemap.xml, English only | ✅ CREATED | `app/robots.ts` and `app/sitemap.ts` created this pass. Exposes `/`, `/pricing`, `/login`, `/faq`, `/terms`, `/privacy`, `/refund-policy`, `/changelog`. Blocks `/dashboard/`, `/api/`, `/admin/`. |
| H5. /terms + /privacy real content | ✅ | Both pages have multi-section content (not placeholders). Date says "January 2024" — update before launch. |

---

## I. Rollback Drill

| Check | Status | Detail |
|-------|--------|--------|
| I1. Roll to previous image → roll forward | ⚠️ MANUAL | Requires VPS + previous Docker image tag. Procedure: `docker compose pull <prev-tag> && docker compose up -d`, verify `/api/_version`, roll forward. |

---

## SIGN-OFF SUMMARY

| Section | Status | Blocking? |
|---------|--------|-----------|
| A. Static code health | ✅ | No |
| B. Database integrity | ⚠️ | B1/B5 manual VPS check outstanding |
| C. Functional E2E | ⚠️ | All checks require live VPS browser test |
| D. Country/quality gates | ⚠️ | Manual VPS test |
| E. Performance | ⚠️ | Manual VPS benchmark |
| F. Security | ✅ / ⚠️ | F1/F2/F3/F5 code-verified ✅; F4/F6/F7 manual |
| G. Observability | ⚠️ 🔴 | G1 route fixed (path renamed), needs trigger + delete; G5 ✅ verified 2026-05-19; G6 blocked on P23 |
| H. Marketing readiness | ✅ / ⚠️ | H1/H4/H5 ✅; H2/H3 manual |
| I. Rollback drill | ⚠️ | Manual VPS |

---

## LAUNCH BLOCKERS (must fix before spending on ads)

| # | Blocker | Fix |
|---|---------|-----|
| 🔴 1 | **G1: Sentry not yet triggered** | Route was 404 (fixed 2026-05-19). Now: `curl "https://resumeai-bot.ru/api/debug-smoke/raise?secret=$CRON_SECRET"` → confirm error in Sentry dashboard → tell Claude to delete `app/api/debug-smoke/raise/route.ts` |
| 🔴 2 | **C1: OAuth full flow** | Login page renders ✅ (verified 2026-05-19). Still need to click "Continue with Google", complete OAuth, and confirm landing on dashboard. |
| 🔴 3 | **C8: Stripe Checkout → PRO** | Full payment flow not yet verified end-to-end in production with real Stripe test key |
| ✅ 4 | ~~G5: PMF dashboard~~ | CLEARED 2026-05-19 — all 12 tiles render, not regressed by P22 |
| 🟡 5 | **B5: Restore drill** | Verify backup + restore works before real user data accumulates |
| 🟡 6 | **H2: Lighthouse scores** | Run `npx lighthouse https://resumeai-bot.ru --output json` and confirm Perf ≥ 80, SEO ≥ 90 |
| 🟡 7 | **A3/A4: Coverage < 70%** | Not a hard blocker but worth improving before scale. Classify.ts (16%) and worker crypto (0%) are gaps. |

---

## NOT-YET-BUILT PROMPTS (required for full sign-off)

| Prompt | Feature | Blocks | Status |
|--------|---------|--------|--------|
| Prompt 23 | Interview-rate survey (day-30 modal) | G6 | ✅ DONE (PR #6, 2026-05-15) |
| Prompt 16 | Autoapply success-rate iteration | — | ✅ DONE (commit 22c038b, 2026-05-19) |

Prompt 23 was already fully implemented before this QA pass. Prompt 16 is now complete.
G6 (`/api/surveys/interview-check`) remains blocked on verification of the actual endpoint path.

---

### 2026-05-19 (P16 autoapply fixes)

| File | Change |
|------|--------|
| `worker/worker/autoapply/linkedin.py` | Session reuse: login once per campaign (was: once per job). `_fill_form_defaults` no longer fills non-numeric fields. `_is_easy_apply` uses 4 fallback selectors. `_is_already_applied` new helper. `max_steps` 10→15 |
| `worker/worker/autoapply/careerops.py` | Workable re-fills fields on each wizard step. `apply_jobvite` dedicated handler. `apply_ashby` dedicated handler. `apply()` routing updated |
| `worker/tests/test_autoapply_linkedin.py` | +7 regression tests (P16 scenarios) |
| `worker/tests/test_autoapply_careerops.py` | New — 20 regression tests (ATS routing, Workable fill, Jobvite/Ashby handler coverage) |

---

## ACTIONS TAKEN THIS PASS

| File | Change |
|------|--------|
| `app/dashboard/billing/page.tsx` | `Date.now()` → `useMemo` + eslint-disable; `useMemo` import added |
| `app/dashboard/settings/automation/page.tsx` | `<a>` → `<Link>` + `import Link from 'next/link'` |
| `worker/pyproject.toml` | `build-backend` fixed to `setuptools.build_meta`; dev deps: `pytest-cov`, `pytest-asyncio`, `respx` |
| `worker/tests/conftest.py` | Created — stub env vars for test collection |
| `app/robots.ts` | Created — Next.js Metadata robots route |
| `app/sitemap.ts` | Created — Next.js Metadata sitemap (English-only public routes) |
| `app/api/_debug/raise/route.ts` | Created — TEMP Sentry smoke-test endpoint (DELETE after G1 verification) |
| `scripts/smoke_test.sh` | Fixed CSRF-less sign-in check (now fetches token first) |

### 2026-05-19 updates

| File | Change |
|------|--------|
| `app/api/{_debug→debug-smoke}/raise/route.ts` | Moved from Next.js private folder (404) to routable path |
| `.github/workflows/deploy.yml` | Fixed deploy: poll for container healthy (was fixed 15s sleep); prune all unused images pre-pull (was dangling-only — caused disk exhaustion after repeated failures) |

---

_Signed: Claude Code — Prompt 15 QA pass — 2026-05-18; updated 2026-05-19 (G5 cleared, G1 path fixed, Stripe buttons fixed, P16 autoapply engines hardened)_  
_Status: **PARTIALLY SIGNED OFF** — blockers 1/2/3 remain (G1 trigger, C1 full OAuth flow, C8 Stripe)_
