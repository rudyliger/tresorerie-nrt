import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

function getWeekBounds(date: Date) {
  const day = date.getDay(); // 0=Sun
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(date);
  monday.setDate(date.getDate() + diffToMonday);
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  return { monday, sunday };
}

export async function GET() {
  const now = new Date();
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(now.getDate() - 7);

  const { monday: thisMonday, sunday: thisSunday } = getWeekBounds(now);
  const nextMonday = new Date(thisMonday);
  nextMonday.setDate(thisMonday.getDate() + 7);
  const nextSunday = new Date(nextMonday);
  nextSunday.setDate(nextMonday.getDate() + 6);
  nextSunday.setHours(23, 59, 59, 999);

  const include = { category: true, bankAccount: true } as const;
  const orderBy = { dueDate: "asc" } as const;
  const notPaid = { isPaid: false } as const;

  const [
    bankAccounts,
    overdueOld,
    overdueRecent,
    thisWeekPayments,
    nextWeekPayments,
    thisWeekRevenues,
    weeklyObjectives,
    entities,
  ] = await Promise.all([
    prisma.bankAccount.findMany({ orderBy: { name: "asc" } }),

    // Retards importants : overdue > 7 jours
    prisma.payment.findMany({
      where: { ...notPaid, dueDate: { lt: sevenDaysAgo } },
      include, orderBy,
    }),

    // Retards récents : overdue <= 7 jours
    prisma.payment.findMany({
      where: { ...notPaid, dueDate: { gte: sevenDaysAgo, lt: now } },
      include, orderBy,
    }),

    // Cette semaine (à venir, depuis maintenant jusqu'à dimanche)
    prisma.payment.findMany({
      where: { ...notPaid, dueDate: { gte: now, lte: thisSunday } },
      include, orderBy,
    }),

    // Semaine prochaine
    prisma.payment.findMany({
      where: { ...notPaid, dueDate: { gte: nextMonday, lte: nextSunday } },
      include, orderBy,
    }),

    // CA réalisé cette semaine
    prisma.revenue.findMany({
      where: { date: { gte: thisMonday, lte: thisSunday } },
      include: { entity: true },
    }),

    // Objectifs CA cette semaine
    prisma.weeklyCAObjective.findMany({
      where: { weekStart: { gte: thisMonday, lte: thisSunday } },
      include: { entity: true },
    }),

    prisma.entity.findMany({ orderBy: { order: "asc" } }),
  ]);

  const totalBalances = bankAccounts.reduce((s, a) => s + a.currentBalance, 0);
  const sum = (arr: { amount: number }[]) => arr.reduce((s, p) => s + p.amount, 0);

  // CA réalisé par entité cette semaine
  const caByEntity: Record<string, number> = {};
  for (const r of thisWeekRevenues) {
    caByEntity[r.entityId] = (caByEntity[r.entityId] ?? 0) + r.amount;
  }

  return NextResponse.json({
    bankAccounts,
    totalBalances,
    overdueOld,
    overdueOldTotal: sum(overdueOld),
    overdueRecent,
    overdueRecentTotal: sum(overdueRecent),
    thisWeekPayments,
    thisWeekPaymentsTotal: sum(thisWeekPayments),
    nextWeekPayments,
    nextWeekPaymentsTotal: sum(nextWeekPayments),
    // CA semaine
    weekStart: thisMonday.toISOString(),
    weekEnd: thisSunday.toISOString(),
    entities,
    weeklyObjectives,
    caByEntity,
    thisWeekRevenueTotal: sum(thisWeekRevenues),
    thisWeekExpensesTotal: sum(thisWeekPayments),
  });
}
