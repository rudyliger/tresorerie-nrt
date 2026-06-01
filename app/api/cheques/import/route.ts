export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import prisma from "@/lib/prisma";

// ── Conversion sériau Excel → Date JS ──────────────────────────────────────
// Excel epoch : 0 = 1900-01-00 (avec bug bissextile 1900)
// Unix epoch  : 25569 jours après l'epoch Excel = 1970-01-01
function excelSerialToDate(serial: number): Date {
  return new Date((serial - 25569) * 86400 * 1000);
}

function parseDate(val: unknown): Date | null {
  if (val === null || val === undefined || val === "") return null;

  // SheetJS avec cellDates:true → déjà un Date JS
  if (val instanceof Date) {
    return isNaN(val.getTime()) ? null : val;
  }

  // Nombre (sériau Excel ou float de date)
  if (typeof val === "number") {
    if (val > 0 && val < 200000) return excelSerialToDate(Math.round(val));
    return null;
  }

  const s = String(val).trim();
  if (!s || s === "-" || s === "—") return null;

  // Sériau Excel en chaîne : "46007.0", "46007"
  const asNum = parseFloat(s);
  if (!isNaN(asNum) && asNum > 0 && asNum < 200000 && /^\d+(\.\d+)?$/.test(s)) {
    return excelSerialToDate(Math.round(asNum));
  }

  // DD/MM/YYYY ou DD.MM.YYYY ou DD-MM-YYYY
  const dmy = s.match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4})$/);
  if (dmy) {
    const d = new Date(Date.UTC(+dmy[3], +dmy[2] - 1, +dmy[1], 12));
    return isNaN(d.getTime()) ? null : d;
  }

  // YYYY-MM-DD
  const ymd = s.match(/^(\d{4})[/.\-](\d{1,2})[/.\-](\d{1,2})$/);
  if (ymd) {
    const d = new Date(Date.UTC(+ymd[1], +ymd[2] - 1, +ymd[3], 12));
    return isNaN(d.getTime()) ? null : d;
  }

  return null;
}

// Convertit une valeur numérique de chèque (5790793.0) en chaîne propre ("5790793")
function parseChequeNumber(val: unknown): string {
  if (typeof val === "number") return String(Math.round(val));
  const s = String(val ?? "").trim();
  // Retire le suffixe ".0" ou ".00"
  return s.replace(/\.0+$/, "");
}

function parseAmount(val: unknown): number {
  if (typeof val === "number") return Math.abs(val);
  const s = String(val ?? "").replace(/\s/g, "").replace(",", ".").replace(/[€$]/g, "");
  const n = parseFloat(s);
  return isNaN(n) ? 0 : Math.abs(n);
}

function detectStatus(
  subject: string,
  recipient: string,
  actualDate: Date | null
): "EN_ATTENTE" | "ENCAISSE" | "ANNULE" {
  const text = (subject + " " + recipient).toUpperCase();
  if (text.includes("ANNUL")) return "ANNULE";
  if (actualDate) return "ENCAISSE";
  return "EN_ATTENTE";
}

