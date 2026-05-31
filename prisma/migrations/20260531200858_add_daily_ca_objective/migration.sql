-- CreateTable
CREATE TABLE "DailyCAObjective" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "entityId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "targetAmount" REAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "DailyCAObjective_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "Entity" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "DailyCAObjective_date_idx" ON "DailyCAObjective"("date");

-- CreateIndex
CREATE UNIQUE INDEX "DailyCAObjective_entityId_date_key" ON "DailyCAObjective"("entityId", "date");
