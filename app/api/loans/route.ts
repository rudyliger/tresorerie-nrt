import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET() {
  const loans = await prisma.loan.findMany({ orderBy: { nextDueDate: "asc" } });
  return NextResponse.json(loans);
}

export async function POST(request: Request) {
  const data = await request.json();
  const loan = await prisma.loan.create({
    data: {
      name: data.name,
      bankName: data.bankName,
      initialAmount: parseFloat(data.initialAmount),
      remainingAmount: parseFloat(data.remainingAmount),
      monthlyPayment: parseFloat(data.monthlyPayment),
      nextDueDate: new Date(data.nextDueDate + "T12:00:00.000Z"),
      endDate: new Date(data.endDate + "T12:00:00.000Z"),
      notes: data.notes ?? null,
    },
  });
  return NextResponse.json(loan, { status: 201 });
}
