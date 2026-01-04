-- CreateTable
CREATE TABLE "MailSummary" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "senders" TEXT,
    "relatedLinks" TEXT,
    "latestMailReceivedAt" DATETIME NOT NULL,
    "targetRangeStart" DATETIME NOT NULL,
    "targetRangeEnd" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'GENERATED',
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "error" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MailSummary_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "MailSummary_userId_latestMailReceivedAt_idx" ON "MailSummary"("userId", "latestMailReceivedAt");
