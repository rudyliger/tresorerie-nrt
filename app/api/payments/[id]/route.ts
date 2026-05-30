import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const data = await request.json();
  const payment = await prisma.payment.update({
    where: { id: params.id },
    data: {
      ...(data.label !== undefined && { label: data.label }),
      ...(data.amount !== undefined && { amount: data.amount }),
      ...(data.dueDate !== undefined && { dueDate: new Date(data.dueDate) }),
      ...(data.method !== undefined && { method: data.method }),
      ...(data.categoryId !== undefined && { categoryId: data.categoryId }),
      ...(data.bankAccountId !== undefined && { bankAccountId: data.bankAccountId }),
      ...(data.isPaid !== undefined && { isPaid: data.isPaid }),
      ...(data.isPaid === true && { paidAt: new Date() }),
      ...(data.isPaid === false && { paidAt: null }),
      ...(data.notes !== undefined && { notes: data.notes }),
    },
    include: { category: true, bankAccount: true },
  });
  return NextResponse.json(payment);
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  await prisma.payment.delete({ where: { id: params.id } });
  return NextResponse.json({ success: true });
}
