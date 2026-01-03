-- AlterTable
ALTER TABLE "User" ADD COLUMN "aiApiKey" TEXT;
ALTER TABLE "User" ADD COLUMN "aiBaseUrl" TEXT;
ALTER TABLE "User" ADD COLUMN "aiModel" TEXT;
ALTER TABLE "User" ADD COLUMN "aiProvider" TEXT;

-- CreateTable
CREATE TABLE "AiConfig" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "apiKey" TEXT NOT NULL,
    "model" TEXT,
    "baseUrl" TEXT,
    "includeThoughts" BOOLEAN NOT NULL DEFAULT false,
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AiConfig_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
