-- AlterTable: add nullable scope column to ApiKey
ALTER TABLE "ApiKey" ADD COLUMN "scope" TEXT;

-- Index for scope-filtered queries (extension key validation)
CREATE INDEX "ApiKey_scope_idx" ON "ApiKey"("scope");
