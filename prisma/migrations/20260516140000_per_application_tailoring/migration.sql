-- Migration: per_application_tailoring
-- Adds four columns to JobApplication for AI tailoring tracking.
-- All columns are nullable so existing rows are unaffected.

ALTER TABLE "JobApplication"
  ADD COLUMN IF NOT EXISTS "tailoredResume"      JSONB,
  ADD COLUMN IF NOT EXISTS "tailoredCoverLetter" TEXT,
  ADD COLUMN IF NOT EXISTS "tailoringTokensUsed" INTEGER,
  ADD COLUMN IF NOT EXISTS "tailoringModelUsed"  TEXT;
