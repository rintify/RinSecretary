-- AlterTable
ALTER TABLE "User" ADD COLUMN "pushoverToken" TEXT;
ALTER TABLE "User" ADD COLUMN "pushoverUserKey" TEXT;

-- CreateTable
CREATE TABLE "Alarm" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "comment" TEXT,
    "time" DATETIME NOT NULL,
    "isSent" BOOLEAN NOT NULL DEFAULT false,
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Alarm_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
