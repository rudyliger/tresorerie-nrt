-- CreateTable
CREATE TABLE "WeeklyCAObjective" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "entityId" TEXT NOT NULL,
    "weekStart" DATETIME NOT NULL,
    "targetAmount" REAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "WeeklyCAObjective_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "Entity" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "WeeklyCAObjective_weekStart_idx" ON "WeeklyCAObjective"("weekStart");

-- CreateIndex
CREATE UNIQUE INDEX "WeeklyCAObjective_entityId_weekStart_key" ON "WeeklyCAObjective"("entityId", "weekStart");
