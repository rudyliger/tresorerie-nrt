-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Loan" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "loanNumber" TEXT,
    "name" TEXT NOT NULL,
    "bankName" TEXT NOT NULL,
    "iban" TEXT,
    "initialAmount" REAL NOT NULL,
    "remainingAmount" REAL NOT NULL,
    "interestRate" REAL,
    "durationMonths" INTEGER,
    "monthlyPayment" REAL NOT NULL,
    "nextDueDate" DATETIME NOT NULL,
    "endDate" DATETIME NOT NULL,
    "notes" TEXT,
    "loanType" TEXT NOT NULL DEFAULT 'PRET',
    "residualValue" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Loan" ("bankName", "createdAt", "durationMonths", "endDate", "iban", "id", "initialAmount", "interestRate", "loanNumber", "monthlyPayment", "name", "nextDueDate", "notes", "remainingAmount", "updatedAt") SELECT "bankName", "createdAt", "durationMonths", "endDate", "iban", "id", "initialAmount", "interestRate", "loanNumber", "monthlyPayment", "name", "nextDueDate", "notes", "remainingAmount", "updatedAt" FROM "Loan";
DROP TABLE "Loan";
ALTER TABLE "new_Loan" RENAME TO "Loan";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
