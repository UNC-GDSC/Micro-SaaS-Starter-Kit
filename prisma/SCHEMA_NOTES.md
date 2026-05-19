# Schema Notes

Reference for developers working on the ResumeAI data layer.

---

## Model relationships

```
User
 ├── Resume[]            (one user, many resumes)
 │    ├── JobApplication[]   (a resume can be used across many applications)
 │    └── AutoApplyCampaign[] (a campaign is pinned to one resume at creation)
 ├── JobApplication[]    (direct link for manual/one-off applications)
 └── AutoApplyCampaign[] (a user can run several campaigns in parallel)

JobApplication
 └── ApplicationEvent[]  (immutable audit trail: submitted, viewed, interview_requested …)

AutoApplyCampaign
 └── JobApplication[]    (all applications spawned by this campaign)
```

---

## Why `linkedinPasswordEnc` lives on `AutoApplyCampaign`, not `User`

A single ResumeAI user can operate **multiple LinkedIn accounts simultaneously** — for
example a recruiter managing candidates, or a job-seeker who wants to separate their
"English CV" campaign from their "German CV" campaign with a different regional LinkedIn
profile.

Storing credentials on `User` would enforce a one-to-one constraint that the product
does not impose.  Storing them on the campaign keeps each set of credentials scoped to
its purpose and means revoking one campaign never affects another.

The same logic applies to `hhToken` / `hhResumeId` (HeadHunter OAuth) — a user may have
two hh.ru accounts (personal + corporate).

**Encryption:** both `linkedinPasswordEnc` and `hhToken` are Fernet-encrypted at the
application layer using `ENCRYPTION_KEY` before write, and decrypted on read inside the
worker.  The DB stores only ciphertext — a DB dump alone cannot recover credentials.

---

## Legacy field mapping

Every column from the old SQLite databases is accounted for below.  The migration
script in `scripts/migrate-from-legacy.ts` (Prompt 8) uses this table as its source of
truth.

### `bot.db`.`users` → `User`

| Legacy column | New field | Notes |
|---|---|---|
| `telegram_id` | `legacyId` | Stored as `Int?`; used as join key during migration |
| `username` | `telegramUsername` | Telegram @handle, nullable |
| `full_name` | `name` | Already on User |
| `referral_code` | — | Feature cut; not carried forward |
| `referred_by` | — | Feature cut |
| `credits_balance` | `credits` | Already on User |
| `total_resumes_generated` | `usageCount` | Seeded during migration |
| `total_assistant_messages` | `UsageRecord` rows | Written as feature=`assistant_message` |
| `total_spent_rub` | `Invoice` rows | Written as historical invoices in RUB |
| `created_at` | `createdAt` | |
| `last_active` | `lastActiveAt` | |

### `autoapply.db`.`autoapply_users` → `User` + `AutoApplyCampaign`

| Legacy column | New field | Notes |
|---|---|---|
| `telegram_id` | `legacyId` | Join key (same as bot.db) |
| `email` | `email` | Already on User |
| `password_hash` | — | Legacy bcrypt hash; users re-auth via magic link |
| `plan` | `stripePriceId` | Mapped to Stripe price during migration |
| `daily_limit` | `dailyApplicationLimit` on User | Plan-level default |
| `applications_today` | — | Derived at runtime from `JobApplication.appliedAt` |
| `applications_total` | `usageCount` (merged) | |
| `responses_received` | — | Derived from `ApplicationEvent` of type `interview_requested` |
| `linkedin_email` | `AutoApplyCampaign.linkedinEmail` | Per-campaign |
| `linkedin_password_enc` | `AutoApplyCampaign.linkedinPasswordEnc` | Per-campaign, Fernet |
| `hh_token` | `AutoApplyCampaign.hhToken` | Per-campaign |
| `hh_resume_id` | `AutoApplyCampaign.hhResumeId` | Per-campaign |
| `resume_text` | `Resume.generated` | Imported as `{ legacy: true, text: "..." }` |
| `is_verified` | `emailVerified` on User | |
| `consent_at` | `Consent` row | Written as type=`tos`, version=`legacy` |
| `stripe_customer_id` | `stripeCustomerId` | |

### `autoapply.db`.`campaigns` → `AutoApplyCampaign`

| Legacy column | New field |
|---|---|
| `job_title` | `name` (campaign name) + `keywords[0]` |
| `location` | `locations[]` |
| `salary_min` | `salaryMin` |
| `experience` | `experience` |
| `platforms` | `source` (enum) |
| `daily_limit` | `dailyLimit` |
| `status` | `isActive` (active/paused → boolean) |
| `applications_sent` | `totalSent` |
| `responses` | `responsesCount` |
| `last_run` | `lastRunAt` |

### `autoapply.db`.`applications` → `JobApplication`

| Legacy column | New field |
|---|---|
| `platform` | `source` (enum) |
| `vacancy_id` | `vacancyId` |
| `vacancy_title` | `jobTitle` |
| `company_name` | `company` |
| `vacancy_url` | `jobUrl` |
| `resume_used` | `resumeId` (FK resolved by matching `Resume.generated.legacy`) |
| `status` | `status` (enum) |
| `sent_at` | `appliedAt` |
| `response_at` | `responseAt` |

### `autoapply.db`.`vacancies_cache` → `JobListing`

| Legacy column | New field |
|---|---|
| `platform` | `source` (enum) |
| `vacancy_id` | `externalId` |
| `title` | `title` |
| `company` | `company` |
| `location` | `location` |
| `salary` | `salary` (free-form text) |
| `description` | `description` |
| `url` | `url` |
| `fetched_at` | `scrapedAt` |
| `applied` | `applied` |

---

## Enum values

### `JobSource`
`LINKEDIN` · `CAREEROPS` · `ADZUNA` · `ARBEITNOW` · `REMOTEOK` · `THEMUSE` · `MANUAL`

Legacy `platforms` column used string tags (`linkedin`, `hh`).  HeadHunter maps to
`CAREEROPS` for now; a dedicated `HH` value can be added in a follow-up migration.

### `ApplicationStatus`
`QUEUED` → `SUBMITTED` → (`INTERVIEW` | `REJECTED` | `OFFER` | `WITHDRAWN`)  
`FAILED` is a terminal state for technical failures (bot crash, captcha, etc.).
