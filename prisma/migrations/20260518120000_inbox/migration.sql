-- Prompt 22: Job-email inbox
-- Adds per-user forwarding alias (inboxHandle) and InboxMessage table

-- ── User.inboxHandle ────────────────────────────────────────────────────────
ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "inboxHandle" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "User_inboxHandle_key"
  ON "User"("inboxHandle");

-- ── InboxClass enum ─────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE "InboxClass" AS ENUM (
    'INTERVIEW_REQUEST',
    'REJECTION',
    'QUESTION',
    'AUTOMATED',
    'OTHER',
    'UNCLASSIFIED'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── InboxMessage table ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "InboxMessage" (
  "id"             TEXT           NOT NULL,
  "userId"         TEXT           NOT NULL,
  "applicationId"  TEXT,
  "fromEmail"      TEXT           NOT NULL,
  "fromName"       TEXT,
  "subject"        TEXT           NOT NULL,
  "bodyText"       TEXT           NOT NULL,
  "bodyHtml"       TEXT,
  "classification" "InboxClass"   NOT NULL DEFAULT 'UNCLASSIFIED',
  "receivedAt"     TIMESTAMP(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "isRead"         BOOLEAN        NOT NULL DEFAULT false,

  CONSTRAINT "InboxMessage_pkey" PRIMARY KEY ("id")
);

-- ── Indexes ─────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS "InboxMessage_userId_receivedAt_idx"
  ON "InboxMessage"("userId", "receivedAt");

CREATE INDEX IF NOT EXISTS "InboxMessage_applicationId_idx"
  ON "InboxMessage"("applicationId");

-- ── Foreign keys ─────────────────────────────────────────────────────────────
ALTER TABLE "InboxMessage"
  ADD CONSTRAINT "InboxMessage_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "InboxMessage"
  ADD CONSTRAINT "InboxMessage_applicationId_fkey"
  FOREIGN KEY ("applicationId") REFERENCES "JobApplication"("id") ON DELETE SET NULL ON UPDATE CASCADE;
