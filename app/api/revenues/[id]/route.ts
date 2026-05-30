import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const data = await request.json();
  const revenue = await prisma.revenue.update({
    where: { id: params.id },
    data: {
      ...(data.amount !== undefined && { amount: data.amount }),
      ...(data.date !== undefined && { date: new Date(data.date) }),
      ...(data.entityId !== undefined && { entityId: data.entityId }),
      ...(data.notes !== undefined && { notes: data.notes }),
    },
    include: { entity: true },
  });
  return NextResponse.json(revenue);
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  await prisma.revenue.delete({ where: { id: params.id } });
  return NextResponse.json({ success: true });
}
