import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const data = await request.json();
  const loan = await prisma.loan.update({
    where: { id: params.id },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.bankName !== undefined && { bankName: data.bankName }),
      ...(data.initialAmount !== undefined && { initialAmount: parseFloat(data.initialAmount) }),
      ...(data.remainingAmount !== undefined && { remainingAmount: parseFloat(data.remainingAmount) }),
      ...(data.monthlyPayment !== undefined && { monthlyPayment: parseFloat(data.monthlyPayment) }),
      ...(data.nextDueDate !== undefined && { nextDueDate: new Date(data.nextDueDate + "T12:00:00.000Z") }),
      ...(data.endDate !== undefined && { endDate: new Date(data.endDate + "T12:00:00.000Z") }),
      ...(data.notes !== undefined && { notes: data.notes }),
    },
  });
  return NextResponse.json(loan);
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  await prisma.loan.delete({ where: { id: params.id } });
  return NextResponse.json({ success: true });
}
