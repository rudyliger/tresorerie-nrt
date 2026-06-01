export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");

  const cheques = await prisma.cheque.findMany({
    where: status ? { status: status as "EN_ATTENTE" | "ENCAISSE" | "ANNULE" } : undefined,
    orderBy: { issuedAt: "desc" },
  });
  return NextResponse.json(cheques);
}

export async function POST(request: Request) {
  const data = await request.json();
  const cheque = await prisma.cheque.create({
    data: {
      number: data.number,
      recipient: data.recipient,
      subject: data.subject,
      amount: parseFloat(data.amount),
      issuedAt: new Date(data.issuedAt + "T12:00:00.000Z"),
      expectedCashDate: data.expectedCashDate
        ? new Date(data.expectedCashDate + "T12:00:00.000Z")
        : null,
      actualCashDate: null,
      status: "EN_ATTENTE",
      notes: data.notes ?? null,
    },
  });
  return NextResponse.json(cheque, { status: 201 });
}
