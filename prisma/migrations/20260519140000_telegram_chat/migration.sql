-- CreateTable: TelegramChat for Prompt 18 notification bot
CREATE TABLE "TelegramChat" (
    "id"                     TEXT NOT NULL,
    "userId"                 TEXT NOT NULL,
    "chatId"                 TEXT NOT NULL,
    "username"               TEXT,
    "connectedAt"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notifyOnSubmit"         BOOLEAN NOT NULL DEFAULT true,
    "notifyOnInterviewReply" BOOLEAN NOT NULL DEFAULT true,
    "notifyOnLinkedInIssue"  BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "TelegramChat_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TelegramChat_userId_key" ON "TelegramChat"("userId");
CREATE INDEX "TelegramChat_chatId_idx" ON "TelegramChat"("chatId");

-- AddForeignKey
ALTER TABLE "TelegramChat"
    ADD CONSTRAINT "TelegramChat_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
