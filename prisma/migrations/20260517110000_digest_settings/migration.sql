-- Add daily digest notification preferences
ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "dailyDigestEnabled" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "timezone" TEXT NOT NULL DEFAULT 'UTC';
