import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const where: Record<string, unknown> = {};
  if (from || to) {
    where.date = {
      ...(from ? { gte: new Date(from) } : {}),
      ...(to ? { lte: new Date(to) } : {}),
    };
  }

  const revenues = await prisma.revenue.findMany({
    where,
    include: { entity: true },
    orderBy: { date: "asc" },
  });
  return NextResponse.json(revenues);
}

export async function POST(request: Request) {
  const data = await request.json();
  const revenue = await prisma.revenue.create({
    data: {
      amount: data.amount,
      date: new Date(data.date),
      entityId: data.entityId,
      notes: data.notes,
    },
    include: { entity: true },
  });
  return NextResponse.json(revenue, { status: 201 });
}
