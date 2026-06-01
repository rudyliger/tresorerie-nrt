export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const data = await request.json();

  // Quand on encaisse, on horodate si pas déjà renseigné
  const actualCashDate =
    data.status === "ENCAISSE" && !data.actualCashDate
      ? new Date()
      : data.actualCashDate
      ? new Date(data.actualCashDate + "T12:00:00.000Z")
      : undefined;

  const cheque = await prisma.cheque.update({
    where: { id: params.id },
    data: {
      ...(data.number    !== undefined && { number: data.number }),
      ...(data.recipient !== undefined && { recipient: data.recipient }),
      ...(data.subject   !== undefined && { subject: data.subject }),
      ...(data.amount    !== undefined && { amount: parseFloat(data.amount) }),
      ...(data.issuedAt  !== undefined && { issuedAt: new Date(data.issuedAt + "T12:00:00.000Z") }),
      ...(data.expectedCashDate !== undefined && {
        expectedCashDate: data.expectedCashDate
          ? new Date(data.expectedCashDate + "T12:00:00.000Z")
          : null,
      }),
      ...(actualCashDate !== undefined && { actualCashDate }),
      ...(data.status    !== undefined && { status: data.status }),
      ...(data.notes     !== undefined && { notes: data.notes }),
      ...(data.chequier  !== undefined && { chequier: data.chequier }),
    },
  });
  return NextResponse.json(cheque);
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  await prisma.cheque.delete({ where: { id: params.id } });
  return NextResponse.json({ success: true });
}
