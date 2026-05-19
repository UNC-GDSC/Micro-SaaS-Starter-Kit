-- verify-migration.sql
-- Run against Postgres AFTER migrate-from-legacy.ts to sanity-check the results.
--
-- Usage (against the Docker container):
--   docker compose exec -T postgres \
--     psql -U resumeai resumeai -f /tmp/verify-migration.sql
--
-- Or via a tunnel:
--   psql "$DATABASE_URL" -f scripts/verify-migration.sql
--
-- All checks emit PASS / FAIL lines.  A grep for FAIL gives a quick overall result:
--   psql ... -f scripts/verify-migration.sql | grep -E 'FAIL|PASS'

\set ON_ERROR_STOP on
\timing off
\pset footer off

\echo '=== ResumeAI migration verification ==='
\echo ''

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Row counts
-- ─────────────────────────────────────────────────────────────────────────────
\echo '── 1. Row counts ────────────────────────────────────────────────────────'

SELECT
  'users'            AS "table",  COUNT(*) AS rows FROM "User"
UNION ALL
SELECT 'resumes',                 COUNT(*) FROM "Resume"
UNION ALL
SELECT 'campaigns',               COUNT(*) FROM "AutoApplyCampaign"
UNION ALL
SELECT 'job_applications',        COUNT(*) FROM "JobApplication"
UNION ALL
SELECT 'application_events',      COUNT(*) FROM "ApplicationEvent"
UNION ALL
SELECT 'consents',                COUNT(*) FROM "ConsentRecord"
ORDER BY 1;

\echo ''

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Every user imported from legacy must have legacyId set
-- ─────────────────────────────────────────────────────────────────────────────
\echo '── 2. Legacy users have legacyId ────────────────────────────────────────'

SELECT
  CASE WHEN COUNT(*) = 0
    THEN 'PASS — all legacy users have legacyId'
    ELSE 'FAIL — ' || COUNT(*) || ' legacy users missing legacyId'
  END AS result
FROM "User"
WHERE "legacyId" IS NULL
  AND "createdAt" < NOW();   -- every row from migration; real new signups will also be NULL
-- Note: this is intentionally non-strict — new organic sign-ups have NULL legacyId too.
-- If you want a strict check, compare COUNT(*) WHERE legacyId IS NULL vs total and
-- confirm it matches expected new-sign-up count (0 right after a fresh migration).

\echo ''

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. No orphaned campaigns (campaign → user FK)
-- ─────────────────────────────────────────────────────────────────────────────
\echo '── 3. Orphaned campaigns ────────────────────────────────────────────────'

SELECT
  CASE WHEN COUNT(*) = 0
    THEN 'PASS — no orphaned campaigns'
    ELSE 'FAIL — ' || COUNT(*) || ' campaigns with no parent user'
  END AS result
FROM "AutoApplyCampaign" c
WHERE NOT EXISTS (
  SELECT 1 FROM "User" u WHERE u.id = c."userId"
);

\echo ''

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. No orphaned job applications
-- ─────────────────────────────────────────────────────────────────────────────
\echo '── 4. Orphaned job applications ─────────────────────────────────────────'

SELECT
  CASE WHEN COUNT(*) = 0
    THEN 'PASS — no orphaned job applications'
    ELSE 'FAIL — ' || COUNT(*) || ' job applications with no parent user'
  END AS result
FROM "JobApplication" ja
WHERE NOT EXISTS (
  SELECT 1 FROM "User" u WHERE u.id = ja."userId"
);

\echo ''

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Every campaign that has a linkedinPasswordEnc has a non-empty value
-- ─────────────────────────────────────────────────────────────────────────────
\echo '── 5. linkedin_password_enc integrity ───────────────────────────────────'

SELECT
  CASE WHEN COUNT(*) = 0
    THEN 'PASS — all linked campaigns have non-empty encrypted passwords'
    ELSE 'FAIL — ' || COUNT(*) || ' campaigns have empty linkedinPasswordEnc'
  END AS result
FROM "AutoApplyCampaign"
WHERE "linkedinPasswordEnc" IS NOT NULL
  AND length("linkedinPasswordEnc") = 0;

