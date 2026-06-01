export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { parseShopifyCSV } from "@/lib/parse-shopify-csv";

export async function POST(request: Request) {
  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const entityId = formData.get("entityId") as string | null;

  if (!file || !entityId) {
    return NextResponse.json({ error: "file et entityId requis" }, { status: 400 });
  }

  const text = await file.text();
  const entries = parseShopifyCSV(text);

  if (entries.length === 0) {
    return NextResponse.json({ error: "Aucune donnée valide dans le CSV" }, { status: 422 });
  }

  // Upsert revenues: 1 par jour par entité
  const created = await Promise.all(
    entries.map(({ date, amount }) =>
      prisma.revenue.create({
        data: {
          entityId,
          amount,
          date: new Date(`${date}T12:00:00.000Z`),
          notes: "Import Shopify",
        },
      })
    )
  );

  return NextResponse.json({ imported: created.length, entries });
}
