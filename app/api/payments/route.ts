import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const categoryId = searchParams.get("categoryId");
  const isPaid = searchParams.get("isPaid");

  const where: Record<string, unknown> = {};
  if (from || to) {
    where.dueDate = {
      ...(from ? { gte: new Date(from) } : {}),
      ...(to ? { lte: new Date(to) } : {}),
    };
  }
  if (categoryId) where.categoryId = categoryId;
  if (isPaid !== null) where.isPaid = isPaid === "true";

  const payments = await prisma.payment.findMany({
    where,
    include: { category: true, bankAccount: true },
    orderBy: { dueDate: "asc" },
  });
  return NextResponse.json(payments);
}

export async function POST(request: Request) {
  const data = await request.json();
  const payment = await prisma.payment.create({
    data: {
      label: data.label,
      amount: data.amount,
      dueDate: new Date(data.dueDate + "T12:00:00.000Z"),
      method: data.method,
      categoryId: data.categoryId,
      bankAccountId: data.bankAccountId,
      notes: data.notes ?? null,
      isRecurring: data.isRecurring ?? false,
      recurringDayOfMonth: data.recurringDayOfMonth ?? null,
    },
    include: { category: true, bankAccount: true },
  });
  return NextResponse.json(payment, { status: 201 });
}
