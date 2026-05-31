export type ShopifyDay = { date: string; amount: number };

function parseLine(line: string): string[] {
  const cols: string[] = [];
  let cur = "";
  let inQ = false;
  for (const ch of line) {
    if (ch === '"') { inQ = !inQ; }
    else if (ch === "," && !inQ) { cols.push(cur.trim().replace(/^"|"$/g, "")); cur = ""; }
    else { cur += ch; }
  }
  cols.push(cur.trim().replace(/^"|"$/g, ""));
  return cols;
}

export function parseShopifyCSV(csv: string): ShopifyDay[] {
  const lines = csv.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];

  const headers = parseLine(lines[0]).map((h) => h.toLowerCase().trim());
  // Support plusieurs variantes de noms de colonnes Shopify
  const totalIdx = headers.findIndex((h) => ["total", "total_price", "montant total"].includes(h));
  const dateIdx = headers.findIndex((h) => ["created at", "created_at", "date de création"].includes(h));
  const statusIdx = headers.findIndex((h) => ["financial status", "financial_status", "statut financier"].includes(h));

  if (totalIdx === -1 || dateIdx === -1) return [];

  const byDate: Record<string, number> = {};
  for (let i = 1; i < lines.length; i++) {
    const cols = parseLine(lines[i]);
    // Ne prendre que les commandes payées
    if (statusIdx !== -1) {
      const status = (cols[statusIdx] ?? "").toLowerCase();
      if (!["paid", "payé", "payee"].includes(status)) continue;
    }
    const dateStr = (cols[dateIdx] ?? "").slice(0, 10);
    const rawTotal = (cols[totalIdx] ?? "").replace(/[^\d.,]/g, "").replace(",", ".");
    const amount = parseFloat(rawTotal);
    if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/) && !isNaN(amount) && amount > 0) {
      byDate[dateStr] = (byDate[dateStr] ?? 0) + amount;
    }
  }
  return Object.entries(byDate)
    .map(([date, amount]) => ({ date, amount }))
    .sort((a, b) => a.date.localeCompare(b.date));
}
