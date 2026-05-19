-- Add refundedAt column for one-refund-per-customer guard
ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "refundedAt" TIMESTAMP(3);
