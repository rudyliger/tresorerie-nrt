export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

function getWeekBounds(date: Date) {
  const day = date.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(date);
  monday.setDate(date.getDate() + diffToMonday);
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  return { monday, sunday };
}

type FlatPayment = {
  id: string;
  label: string;
  amount: number;
  dueDate: string;
  method: string;
  isPaid: boolean;
  category: { name: string };
  bankAccount: { name: string };
};

function sortByDate(arr: FlatPayment[]) {
  return arr.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
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

  const payInclude  = { category: true, bankAccount: true } as const;
  const loanInclude = { loan: true } as const;
  const byDate      = { dueDate: "asc" } as const;
  const byCashDate  = { expectedCashDate: "asc" } as const;
  const notPaid     = { isPaid: false } as const;
  const pending     = { status: "EN_ATTENTE" as const };

  const [
    bankAccounts,
    // ── Payments ──
    payOverdueOld,    payOverdueRecent,    payThisWeek,    payNextWeek,
    // ── Loan installments ──
    loanOverdueOld,   loanOverdueRecent,   loanThisWeek,   loanNextWeek,
    // ── Cheques EN_ATTENTE ──
    cheqOverdueOld,   cheqOverdueRecent,   cheqThisWeek,   cheqNextWeek,
    // ── CA ──
    thisWeekRevenues, weeklyObjectives, dailyObjectives, entities,
  ] = await Promise.all([

    prisma.bankAccount.findMany({ orderBy: { name: "asc" } }),

    // Payments
    prisma.payment.findMany({ where: { ...notPaid, dueDate: { lt: sevenDaysAgo } },          include: payInclude, orderBy: byDate }),
    prisma.payment.findMany({ where: { ...notPaid, dueDate: { gte: sevenDaysAgo, lt: now } }, include: payInclude, orderBy: byDate }),
    prisma.payment.findMany({ where: { ...notPaid, dueDate: { gte: now, lte: thisSunday } },  include: payInclude, orderBy: byDate }),
    prisma.payment.findMany({ where: { ...notPaid, dueDate: { gte: nextMonday, lte: nextSunday } }, include: payInclude, orderBy: byDate }),

    // Loan installments
    prisma.loanInstallment.findMany({ where: { dueDate: { lt: sevenDaysAgo } },          include: loanInclude, orderBy: byDate }),
    prisma.loanInstallment.findMany({ where: { dueDate: { gte: sevenDaysAgo, lt: now } }, include: loanInclude, orderBy: byDate }),
    prisma.loanInstallment.findMany({ where: { dueDate: { gte: now, lte: thisSunday } },  include: loanInclude, orderBy: byDate }),
    prisma.loanInstallment.findMany({ where: { dueDate: { gte: nextMonday, lte: nextSunday } }, include: loanInclude, orderBy: byDate }),

    // Cheques EN_ATTENTE (expectedCashDate non nulle implicitement via les filtres de dates)
    prisma.cheque.findMany({ where: { ...pending, expectedCashDate: { lt: sevenDaysAgo } },          orderBy: byCashDate }),
    prisma.cheque.findMany({ where: { ...pending, expectedCashDate: { gte: sevenDaysAgo, lt: now } }, orderBy: byCashDate }),
    prisma.cheque.findMany({ where: { ...pending, expectedCashDate: { gte: now, lte: thisSunday } },  orderBy: byCashDate }),
    prisma.cheque.findMany({ where: { ...pending, expectedCashDate: { gte: nextMonday, lte: nextSunday } }, orderBy: byCashDate }),

    prisma.revenue.findMany({ where: { date: { gte: thisMonday, lte: thisSunday } }, include: { entity: true } }),
    prisma.weeklyCAObjective.findMany({ where: { weekStart: { gte: thisMonday, lte: thisSunday } }, include: { entity: true } }),
    prisma.dailyCAObjective.findMany({ where: { date: { gte: thisMonday, lte: thisSunday } } }),
    prisma.entity.findMany({ orderBy: { order: "asc" } }),
  ]);

  // ── Mappers ──────────────────────────────────────────────────────────────────

  function mapInstallment(inst: typeof loanThisWeek[number]): FlatPayment {
    const prefix = inst.loan.loanType === "CREDIT_BAIL" ? "loyer" : "éch.";
    const num    = inst.installmentNumber ? ` — ${prefix} ${inst.installmentNumber}` : "";
    return {
      id:          `loan-${inst.id}`,
      label:       inst.loan.name + num,
      amount:      inst.totalAmount,
      dueDate:     inst.dueDate.toISOString(),
      method:      "PRELEVEMENT",
      isPaid:      false,
      category:    { name: "Banque" },
      bankAccount: { name: inst.loan.bankName },
    };
  }

  function mapCheque(ch: typeof cheqThisWeek[number]): FlatPayment {
    return {
      id:          `cheque-${ch.id}`,
      label:       ch.recipient,
      amount:      ch.amount,
      dueDate:     (ch.expectedCashDate as Date).toISOString(),
      method:      "CHEQUE",
      isPaid:      false,
      category:    { name: "Fournisseurs" },
      bankAccount: { name: "" },
    };
  }

  // ── Fusion des 3 sources ─────────────────────────────────────────────────────

  const overdueOld     = sortByDate([...payOverdueOld.map(p => ({ ...p, dueDate: p.dueDate.toISOString(), category: p.category, bankAccount: p.bankAccount })),  ...loanOverdueOld.map(mapInstallment),  ...cheqOverdueOld.map(mapCheque)]);
  const overdueRecent  = sortByDate([...payOverdueRecent.map(p => ({ ...p, dueDate: p.dueDate.toISOString(), category: p.category, bankAccount: p.bankAccount })), ...loanOverdueRecent.map(mapInstallment), ...cheqOverdueRecent.map(mapCheque)]);
  const thisWeekPayments = sortByDate([...payThisWeek.map(p => ({ ...p, dueDate: p.dueDate.toISOString(), category: p.category, bankAccount: p.bankAccount })),   ...loanThisWeek.map(mapInstallment),   ...cheqThisWeek.map(mapCheque)]);
  const nextWeekPayments = sortByDate([...payNextWeek.map(p => ({ ...p, dueDate: p.dueDate.toISOString(), category: p.category, bankAccount: p.bankAccount })),   ...loanNextWeek.map(mapInstallment),   ...cheqNextWeek.map(mapCheque)]);

  const totalBalances = bankAccounts.reduce((s, a) => s + a.currentBalance, 0);
  const sum = (arr: { amount: number }[]) => arr.reduce((s, p) => s + p.amount, 0);

  const caByEntity: Record<string, number> = {};
  for (const r of thisWeekRevenues) {
    caByEntity[r.entityId] = (caByEntity[r.entityId] ?? 0) + r.amount;
  }

  // Objectifs CA : somme des jours (magasins physiques) + objectif hebdo (web)
  const caObjectiveByEntity: Record<string, number> = {};
  for (const obj of dailyObjectives) {
    caObjectiveByEntity[obj.entityId] = (caObjectiveByEntity[obj.entityId] ?? 0) + obj.targetAmount;
  }
  for (const obj of weeklyObjectives) {
    caObjectiveByEntity[obj.entityId] = (caObjectiveByEntity[obj.entityId] ?? 0) + obj.targetAmount;
  }

  return NextResponse.json({
    bankAccounts,
    totalBalances,
    overdueOld,         overdueOldTotal:    sum(overdueOld),
    overdueRecent,      overdueRecentTotal: sum(overdueRecent),
    thisWeekPayments,   thisWeekPaymentsTotal:  sum(thisWeekPayments),
    nextWeekPayments,   nextWeekPaymentsTotal:  sum(nextWeekPayments),
    weekStart: thisMonday.toISOString(),
    weekEnd:   thisSunday.toISOString(),
    entities,
    weeklyObjectives,
    caByEntity,
    caObjectiveByEntity,
    thisWeekRevenueTotal:  sum(thisWeekRevenues),
    thisWeekExpensesTotal: sum(thisWeekPayments),
  });
}
