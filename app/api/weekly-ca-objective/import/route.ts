import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// Correspondance colonne CSV → code entité
const CSV_COL_TO_CODE: Record<string, string> = {
  rnv_o: "RNV_O", rnv_b: "RNV_B", rnv_t: "RNV_T",
  rnv_web: "RNV_WEB", omc_web: "OMC_WEB",
};

function parseLine(line: string): string[] {
  const cols: string[] = [];
  let cur = "";
  let inQ = false;
  for (const ch of line) {
    if (ch === '"') { inQ = !inQ; }
    else if ((ch === "," || ch === ";") && !inQ) { cols.push(cur.trim()); cur = ""; }
    else { cur += ch; }
  }
  cols.push(cur.trim());
  return cols;
}

function getMondayISO(dateStr: string) {
  const d = new Date(dateStr + "T12:00:00.000Z");
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().slice(0, 10);
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "Fichier requis" }, { status: 400 });

  const text = await file.text();
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return NextResponse.json({ error: "Fichier vide ou invalide" }, { status: 422 });

  const headers = parseLine(lines[0]).map((h) => h.toLowerCase().replace(/\s+/g, "_").replace(/é/g, "e"));
  const semaineIdx = headers.findIndex((h) => h === "semaine");
  if (semaineIdx === -1) return NextResponse.json({ error: "Colonne 'semaine' introuvable" }, { status: 422 });

  // Charger toutes les entités une fois
  const entities = await prisma.entity.findMany();
  const entityByCode = Object.fromEntries(entities.map((e) => [e.code, e]));

  let upserted = 0;
  let skipped = 0;

  for (let i = 1; i < lines.length; i++) {
    const cols = parseLine(lines[i]);
    const rawDate = cols[semaineIdx]?.trim();
    if (!rawDate || !rawDate.match(/^\d{4}-\d{2}-\d{2}/)) { skipped++; continue; }

    const weekStart = getMondayISO(rawDate.slice(0, 10));
    const ws = new Date(weekStart + "T12:00:00.000Z");

    for (const [csvCol, entityCode] of Object.entries(CSV_COL_TO_CODE)) {
      const colIdx = headers.indexOf(csvCol);
      if (colIdx === -1) continue;
      const rawAmount = cols[colIdx]?.replace(",", ".").replace(/\s/g, "") ?? "";
      const amount = parseFloat(rawAmount);
      if (isNaN(amount)) continue;

      const entity = entityByCode[entityCode];
      if (!entity) continue;

      await prisma.weeklyCAObjective.upsert({
        where: { entityId_weekStart: { entityId: entity.id, weekStart: ws } },
        update: { targetAmount: amount },
        create: { entityId: entity.id, weekStart: ws, targetAmount: amount },
      });
      upserted++;
    }
  }

  return NextResponse.json({ upserted, skipped, weeks: lines.length - 1 - skipped });
}
