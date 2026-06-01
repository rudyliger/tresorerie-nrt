export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// GET /api/weekly-ca-objective                        → tous les objectifs (historique)
// GET /api/weekly-ca-objective?weekStart=...          → objectifs d'une semaine
// GET /api/weekly-ca-objective?from=YYYY-MM-DD&to=... → plage de dates
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const weekStartStr = searchParams.get("weekStart");
  const fromStr = searchParams.get("from");
  const toStr = searchParams.get("to");

  const objectives = await prisma.weeklyCAObjective.findMany({
    where: weekStartStr
      ? { weekStart: new Date(weekStartStr) }
      : fromStr && toStr
      ? {
          weekStart: {
            gte: new Date(fromStr + "T00:00:00.000Z"),
            lte: new Date(toStr + "T23:59:59.999Z"),
          },
        }
      : undefined,
    include: { entity: true },
    orderBy: [{ weekStart: "desc" }, { entity: { name: "asc" } }],
  });
  return NextResponse.json(objectives);
}

// POST /api/weekly-ca-objective  { entityId, weekStart, targetAmount }
export async function POST(request: Request) {
  const { entityId, weekStart, targetAmount } = await request.json();
  const ws = new Date(weekStart);
  const obj = await prisma.weeklyCAObjective.upsert({
    where: { entityId_weekStart: { entityId, weekStart: ws } },
    update: { targetAmount },
    create: { entityId, weekStart: ws, targetAmount },
    include: { entity: true },
  });
  return NextResponse.json(obj);
}

// DELETE /api/weekly-ca-objective?weekStart=... → supprime tous les objectifs de la semaine
export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const weekStartStr = searchParams.get("weekStart");
  if (!weekStartStr) {
    return NextResponse.json({ error: "weekStart requis" }, { status: 400 });
  }
  await prisma.weeklyCAObjective.deleteMany({
    where: { weekStart: new Date(weekStartStr) },
  });
  return NextResponse.json({ success: true });
}
