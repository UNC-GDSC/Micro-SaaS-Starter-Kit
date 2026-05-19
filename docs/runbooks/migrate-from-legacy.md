# Runbook: Legacy SQLite → Postgres Migration

Migrates users, campaigns, and job-application history from the original
Python Telegram-bot SQLite databases (`bot.db` + `autoapply.db`) into the
new ResumeAI Postgres instance.

**Estimated time:** 5–15 minutes for a typical dataset (< 50 k applications).

---

## Prerequisites

| What | Why |
|---|---|
| Node.js 20 + `npx ts-node` available locally | Runs the migration script |
| `better-sqlite3` installed (`npm ci --legacy-peer-deps`) | Reads legacy DBs |
| Prisma client generated (`npx prisma generate`) | Writes to Postgres |
| `DATABASE_URL` pointing at the **new** Postgres | Target database |
| `ENCRYPTION_KEY` set to the **exact** legacy value | Validates Fernet token |
| The two legacy SQLite files on your machine | Source databases |

The legacy `ENCRYPTION_KEY` is:
```
bV4UmliwP4xFApJTnq5O5XxJ4mltOC4bjrQQ7EdCUtc=
```
> ⚠️ **Critical:** The `linkedinPasswordEnc` values are copied verbatim from
> the legacy DB. The worker decrypts them using this exact key. If you change
> the key or re-encrypt with a different one, auto-apply will break silently.

---

## Step 0 — Back up the target database

Always take a snapshot before running any bulk migration.

```bash
# From VPS (or wherever Docker Compose runs):
ssh root@72.56.250.53 "bash /opt/resumeai/scripts/backup_db.sh"
```

Verify the backup file appeared:
```bash
ssh root@72.56.250.53 "ls -lh /backups/resumeai-*.sql.gz | tail -3"
```

---

## Step 1 — Copy the SQLite files to your machine

The legacy files live on the old VPS (or wherever the bot ran last).

```bash
# Adjust the source paths to match your legacy setup:
scp root@<OLD_VPS_IP>:/home/bot/data/bot.db        ./legacy/bot.db
scp root@<OLD_VPS_IP>:/home/autoapply/autoapply.db  ./legacy/autoapply.db
```

If the files are already local, skip this step.

---

## Step 2 — Set environment variables

```bash
export DATABASE_URL="postgresql://resumeai:resumeai@localhost:5432/resumeai"
# ↑ If running locally with port-forwarded Postgres; adjust as needed.
# For direct VPS: ssh tunnel or use DATABASE_URL from /opt/resumeai/.env

export ENCRYPTION_KEY="bV4UmliwP4xFApJTnq5O5XxJ4mltOC4bjrQQ7EdCUtc="
```

Or create a `.env.migration` file and source it:
```bash
source .env.migration
```

---

## Step 3 — Dry run first

A dry run performs every step but wraps the whole thing in a Prisma
transaction and rolls back at the end. **Nothing is written to Postgres.**

```bash
npx ts-node --project tsconfig.scripts.json scripts/migrate-from-legacy.ts \
  --legacy-dir ./legacy \
  --dry-run
```

Expected output (numbers will differ):
```
[DRY-RUN] Starting migration …
✔ Pre-flight passed: bot.db and autoapply.db found with expected tables
✔ ENCRYPTION_KEY validated against a real legacy ciphertext
Migrating users …      50 upserted, 0 errors
Migrating campaigns …  12 upserted, 0 errors
Migrating applications … 4 832 upserted, 0 errors
[DRY-RUN] All changes rolled back — no data written
Migration summary: 50 users, 12 campaigns, 4 832 applications, 0 errors
```

If the summary shows errors, fix them before continuing.

---

## Step 4 — Run the real migration

```bash
npx ts-node --project tsconfig.scripts.json scripts/migrate-from-legacy.ts \
  --legacy-dir ./legacy
```

The script is **idempotent** — re-running it is safe and will upsert rather
than duplicate. The key idempotency constraints are:

| Model | Upsert key |
|---|---|
| User | `legacyId` (bot.db `id`) |
| AutoApplyCampaign | `(userId, hhResumeId)` |
| JobApplication | `(userId, vacancyId, appliedAt)` |

