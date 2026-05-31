import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// GET /api/daily-ca-objective?from=YYYY-MM-DD&to=YYYY-MM-DD
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const fromStr = searchParams.get("from");
  const toStr = searchParams.get("to");

  const objectives = await prisma.dailyCAObjective.findMany({
    where:
      fromStr && toStr
        ? {
            date: {
              gte: new Date(fromStr + "T00:00:00.000Z"),
              lte: new Date(toStr + "T23:59:59.999Z"),
            },
          }
        : undefined,
    include: { entity: true },
    orderBy: [{ date: "asc" }, { entity: { name: "asc" } }],
  });
  return NextResponse.json(objectives);
}

// POST /api/daily-ca-objective  { entityId, date: "YYYY-MM-DD", targetAmount }
export async function POST(request: Request) {
  const { entityId, date, targetAmount } = await request.json();
  const d = new Date(date + "T12:00:00.000Z");
  const obj = await prisma.dailyCAObjective.upsert({
    where: { entityId_date: { entityId, date: d } },
    update: { targetAmount },
    create: { entityId, date: d, targetAmount },
    include: { entity: true },
  });
  return NextResponse.json(obj);
}

// DELETE /api/daily-ca-objective?from=YYYY-MM-DD&to=YYYY-MM-DD
export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const fromStr = searchParams.get("from");
  const toStr = searchParams.get("to");
  if (!fromStr || !toStr) {
    return NextResponse.json({ error: "from et to requis" }, { status: 400 });
  }
  await prisma.dailyCAObjective.deleteMany({
    where: {
      date: {
        gte: new Date(fromStr + "T00:00:00.000Z"),
        lte: new Date(toStr + "T23:59:59.999Z"),
      },
    },
  });
  return NextResponse.json({ success: true });
}
