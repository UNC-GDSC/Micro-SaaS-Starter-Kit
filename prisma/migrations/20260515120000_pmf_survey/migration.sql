-- PMF tracking fields on User
ALTER TABLE "User" ADD COLUMN "firstPaidAt"  TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "cancelledAt"  TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "refundReason" TEXT;

CREATE INDEX "User_firstPaidAt_idx" ON "User"("firstPaidAt");
CREATE INDEX "User_cancelledAt_idx" ON "User"("cancelledAt");

-- Survey table
CREATE TABLE "Survey" (
    "id"           TEXT         NOT NULL,
    "userId"       TEXT         NOT NULL,
    "type"         TEXT         NOT NULL,
    "scheduledFor" TIMESTAMP(3) NOT NULL,
    "shownAt"      TIMESTAMP(3),
    "answeredAt"   TIMESTAMP(3),
    "response"     JSONB,
    CONSTRAINT "Survey_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Survey_userId_type_idx"           ON "Survey"("userId", "type");
CREATE INDEX "Survey_scheduledFor_shownAt_idx"  ON "Survey"("scheduledFor", "shownAt");

ALTER TABLE "Survey"
    ADD CONSTRAINT "Survey_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