---

## Step 5 — Verify the migration

Copy the SQL script to the VPS (or run directly against a local DB):

```bash
# Option A — against a local port-forwarded Postgres:
psql "$DATABASE_URL" -f scripts/verify-migration.sql | grep -E 'PASS|FAIL|result'

# Option B — via the Docker container on the VPS:
scp scripts/verify-migration.sql root@72.56.250.53:/tmp/
ssh root@72.56.250.53 \
  "docker compose exec -T postgres \
     psql -U resumeai resumeai -f /tmp/verify-migration.sql" \
  | grep -E 'PASS|FAIL'
```

All lines should read `PASS`. A `FAIL` line prints the count of offending rows
and the check name — investigate those rows before proceeding.

---

## Step 6 — Smoke test the application

```bash
# Full end-to-end smoke test against the live URL:
BASE_URL=https://resumeai-bot.ru bash scripts/smoke_test.sh

# Or against a locally running stack:
BASE_URL=http://localhost:3000 bash scripts/smoke_test.sh
```

Log in with a migrated user's email and verify:
- Their old campaigns appear in the dashboard
- The application history count matches what you saw in `verify-migration.sql`
- Auto-apply can decrypt the LinkedIn password (start a test campaign with
  `dry_run=true` via the worker API if you want a non-destructive check)

---

## Rollback

If something went wrong after the real migration:

```bash
ssh root@72.56.250.53
cd /opt/resumeai

# List available backups (most recent last):
ls -lth /backups/resumeai-*.sql.gz | head

# Restore (replace timestamp below):
docker compose exec -T postgres \
  psql -U resumeai -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"

gunzip -c /backups/resumeai-20260514_030000.sql.gz \
  | docker compose exec -T postgres psql -U resumeai resumeai
```

> Prisma does **not** generate down-migrations. Restore from the backup taken
> in Step 0 — do not attempt to reverse the migration manually.

---

## Troubleshooting

### `ENCRYPTION_KEY validation failed`
The key in your environment doesn't match the legacy key used to encrypt
`linkedin_password_enc`. Check:
- `echo $ENCRYPTION_KEY` — must be exactly `bV4UmliwP4xFApJTnq5O5XxJ4mltOC4bjrQQ7EdCUtc=`
- No trailing newline or extra whitespace: `echo -n "$ENCRYPTION_KEY" | wc -c` → should be 44

### `legacy/bot.db not found`
Run `ls legacy/` and adjust `--legacy-dir` to point to the folder that
contains both `bot.db` and `autoapply.db`.

### `Missing expected table: …`
The legacy DB is from a different version. Check the schema with:
```bash
sqlite3 legacy/bot.db ".tables"
sqlite3 legacy/autoapply.db ".tables"
```
Update the pre-flight check in `migrate-from-legacy.ts` or rename the
columns as needed.

### Migration runs but user count is 0
Make sure `DATABASE_URL` points at the **new** Postgres and that Prisma can
reach it:
```bash
npx prisma db execute --stdin <<< "SELECT COUNT(*) FROM \"User\";"
```

### Duplicate key errors on re-run
This should not happen because all inserts use upserts, but if it does:
```sql
-- Find offending rows:
SELECT "legacyId", COUNT(*) FROM "User"
WHERE "legacyId" IS NOT NULL
GROUP BY "legacyId" HAVING COUNT(*) > 1;
```

---

## Notes

- **Sessions are not migrated** — legacy NextAuth (or Python) session tokens
  are not imported. All users will need to log in fresh. This is intentional:
  the new `NEXTAUTH_SECRET` is different, making old tokens invalid anyway.
- **Passwords are not migrated** — the legacy bot had no passwords; users
  authenticate via OAuth (Google/GitHub) or magic-link email.
- **`linkedinPasswordEnc` is copied verbatim** — the Fernet ciphertext is
  preserved as-is. The worker uses the same `ENCRYPTION_KEY` to decrypt.
  Changing the key without re-encrypting will break auto-apply for all campaigns.
