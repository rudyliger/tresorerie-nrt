-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Entity" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 99
);
INSERT INTO "new_Entity" ("code", "id", "name") SELECT "code", "id", "name" FROM "Entity";
DROP TABLE "Entity";
ALTER TABLE "new_Entity" RENAME TO "Entity";
CREATE UNIQUE INDEX "Entity_name_key" ON "Entity"("name");
CREATE UNIQUE INDEX "Entity_code_key" ON "Entity"("code");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
