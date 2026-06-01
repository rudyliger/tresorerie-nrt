-- AlterTable
ALTER TABLE "Loan" ADD COLUMN "durationMonths" INTEGER;
ALTER TABLE "Loan" ADD COLUMN "iban" TEXT;
ALTER TABLE "Loan" ADD COLUMN "interestRate" REAL;
ALTER TABLE "Loan" ADD COLUMN "loanNumber" TEXT;

-- CreateTable
CREATE TABLE "LoanInstallment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "loanId" TEXT NOT NULL,
    "dueDate" DATETIME NOT NULL,
    "totalAmount" REAL NOT NULL,
    "principal" REAL NOT NULL,
    "interest" REAL NOT NULL,
    "remainingBalance" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LoanInstallment_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "Loan" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "LoanInstallment_loanId_dueDate_idx" ON "LoanInstallment"("loanId", "dueDate");
