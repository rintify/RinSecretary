-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_RecurringTask" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "cronExpression" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "RecurringTask_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_RecurringTask" ("createdAt", "cronExpression", "description", "id", "title", "updatedAt", "userId") SELECT "createdAt", "cronExpression", "description", "id", "title", "updatedAt", "userId" FROM "RecurringTask";
DROP TABLE "RecurringTask";
ALTER TABLE "new_RecurringTask" RENAME TO "RecurringTask";
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
