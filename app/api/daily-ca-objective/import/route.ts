import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// CSV magasins :  semaine,mag,lun,mar,mer,jeu,ven,sam
// semaine = lundi ISO (YYYY-MM-DD), mag = rnv_o|rnv_b|rnv_t
// lun..sam = montants des 6 jours ouvrés

const STORE_CODES = ["RNV_O", "RNV_B", "RNV_T"];
const DAY_OFFSETS: Record<string, number> = { lun: 0, mar: 1, mer: 2, jeu: 3, ven: 4, sam: 5 };

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

  const headers = parseLine(lines[0]).map((h) =>
    h.toLowerCase().replace(/\s+/g, "_").replace(/[éè]/g, "e").replace(/^﻿/, "")
  );
  const semaineIdx = headers.findIndex((h) => h === "semaine");
  const magIdx = headers.findIndex((h) => h === "mag");
  if (semaineIdx === -1 || magIdx === -1) {
    return NextResponse.json({ error: "Colonnes 'semaine' et 'mag' requises" }, { status: 422 });
  }

  const entities = await prisma.entity.findMany({
    where: { code: { in: STORE_CODES } },
  });
  const entityByCode = Object.fromEntries(
    entities.map((e) => [e.code.toLowerCase().replace("_", "_"), e])
  );

  let upserted = 0;
  let skipped = 0;

  for (let i = 1; i < lines.length; i++) {
    const cols = parseLine(lines[i]);
    const rawDate = cols[semaineIdx]?.trim();
    const magCode = cols[magIdx]?.trim().toLowerCase();
    if (!rawDate || !rawDate.match(/^\d{4}-\d{2}-\d{2}/) || !magCode) {
      skipped++;
      continue;
    }

    const monday = getMondayISO(rawDate.slice(0, 10));
    const entity = entityByCode[magCode] ?? entityByCode[magCode.replace("_", "_")];
    if (!entity) { skipped++; continue; }

    for (const [dayCol, offset] of Object.entries(DAY_OFFSETS)) {
      const colIdx = headers.indexOf(dayCol);
      if (colIdx === -1) continue;
      const rawAmount = cols[colIdx]?.replace(",", ".").replace(/\s/g, "") ?? "";
      const amount = parseFloat(rawAmount);
      if (isNaN(amount)) continue;

      const d = new Date(monday + "T12:00:00.000Z");
      d.setUTCDate(d.getUTCDate() + offset);

      await prisma.dailyCAObjective.upsert({
        where: { entityId_date: { entityId: entity.id, date: d } },
        update: { targetAmount: amount },
        create: { entityId: entity.id, date: d, targetAmount: amount },
      });
      upserted++;
    }
  }

  return NextResponse.json({ upserted, skipped, rows: lines.length - 1 - skipped });
}
