-- CreateTable
CREATE TABLE "Loan" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "bankName" TEXT NOT NULL,
    "initialAmount" REAL NOT NULL,
    "remainingAmount" REAL NOT NULL,
    "monthlyPayment" REAL NOT NULL,
    "nextDueDate" DATETIME NOT NULL,
    "endDate" DATETIME NOT NULL,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
