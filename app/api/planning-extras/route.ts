export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from");
  const to   = searchParams.get("to");

  const dateRange = {
    ...(from ? { gte: new Date(from) } : {}),
    ...(to   ? { lte: new Date(to)   } : {}),
  };

  const [installments, cheques] = await Promise.all([
    prisma.loanInstallment.findMany({
      where: { dueDate: dateRange },
      include: { loan: true },
      orderBy: { dueDate: "asc" },
    }),
    prisma.cheque.findMany({
      where: {
        status: "EN_ATTENTE",
        expectedCashDate: { not: null, ...dateRange },
      },
      orderBy: { expectedCashDate: "asc" },
    }),
  ]);

  const extras = [
    ...installments.map((inst) => {
      const prefix = inst.loan.loanType === "CREDIT_BAIL" ? "loyer" : "éch.";
      const num    = inst.installmentNumber ? ` - ${prefix} ${inst.installmentNumber}` : "";
      return {
        id:          `loan-${inst.id}`,
        label:       inst.loan.name + num,
        amount:      inst.totalAmount,
        dueDate:     inst.dueDate,
        method:      "PRELEVEMENT",
        isPaid:      false,
        category:    { id: "loan",   name: "Banque"       },
        bankAccount: { id: "",       name: inst.loan.bankName },
        isVirtual:   true,
      };
    }),
    ...cheques.map((ch) => ({
      id:          `cheque-${ch.id}`,
      label:       ch.recipient,
      amount:      ch.amount,
      dueDate:     ch.expectedCashDate!,
      method:      "CHEQUE",
      isPaid:      false,
      category:    { id: "cheque", name: "Fournisseurs"  },
      bankAccount: { id: "",       name: ""               },
      isVirtual:   true,
    })),
  ];

  return NextResponse.json(extras);
}
