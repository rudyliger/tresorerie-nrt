import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET() {
  const now = new Date();
  const in7Days = new Date(now);
  in7Days.setDate(in7Days.getDate() + 7);
  const in30Days = new Date(now);
  in30Days.setDate(in30Days.getDate() + 30);

  const [bankAccounts, overduePayments, dueIn7Days, dueIn30Days] =
    await Promise.all([
      prisma.bankAccount.findMany({ orderBy: { name: "asc" } }),

      prisma.payment.findMany({
        where: {
          isPaid: false,
          dueDate: { lt: now },
        },
        include: { category: true, bankAccount: true },
        orderBy: { dueDate: "asc" },
      }),

      prisma.payment.findMany({
        where: {
          isPaid: false,
          dueDate: { gte: now, lte: in7Days },
        },
        include: { category: true, bankAccount: true },
        orderBy: { dueDate: "asc" },
      }),

      prisma.payment.findMany({
        where: {
          isPaid: false,
          dueDate: { gte: now, lte: in30Days },
        },
        include: { category: true, bankAccount: true },
        orderBy: { dueDate: "asc" },
      }),
    ]);

  const totalBalances = bankAccounts.reduce(
    (sum, acc) => sum + acc.currentBalance,
    0
  );

  return NextResponse.json({
    bankAccounts,
    totalBalances,
    overduePayments,
    overdueTotal: overduePayments.reduce((s, p) => s + p.amount, 0),
    dueIn7Days,
    dueIn7DaysTotal: dueIn7Days.reduce((s, p) => s + p.amount, 0),
    dueIn30Days,
    dueIn30DaysTotal: dueIn30Days.reduce((s, p) => s + p.amount, 0),
  });
}