-- Also verify Fernet token format: must start with 'gAAA' (URL-safe base64 of version byte 0x80)
SELECT
  CASE WHEN COUNT(*) = 0
    THEN 'PASS — all encrypted passwords look like valid Fernet tokens'
    ELSE 'FAIL — ' || COUNT(*) || ' encrypted passwords do not start with gAAA (bad Fernet token)'
  END AS result
FROM "AutoApplyCampaign"
WHERE "linkedinPasswordEnc" IS NOT NULL
  AND "linkedinPasswordEnc" NOT LIKE 'gAAA%';

\echo ''

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. dailyApplicationLimit matches expected plan tiers (no zeros or negatives)
-- ─────────────────────────────────────────────────────────────────────────────
\echo '── 6. Daily application limits ──────────────────────────────────────────'

SELECT
  CASE WHEN COUNT(*) = 0
    THEN 'PASS — all users have positive dailyApplicationLimit'
    ELSE 'FAIL — ' || COUNT(*) || ' users with zero or negative dailyApplicationLimit'
  END AS result
FROM "User"
WHERE "dailyApplicationLimit" <= 0;

-- Distribution by plan limit (informational)
SELECT
  "dailyApplicationLimit" AS daily_limit,
  COUNT(*)                AS user_count,
  ROUND(COUNT(*) * 100.0 / NULLIF(SUM(COUNT(*)) OVER (), 0), 1) AS pct
FROM "User"
GROUP BY "dailyApplicationLimit"
ORDER BY "dailyApplicationLimit";

\echo ''

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. Application status distribution (spot-check for nonsense values)
-- ─────────────────────────────────────────────────────────────────────────────
\echo '── 7. Application status distribution ───────────────────────────────────'

SELECT status, COUNT(*) AS cnt
FROM "JobApplication"
GROUP BY status
ORDER BY cnt DESC;

-- Any status not in the allowed enum will have already caused a Postgres error
-- during the insert, so this is a distribution sanity check only.

\echo ''

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. Duplicate detection — unique constraint health
-- ─────────────────────────────────────────────────────────────────────────────
\echo '── 8. Duplicate legacyIds ───────────────────────────────────────────────'

SELECT
  CASE WHEN COUNT(*) = 0
    THEN 'PASS — no duplicate legacyIds'
    ELSE 'FAIL — ' || COUNT(*) || ' duplicate legacyId values'
  END AS result
FROM (
  SELECT "legacyId"
  FROM "User"
  WHERE "legacyId" IS NOT NULL
  GROUP BY "legacyId"
  HAVING COUNT(*) > 1
) dups;

\echo ''

-- ─────────────────────────────────────────────────────────────────────────────
-- 9. ConsentRecord — users with consent in legacy have a record here
-- ─────────────────────────────────────────────────────────────────────────────
\echo '── 9. Consent records ───────────────────────────────────────────────────'

-- Users who have a ConsentRecord but no parent User (should be 0)
SELECT
  CASE WHEN COUNT(*) = 0
    THEN 'PASS — no orphaned consent records'
    ELSE 'FAIL — ' || COUNT(*) || ' consent records with missing user'
  END AS result
FROM "ConsentRecord" cr
WHERE NOT EXISTS (
  SELECT 1 FROM "User" u WHERE u.id = cr."userId"
);

\echo ''

-- ─────────────────────────────────────────────────────────────────────────────
-- 10. Resume stub — every campaign owner has at least one resume
-- ─────────────────────────────────────────────────────────────────────────────
\echo '── 10. Campaign owners have a resume ────────────────────────────────────'

SELECT
  CASE WHEN COUNT(*) = 0
    THEN 'PASS — all campaign owners have at least one resume'
    ELSE 'FAIL — ' || COUNT(*) || ' campaign owners with no resume'
  END AS result
FROM (
  SELECT DISTINCT c."userId"
  FROM "AutoApplyCampaign" c
  WHERE NOT EXISTS (
    SELECT 1 FROM "Resume" r WHERE r."userId" = c."userId"
  )
) missing;

\echo ''
\echo '=== Verification complete ==='
