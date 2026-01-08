/*
  Warnings:

  - You are about to alter the column `fileSize` on the `Attachment` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.
  - You are about to alter the column `fileSize` on the `SharedFile` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Attachment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "fileName" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "fileSize" BIGINT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "memoId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Attachment_memoId_fkey" FOREIGN KEY ("memoId") REFERENCES "Memo" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Attachment" ("createdAt", "fileName", "filePath", "fileSize", "id", "memoId", "mimeType") SELECT "createdAt", "fileName", "filePath", "fileSize", "id", "memoId", "mimeType" FROM "Attachment";
DROP TABLE "Attachment";
ALTER TABLE "new_Attachment" RENAME TO "Attachment";
CREATE TABLE "new_SharedFile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "fileName" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "fileSize" BIGINT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL DEFAULT 'legacy'
);
INSERT INTO "new_SharedFile" ("createdAt", "fileName", "filePath", "fileSize", "id", "mimeType", "userId") SELECT "createdAt", "fileName", "filePath", "fileSize", "id", "mimeType", "userId" FROM "SharedFile";
DROP TABLE "SharedFile";
ALTER TABLE "new_SharedFile" RENAME TO "SharedFile";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