// ── Route POST ─────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "Fichier requis" }, { status: 400 });

  const buffer = Buffer.from(await file.arrayBuffer());

  let rows: unknown[][];
  let detectedSheet = "";
  try {
    const wb = XLSX.read(buffer, { type: "buffer", cellDates: true });

    // Priorité à l'onglet contenant "CHEQUIER" (insensible casse/accents)
    const sheetName =
      wb.SheetNames.find((n) => n.toUpperCase().replace(/[ÈÉÊ]/g, "E").includes("CHEQUIER")) ??
      wb.SheetNames[0];
    detectedSheet = sheetName;

    const ws = wb.Sheets[sheetName];
    rows = XLSX.utils.sheet_to_json(ws, {
      header: 1,
      defval: null,
      raw: true,       // valeurs brutes : number, Date, string — pas de conversion
    }) as unknown[][];
  } catch {
    return NextResponse.json(
      { error: "Fichier illisible. Formats acceptés : .xlsx, .xls, .csv" },
      { status: 422 }
    );
  }

  if (rows.length < 2) {
    return NextResponse.json({ error: "Fichier vide ou sans données" }, { status: 422 });
  }

  // ── Mapping des colonnes ─────────────────────────────────────────────────
  // En-têtes attendus (onglet CHEQUIERS) :
  //  0: Chéquier | 1: Numéro de chèque | 2: Destinataire | 3: Objet
  //  4: Date du cheque | 5: Montant | 6: Date d'encaissement prévue
  //  7: Date d'encaissement réel | 8: Chèques non encaissés

  const rawHeaders = rows[0].map((h) =>
    String(h ?? "")
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")  // enlève les diacritiques pour la comparaison
  );

  const findCol = (keywords: string[], fallback: number): number => {
    const idx = rawHeaders.findIndex((h) =>
      keywords.some((kw) => h.includes(kw))
    );
    return idx !== -1 ? idx : fallback;
  };

  const cChequier = findCol(["chequier", "chequiers"], 0);
  const cNum      = findCol(["numero de cheque", "numero cheque", "n° cheque", "num"], 1);
  const cRecip    = findCol(["destinataire", "beneficiaire"], 2);
  const cSubject  = findCol(["objet", "motif", "libelle", "description"], 3);
  const cIssued   = findCol(["date du cheque", "date cheque", "date emission", "emission"], 4);
  const cAmount   = findCol(["montant"], 5);
  const cExpected = findCol(["encaissement prevu", "prevue", "prevu", "attendu"], 6);
  const cActual   = findCol(["encaissement reel", "reel", "reelle", "encaisse le"], 7);

  // ── Chargement des enregistrements existants (id + number + chequier) ──
  const existingRecords = await prisma.cheque.findMany({
    select: { id: true, number: true, chequier: true },
  });
  // Map number → { id, chequier } pour lookup O(1)
  const existingMap = new Map(
    existingRecords.map((c) => [c.number.trim(), { id: c.id, chequier: c.chequier }])
  );

  let imported = 0;
  let updated  = 0;   // existants dont chequier était null → mis à jour
  let duplicates = 0;
  let skipped  = 0;

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i] as unknown[];

    const chequierVal = parseChequeNumber(r[cChequier]) || null;
    const number      = parseChequeNumber(r[cNum]);
    const recipient   = String(r[cRecip] ?? "").trim();
    const subject     = String(r[cSubject] ?? "").trim().toUpperCase();
    const amount      = parseAmount(r[cAmount]);

    // Ligne vide ou données insuffisantes
    if (!number && !recipient) { skipped++; continue; }
    if (!number || !recipient || amount === 0) { skipped++; continue; }

    const existing = existingMap.get(number);

    if (existing) {
      // Si le chèque existe mais sans chéquier → mettre à jour uniquement le champ chequier
      if (existing.chequier === null && chequierVal !== null) {
        await prisma.cheque.update({
          where: { id: existing.id },
          data: { chequier: chequierVal },
        });
        existingMap.set(number, { id: existing.id, chequier: chequierVal });
        updated++;
      } else {
        duplicates++;
      }
      continue;
    }

    // Nouveau chèque → créer
    const issuedAt   = parseDate(r[cIssued]) ?? new Date();
    const expectedAt = parseDate(r[cExpected]);
    const actualAt   = parseDate(r[cActual]);
    const status     = detectStatus(subject, recipient, actualAt);

    await prisma.cheque.create({
      data: {
        number,
        recipient,
        subject: subject || "—",
        amount,
        issuedAt,
        expectedCashDate: expectedAt,
        actualCashDate:   actualAt,
        status,
        chequier: chequierVal,
        notes: null,
      },
    });

    existingMap.set(number, { id: "new", chequier: chequierVal });
    imported++;
  }

  return NextResponse.json({ imported, updated, duplicates, skipped, sheet: detectedSheet });
}
