-- CreateTable
CREATE TABLE "Cheque" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "number" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "issuedAt" DATETIME NOT NULL,
    "expectedCashDate" DATETIME,
    "actualCashDate" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'EN_ATTENTE',
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
