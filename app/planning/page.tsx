"use client";

import { useEffect, useState, useCallback } from "react";
import { LayoutGrid, Table2 } from "lucide-react";

type Payment = {
  id: string;
  label: string;
  amount: number;
  dueDate: string;
  method: string;
  isPaid: boolean;
  category: { id: string; name: string };
  bankAccount: { id: string; name: string };
  isVirtual?: boolean;
};

type Revenue = {
  id: string;
  amount: number;
  date: string;
  entity: { id: string; name: string; code: string };
};

type Category = { id: string; name: string; order: number };
type BankAccount = { id: string; name: string; code: string; currentBalance: number };
type Entity = { id: string; name: string; code: string };
type DailyObjective = { entityId: string; date: string; targetAmount: number };
type WeeklyObjective = { entityId: string; weekStart: string; targetAmount: number; entity: { code: string } };

const CATEGORIES_ORDER = [
  "Fournisseurs",
  "Loyers",
  "Charges personnel",
  "Charges fiscales",
  "Banque",
  "Autres charges",
];

const METHOD_ROW_BG: Record<string, string> = {
  VIREMENT:    "bg-blue-50",
  PRELEVEMENT: "bg-orange-50",
  CHEQUE:      "bg-purple-50",
  CB:          "bg-pink-50",
  EFFET:       "bg-gray-100",
};

const METHOD_AMOUNT_BADGE: Record<string, string> = {
  VIREMENT:    "bg-blue-100 text-blue-700",
  PRELEVEMENT: "bg-orange-100 text-orange-700",
  CHEQUE:      "bg-purple-100 text-purple-700",
  CB:          "bg-pink-100 text-pink-600",
  EFFET:       "bg-gray-100 text-gray-500",
};

const METHOD_LEGEND: Array<{ method: string; label: string; badge: string }> = [
  { method: "VIREMENT",    label: "Virement",    badge: "bg-blue-100 text-blue-700"   },
  { method: "PRELEVEMENT", label: "Prélèvement", badge: "bg-orange-100 text-orange-700" },
  { method: "CHEQUE",      label: "Chèque",      badge: "bg-purple-100 text-purple-700" },
  { method: "CB",          label: "CB",           badge: "bg-pink-100 text-pink-600"   },
  { method: "EFFET",       label: "Effet",        badge: "bg-gray-100 text-gray-500"   },
];

const FR_DAY_LETTER = ["D", "L", "M", "M", "J", "V", "S"] as const;

function fmt(amount: number) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency", currency: "EUR",
    minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(amount);
}

function fmtCell(n: number): string {
  if (n === 0) return "";
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(n) + " €";
}

function fmtSigned(n: number): string {
  if (n === 0) return "";
  const abs = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(Math.abs(n));
  return (n > 0 ? "+" : "−") + abs + " €";
}

function toDateKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function isWeekend(dateKey: string): boolean {
  const dow = new Date(dateKey + "T12:00:00Z").getUTCDay();
  return dow === 0 || dow === 6;
}

// ── Table row descriptors ───────────────────────────────────────────────────

type TRowSection = { kind: "section"; label: string };
type TRowData    = { kind: "data";    label: string; amountByDay: Record<string, number>; sign: "pos" | "neg"; method?: string };
type TRowTotal   = { kind: "total";   label: string; amountByDay: Record<string, number>; style: "revenue" | "expense" };
type TRowBalance = { kind: "balance"; amountByDay: Record<string, number> };
type TRowCumul   = { kind: "cumul";   amountByDay: Record<string, number> };
type TRow = TRowSection | TRowData | TRowTotal | TRowBalance | TRowCumul;

// ── Component ──────────────────────────────────────────────────────────────

export default function PlanningPage() {
  const today = new Date();
  const [year, setYear]   = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [view, setView]   = useState<"calendar" | "table">("calendar");

  const [payments, setPayments]         = useState<Payment[]>([]);
  const [revenues, setRevenues]         = useState<Revenue[]>([]);
  const [categories, setCategories]     = useState<Category[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [entities, setEntities]         = useState<Entity[]>([]);
  const [dailyObjectives, setDailyObjectives]       = useState<DailyObjective[]>([]);
  const [weeklyWebObjectives, setWeeklyWebObjectives] = useState<WeeklyObjective[]>([]);

  const [modal, setModal]             = useState<null | "payment" | "revenue">(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [form, setForm]               = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    const from    = new Date(year, month, 1).toISOString();
    const to      = new Date(year, month + 1, 0, 23, 59, 59).toISOString();
    const qs      = `from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
    const fromISO = toDateKey(new Date(year, month, 1));
    const toISO   = toDateKey(new Date(year, month + 1, 0));
    const weekFrom = toDateKey(new Date(year, month, -5));

    const [p, extras, r, c, b, e, daily, weekly] = await Promise.all([
      fetch(`/api/payments?${qs}`).then(x => x.json()),
      fetch(`/api/planning-extras?${qs}`).then(x => x.json()),
      fetch(`/api/revenues?${qs}`).then(x => x.json()),
      fetch("/api/categories").then(x => x.json()),
      fetch("/api/bank-accounts").then(x => x.json()),
      fetch("/api/entities").then(x => x.json()),
      fetch(`/api/daily-ca-objective?from=${fromISO}&to=${toISO}`).then(x => x.json()),
      fetch(`/api/weekly-ca-objective?from=${weekFrom}&to=${toISO}`).then(x => x.json()),
    ]);
    setPayments([...p, ...extras]);
    setRevenues(r); setCategories(c);
    setBankAccounts(b); setEntities(e);
    setDailyObjectives(daily); setWeeklyWebObjectives(weekly);
  }, [year, month]);

  useEffect(() => { load(); }, [load]);

  // ── Shared derived data ─────────────────────────────────────────────────

  const paymentsByDay: Record<string, Payment[]>  = {};
  const revenuesByDay: Record<string, Revenue[]>  = {};
  for (const p of payments) {
    const k = toDateKey(new Date(p.dueDate));
    paymentsByDay[k] = paymentsByDay[k] ?? []; paymentsByDay[k].push(p);
  }
  for (const r of revenues) {
    const k = toDateKey(new Date(r.date));
    revenuesByDay[k] = revenuesByDay[k] ?? []; revenuesByDay[k].push(r);
  }

  const STORE_CODES = new Set(["RNV_O", "RNV_B", "RNV_T"]);
  const storeEntityIds = new Set(
    entities.filter(e => STORE_CODES.has(e.code)).map(e => e.id)
  );

  const caStoresByDay: Record<string, number> = {};
  const caWebByDay:   Record<string, number> = {};

  for (const obj of dailyObjectives) {
    const d = new Date(obj.date);
    const k = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
    if (storeEntityIds.has(obj.entityId)) {
      caStoresByDay[k] = (caStoresByDay[k] ?? 0) + obj.targetAmount;
    }
  }
  for (const obj of weeklyWebObjectives) {
    if (!["RNV_WEB", "OMC_WEB"].includes(obj.entity?.code ?? "")) continue;
    const daily = obj.targetAmount / 7;
    const monday = new Date(obj.weekStart);
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setUTCDate(d.getUTCDate() + i);
      const k = toDateKey(d);
      caWebByDay[k] = (caWebByDay[k] ?? 0) + daily;
    }
  }

  const caByDay: Record<string, number> = {};
  const allCaKeys = Array.from(new Set([...Object.keys(caStoresByDay), ...Object.keys(caWebByDay)]));
  for (const k of allCaKeys) {
    caByDay[k] = (caStoresByDay[k] ?? 0) + (caWebByDay[k] ?? 0);
  }

  const bankTotal = bankAccounts.reduce((s, a) => s + a.currentBalance, 0);
  const daysInMonth = getDaysInMonth(year, month);
  const days = Array.from({ length: daysInMonth }, (_, i) => toDateKey(new Date(year, month, i + 1)));

  // Décalage J+1 : les recettes du jour J sont créditées en banque le jour J+1
  // shiftedCAByDay[J] = caByDay[J-1]
  // Premier jour du mois : pas de données du mois précédent → 0
  const shiftedCAByDay: Record<string, number> = {};
  days.forEach((k, i) => { shiftedCAByDay[k] = i > 0 ? (caByDay[days[i - 1]] ?? 0) : 0; });

  let cumul = bankTotal;
  const dayData = days.map(dateKey => {
    const dayPayments = paymentsByDay[dateKey] ?? [];
    const dayRevenues = revenuesByDay[dateKey] ?? [];
    const totalExpenses = dayPayments.reduce((s, p) => s + p.amount, 0);
    const totalRevenues = dayRevenues.reduce((s, r) => s + r.amount, 0);
    // Recettes disponibles = objectifs CA de J-1 (décalage d'un jour)
    const prevCA = shiftedCAByDay[dateKey];
    const balance = prevCA - totalExpenses;
    cumul += balance;
    return { dateKey, dayPayments, dayRevenues, totalExpenses, totalRevenues, prevCA, balance, cumul };
  });

  // ── Table-view row construction ─────────────────────────────────────────

  // Entity → day → amount (revenues)
  const entityDayAmt: Record<string, Record<string, number>> = {};
  for (const r of revenues) {
    const eid = r.entity.id;
    const dk  = toDateKey(new Date(r.date));
    if (!entityDayAmt[eid]) entityDayAmt[eid] = {};
    entityDayAmt[eid][dk] = (entityDayAmt[eid][dk] ?? 0) + r.amount;
  }

  // Category → label → day → amount (payments)
  const catLabelDay: Record<string, Record<string, Record<string, number>>> = {};
  const catLabelMethod: Record<string, Record<string, string>> = {};
  for (const p of payments) {
    const cat = p.category.name;
    const lbl = p.label;
    const dk  = toDateKey(new Date(p.dueDate));
    if (!catLabelDay[cat]) catLabelDay[cat] = {};
    if (!catLabelDay[cat][lbl]) catLabelDay[cat][lbl] = {};
    catLabelDay[cat][lbl][dk] = (catLabelDay[cat][lbl][dk] ?? 0) + p.amount;
    if (!catLabelMethod[cat]) catLabelMethod[cat] = {};
    if (!catLabelMethod[cat][lbl]) catLabelMethod[cat][lbl] = p.method;
  }

  // Calcul total recettes par jour (sans lignes de détail)
  const revTotalByDay: Record<string, number> = {};
  for (const e of entities) {
    for (const [dk, amt] of Object.entries(entityDayAmt[e.id] ?? {}))
      revTotalByDay[dk] = (revTotalByDay[dk] ?? 0) + amt;
  }

  const tableRows: TRow[] = [];

  // DÉPENSES par catégorie
  const expTotalByDay: Record<string, number> = {};
  for (const catName of CATEGORIES_ORDER) {
    const labelMap = catLabelDay[catName] ?? {};
    const labels = Object.keys(labelMap);
    tableRows.push({ kind: "section", label: catName });
    for (const lbl of labels) {
      const dayMap = labelMap[lbl];
      for (const [dk, amt] of Object.entries(dayMap))
        expTotalByDay[dk] = (expTotalByDay[dk] ?? 0) + amt;
      tableRows.push({ kind: "data", label: lbl, amountByDay: dayMap, sign: "neg", method: catLabelMethod[catName]?.[lbl] });
    }
  }
  tableRows.push({ kind: "total", label: "Total dépenses", amountByDay: expTotalByDay, style: "expense" });

  // RECETTES PRÉVISIONNELLES
  tableRows.push({ kind: "section", label: "Recettes" });
  tableRows.push({ kind: "data", label: "Objectif Magasins", amountByDay: caStoresByDay, sign: "pos" });
  tableRows.push({ kind: "data", label: "Objectif Web",      amountByDay: caWebByDay,    sign: "pos" });
  tableRows.push({ kind: "total", label: "Total objectifs CA", amountByDay: caByDay, style: "revenue" });

  // BALANCE & CUMUL
  const balanceByDay: Record<string, number> = {};
  const cumulByDay:   Record<string, number> = {};
  for (const { dateKey, balance, cumul: cv } of dayData) {
    balanceByDay[dateKey] = balance;
    cumulByDay[dateKey]   = cv;
  }
  tableRows.push({ kind: "balance", amountByDay: balanceByDay });
  tableRows.push({ kind: "cumul",   amountByDay: cumulByDay });

  // ── Month navigation ────────────────────────────────────────────────────

  const monthNames = [
    "Janvier","Février","Mars","Avril","Mai","Juin",
    "Juillet","Août","Septembre","Octobre","Novembre","Décembre",
  ];

  function prevMonth() {
    if (month === 0) { setYear(y => y - 1); setMonth(11); }
    else setMonth(m => m - 1);
  }
  function nextMonth() {
    if (month === 11) { setYear(y => y + 1); setMonth(0); }
    else setMonth(m => m + 1);
  }

  // ── Form actions ────────────────────────────────────────────────────────

  async function submitPayment() {
    await fetch("/api/payments", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        label: form.label,
        amount: parseFloat(form.amount.replace(",", ".")),
        dueDate: selectedDate, method: form.method,
        categoryId: form.categoryId, bankAccountId: form.bankAccountId, notes: form.notes,
      }),
    });
    setModal(null); setForm({}); load();
  }

  async function submitRevenue() {
    await fetch("/api/revenues", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amount: parseFloat(form.amount.replace(",", ".")),
        date: selectedDate, entityId: form.entityId, notes: form.notes,
      }),
    });
    setModal(null); setForm({}); load();
  }

  async function togglePaid(payment: Payment) {
    await fetch(`/api/payments/${payment.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isPaid: !payment.isPaid }),
    });
    load();
  }

  async function deletePayment(id: string) {
    if (!confirm("Supprimer ce paiement ?")) return;
    await fetch(`/api/payments/${id}`, { method: "DELETE" });
    load();
  }

  // Calendar helpers
  const dayNames = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
  const firstDayOfMonth = new Date(year, month, 1).getDay();
  const firstDayOffset = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1;

  function getPaymentsByCategory(dayPayments: Payment[]) {
    const grouped: Record<string, Payment[]> = {};
    for (const p of dayPayments) {
      const cat = p.category.name;
      grouped[cat] = grouped[cat] ?? [];
      grouped[cat].push(p);
    }
    return grouped;
  }

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="space-y-3">

      {/* ── Header sticky : toggle + navigation + légende ──────────────────── */}
      <div className="sticky top-0 z-30 bg-slate-50 py-3 border-b border-slate-200/70 shadow-sm">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Planning Trésorerie</h1>
          <div className="flex items-center gap-3">
            {/* View toggle */}
            <div className="flex gap-0.5 bg-slate-100 rounded-xl p-1">
              <button
                onClick={() => setView("calendar")}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                  view === "calendar" ? "bg-white text-indigo-700 shadow-sm" : "text-slate-500 hover:text-slate-700"
                }`}
              >
                <LayoutGrid size={13} /> Calendrier
              </button>
              <button
                onClick={() => setView("table")}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                  view === "table" ? "bg-white text-indigo-700 shadow-sm" : "text-slate-500 hover:text-slate-700"
                }`}
              >
                <Table2 size={13} /> Tableau
              </button>
            </div>
            {/* Month navigation */}
            <button onClick={prevMonth} className="p-2 rounded-lg border border-gray-200 hover:bg-gray-100 text-gray-600">‹</button>
            <span className="text-lg font-semibold text-gray-800 min-w-[160px] text-center">{monthNames[month]} {year}</span>
            <button onClick={nextMonth} className="p-2 rounded-lg border border-gray-200 hover:bg-gray-100 text-gray-600">›</button>
          </div>
        </div>
        {/* Légende commune aux deux vues */}
        <div className="flex justify-end mt-1.5">
          <div className="flex items-center gap-1.5 flex-wrap">
            {METHOD_LEGEND.map(({ method, label, badge }) => (
              <span key={method} className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${badge}`}>
                {label}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ══ VUE CALENDRIER ═════════════════════════════════════════════════════ */}
      {view === "calendar" && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
          <div className="grid grid-cols-7 border-b border-gray-200 bg-gray-50">
            {dayNames.map(d => (
              <div key={d} className="px-2 py-2 text-xs font-semibold text-gray-500 text-center">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {Array.from({ length: firstDayOffset }).map((_, i) => (
              <div key={`empty-${i}`} className="min-h-[140px] bg-gray-50 border-r border-b border-gray-100" />
            ))}
            {dayData.map(({ dateKey, dayPayments, dayRevenues, totalRevenues, balance, cumul: cumulVal }) => {
              const dayNum = parseInt(dateKey.slice(8, 10));
              const todayKey = toDateKey(today);
              const isToday = dateKey === todayKey;
              const isFuture = dateKey > todayKey;
              const payByCategory = getPaymentsByCategory(dayPayments);
              const hasActivity = dayPayments.length > 0 || dayRevenues.length > 0;
              // Afficher la synthèse si : activité, objectif aujourd'hui, ou recettes de la veille (J+1)
              const hasSummary = hasActivity || caByDay[dateKey] > 0 || (shiftedCAByDay[dateKey] ?? 0) > 0;
              return (
                <div key={dateKey} className={`min-h-[140px] border-r border-b border-gray-100 p-1.5 flex flex-col gap-0.5 ${isToday ? "bg-blue-50" : ""}`}>
                  <div className="flex items-center justify-between mb-0.5">
                    <span className={`text-xs font-bold w-5 h-5 flex items-center justify-center rounded-full ${isToday ? "bg-blue-600 text-white" : "text-gray-600"}`}>
                      {dayNum}
                    </span>
                    <div className="flex gap-1">
                      <button onClick={() => { setSelectedDate(dateKey); setModal("payment"); setForm({ method: "VIREMENT" }); }}
                        className="text-xs text-gray-400 hover:text-blue-600 leading-none" title="Ajouter un paiement">+€</button>
                      <button onClick={() => { setSelectedDate(dateKey); setModal("revenue"); setForm({}); }}
                        className="text-xs text-gray-400 hover:text-green-600 leading-none" title="Ajouter une recette">+↑</button>
                    </div>
                  </div>
                  {CATEGORIES_ORDER.filter(cat => payByCategory[cat]).map(cat => (
                    <div key={cat}>
                      <p className="text-[9px] text-gray-400 uppercase font-semibold leading-none mb-0.5">{cat.slice(0, 12)}</p>
                      {payByCategory[cat].map(p => (
                        <div key={p.id} className={`flex items-center gap-1 text-[10px] leading-tight rounded-sm px-1 -mx-0.5 group ${METHOD_ROW_BG[p.method] ?? ""} ${p.isPaid ? "opacity-50 line-through" : ""}`}>
                          <span className="font-medium text-gray-800 truncate flex-1" title={p.label}>{p.label}</span>
                          <span className={`shrink-0 text-[9px] font-semibold px-1.5 py-0.5 rounded-full whitespace-nowrap tabular-nums ${METHOD_AMOUNT_BADGE[p.method] ?? "bg-gray-100 text-gray-500"}`}>
                            {fmt(p.amount)}
                          </span>
                          {!p.isVirtual && <button onClick={() => togglePaid(p)} className="hidden group-hover:inline text-gray-400 hover:text-green-600" title={p.isPaid ? "Marquer non payé" : "Marquer payé"}>✓</button>}
                          {!p.isVirtual && <button onClick={() => deletePayment(p.id)} className="hidden group-hover:inline text-gray-400 hover:text-red-600" title="Supprimer">×</button>}
                        </div>
                      ))}
                    </div>
                  ))}
                  {hasSummary && (
                    <div className="mt-auto pt-1 border-t border-gray-100 space-y-0.5">
                      {/* Objectifs CA (aujourd'hui inclus) */}
                      {dateKey >= toDateKey(today) && (caStoresByDay[dateKey] ?? 0) > 0 && (
                        <div className="flex justify-between text-[10px]">
                          <span className="text-violet-400 font-semibold">Obj. Magasins</span>
                          <span className="font-semibold text-violet-600 tabular-nums">{fmt(caStoresByDay[dateKey])}</span>
                        </div>
                      )}
                      {dateKey >= toDateKey(today) && (caWebByDay[dateKey] ?? 0) > 0 && (
                        <div className="flex justify-between text-[10px]">
                          <span className="text-sky-400 font-semibold">Obj. Web</span>
                          <span className="font-semibold text-sky-600 tabular-nums">{fmt(caWebByDay[dateKey])}</span>
                        </div>
                      )}
                      {isFuture ? (
                        <>
                          <div className="flex justify-between text-[10px]">
                            <span className="text-gray-300">Balance prév.</span>
                            <span className={`font-semibold opacity-70 ${balance >= 0 ? "text-green-600" : "text-red-600"}`}>{fmt(balance)}</span>
                          </div>
                          <div className="flex justify-between text-[10px]">
                            <span className="text-gray-300">Cumul prév.</span>
                            <span className={`font-semibold opacity-70 ${cumulVal >= 0 ? "text-blue-600" : "text-red-700"}`}>{fmt(cumulVal)}</span>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="flex justify-between text-[10px]">
                            <span className="text-gray-400">Balance</span>
                            <span className={`font-semibold ${balance >= 0 ? "text-green-600" : "text-red-600"}`}>{fmt(balance)}</span>
                          </div>
                          <div className="flex justify-between text-[10px]">
                            <span className="text-gray-400">Cumul</span>
                            <span className={`font-semibold ${cumulVal >= 0 ? "text-blue-600" : "text-red-700"}`}>{fmt(cumulVal)}</span>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ══ VUE TABLEAU ════════════════════════════════════════════════════════ */}
      {view === "table" && (
        <div className="rounded-xl border border-slate-200 shadow-sm bg-white overflow-x-auto">
            <table className="text-xs border-collapse planning-table" style={{ minWidth: "max-content" }}>

              {/* ── En-tête des jours ───────────────────────────────────────── */}
              <thead>
                <tr>
                  {/* Label column header — sticky gauche ET haut */}
                  <th className="sticky left-0 top-0 z-20 bg-[#0f172a] text-left px-4 py-3 font-semibold text-slate-300 text-[11px] uppercase tracking-widest whitespace-nowrap"
                    style={{ minWidth: 200 }}>
                    {monthNames[month]} {year}
                  </th>
                  {days.map(dk => {
                    const d      = new Date(dk + "T12:00:00Z");
                    const dow    = d.getUTCDay();
                    const num    = d.getUTCDate();
                    const isWE   = dow === 0 || dow === 6;
                    const isTday = dk === toDateKey(today);
                    return (
                      <th key={dk}
                        className={`sticky top-0 z-10 text-center px-0.5 py-2 font-semibold select-none ${
                          isTday ? "bg-indigo-600" : isWE ? "bg-slate-700" : "bg-[#0f172a]"
                        }`}
                        style={{ minWidth: 80 }}>
                        <div className={`text-[13px] font-bold leading-tight ${isTday ? "text-white" : isWE ? "text-slate-300" : "text-slate-100"}`}>
                          {num}
                        </div>
                        <div className={`text-[10px] leading-tight ${isTday ? "text-indigo-200" : isWE ? "text-slate-500" : "text-slate-500"}`}>
                          {FR_DAY_LETTER[dow]}
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>

              {/* ── Corps du tableau ────────────────────────────────────────── */}
              <tbody>
                {tableRows.map((row, idx) => {
                  // ── Section header ────────────────────────────────────────
                  if (row.kind === "section") {
                    const isRev = row.label === "Recettes";
                    return (
                      <tr key={`section-${idx}`}>
                        <td className={`sticky left-0 z-10 px-4 py-2 font-bold text-[10px] uppercase tracking-widest whitespace-nowrap ${
                          isRev ? "bg-emerald-700 text-white" : "bg-slate-600 text-slate-100"
                        }`} style={{ minWidth: 200 }}>
                          {row.label}
                        </td>
                        {days.map(dk => (
                          <td key={dk} className={isRev ? "bg-emerald-700" : "bg-slate-600"} style={{ minWidth: 80 }} />
                        ))}
                      </tr>
                    );
                  }

                  // ── Data row (entity or payment label) ────────────────────
                  if (row.kind === "data") {
                    const isPos = row.sign === "pos";
                    return (
                      <tr key={`data-${idx}`} className="border-b border-slate-100 hover:bg-slate-50/60">
                        <td className="sticky left-0 z-10 bg-white px-4 py-1.5 pl-7 text-slate-600 whitespace-nowrap overflow-hidden"
                          style={{ minWidth: 200, maxWidth: 200 }}
                          title={row.label}>
                          <span className="block truncate">{row.label}</span>
                        </td>
                        {days.map(dk => {
                          const amt  = row.amountByDay[dk] ?? 0;
                          const cell = fmtCell(amt);
                          const bg   = isWeekend(dk) ? "bg-slate-50" : "bg-white";
                          return (
                            <td key={dk} className={`text-right pr-1 pl-0.5 py-1.5 ${bg}`} style={{ minWidth: 80 }}>
                              {cell ? (
                                isPos ? (
                                  <span className="tabular-nums font-medium text-emerald-700">{cell}</span>
                                ) : (
                                  <span className={`inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded-full tabular-nums whitespace-nowrap ${METHOD_AMOUNT_BADGE[row.method ?? ""] ?? "bg-gray-100 text-gray-500"}`}>
                                    {cell}
                                  </span>
                                )
                              ) : ""}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  }

                  // ── Total row ─────────────────────────────────────────────
                  if (row.kind === "total") {
                    const isRev = row.style === "revenue";
                    const bgRow = isRev ? "bg-emerald-50" : "bg-rose-50";
                    const bgSticky = isRev ? "bg-emerald-50" : "bg-rose-50";
                    const labelCls = isRev ? "text-emerald-800" : "text-rose-800";
                    const amtCls   = isRev ? "text-emerald-700" : "text-rose-600";
                    return (
                      <tr key={`total-${idx}`} className={`border-y border-slate-200 ${bgRow}`}>
                        <td className={`sticky left-0 z-10 ${bgSticky} px-4 py-2 font-bold text-[11px] uppercase tracking-wide ${labelCls} whitespace-nowrap`}
                          style={{ minWidth: 200 }}>
                          {row.label}
                        </td>
                        {days.map(dk => {
                          const amt  = row.amountByDay[dk] ?? 0;
                          const cell = fmtCell(amt);
                          const bg   = isWeekend(dk) ? (isRev ? "bg-emerald-100/60" : "bg-rose-100/60") : bgRow;
                          return (
                            <td key={dk} className={`text-right pr-1.5 pl-0.5 py-2 tabular-nums font-bold ${bg} ${cell ? amtCls : ""}`}
                              style={{ minWidth: 80 }}>
                              {cell || ""}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  }

                  // ── Balance ───────────────────────────────────────────────
                  if (row.kind === "balance") {
                    return (
                      <tr key="balance" className="border-y-2 border-slate-300 bg-slate-100">
                        <td className="sticky left-0 z-10 bg-slate-100 px-4 py-2.5 font-bold text-[11px] uppercase tracking-widest text-slate-700 whitespace-nowrap"
                          style={{ minWidth: 200 }}>
                          Balance
                        </td>
                        {days.map(dk => {
                          const v  = row.amountByDay[dk] ?? 0;
                          const bg = isWeekend(dk) ? "bg-slate-200/60" : "bg-slate-100";
                          return (
                            <td key={dk} className={`text-right pr-1.5 pl-0.5 py-2.5 tabular-nums font-bold ${bg} ${
                              v > 0 ? "text-emerald-700" : v < 0 ? "text-rose-600" : "text-slate-300"
                            }`} style={{ minWidth: 80 }}>
                              {v !== 0 ? fmtSigned(v) : ""}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  }

                  // ── Cumul ─────────────────────────────────────────────────
                  if (row.kind === "cumul") {
                    return (
                      <tr key="cumul" className="bg-indigo-50">
                        <td className="sticky left-0 z-10 bg-indigo-50 px-4 py-2.5 font-bold text-[11px] uppercase tracking-widest text-indigo-800 whitespace-nowrap"
                          style={{ minWidth: 200 }}>
                          Cumul
                        </td>
                        {days.map(dk => {
                          const v  = row.amountByDay[dk] ?? 0;
                          const bg = isWeekend(dk) ? "bg-indigo-100/50" : "bg-indigo-50";
                          return (
                            <td key={dk} className={`text-right pr-1.5 pl-0.5 py-2.5 tabular-nums font-bold ${bg} ${
                              v >= 0 ? "text-indigo-700" : "text-rose-600"
                            }`} style={{ minWidth: 80 }}>
                              {fmtCell(Math.abs(v))
                                ? (v < 0 ? "−" : "") + fmtCell(Math.abs(v))
                                : "0 €"}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  }

                  return null;
                })}
              </tbody>
            </table>
        </div>
      )}

      {/* ── Récapitulatif mensuel (commun aux deux vues) ─────────────────────── */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
          <p className="text-xs text-gray-500 mb-1">Total dépenses du mois</p>
          <p className="text-xl font-bold text-red-600">{fmt(dayData.reduce((s, d) => s + d.totalExpenses, 0))}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
          <p className="text-xs text-gray-500 mb-1">Total recettes du mois</p>
          <p className="text-xl font-bold text-green-600">{fmt(dayData.reduce((s, d) => s + d.totalRevenues, 0))}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
          <p className="text-xs text-gray-500 mb-1">Solde net du mois</p>
          <p className={`text-xl font-bold ${dayData[dayData.length - 1]?.cumul >= 0 ? "text-blue-600" : "text-red-600"}`}>
            {fmt(dayData[dayData.length - 1]?.cumul ?? 0)}
          </p>
        </div>
      </div>

      {/* ── Modal Paiement ──────────────────────────────────────────────────── */}
      {modal === "payment" && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Nouveau paiement — {selectedDate}</h2>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-600">Libellé</label>
                <input className="mt-1 w-full border border-gray-300 rounded px-3 py-2 text-sm"
                  value={form.label ?? ""} onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
                  placeholder="Nom du fournisseur / charge" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">Montant (€)</label>
                <input className="mt-1 w-full border border-gray-300 rounded px-3 py-2 text-sm"
                  value={form.amount ?? ""} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} placeholder="0,00" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">Mode de paiement</label>
                <select className="mt-1 w-full border border-gray-300 rounded px-3 py-2 text-sm"
                  value={form.method ?? "VIREMENT"} onChange={e => setForm(f => ({ ...f, method: e.target.value }))}>
                  <option value="VIREMENT">Virement</option>
                  <option value="PRELEVEMENT">Prélèvement</option>
                  <option value="CHEQUE">Chèque</option>
                  <option value="CB">CB</option>
                  <option value="EFFET">Effet</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">Catégorie</label>
                <select className="mt-1 w-full border border-gray-300 rounded px-3 py-2 text-sm"
                  value={form.categoryId ?? ""} onChange={e => setForm(f => ({ ...f, categoryId: e.target.value }))}>
                  <option value="">— Choisir —</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">Compte bancaire</label>
                <select className="mt-1 w-full border border-gray-300 rounded px-3 py-2 text-sm"
                  value={form.bankAccountId ?? ""} onChange={e => setForm(f => ({ ...f, bankAccountId: e.target.value }))}>
                  <option value="">— Choisir —</option>
                  {bankAccounts.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">Notes</label>
                <input className="mt-1 w-full border border-gray-300 rounded px-3 py-2 text-sm"
                  value={form.notes ?? ""} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Optionnel" />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={submitPayment}
                disabled={!form.label || !form.amount || !form.categoryId || !form.bankAccountId}
                className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed">
                Enregistrer
              </button>
              <button onClick={() => { setModal(null); setForm({}); }}
                className="flex-1 border border-gray-300 text-gray-700 rounded-lg py-2 text-sm hover:bg-gray-50">
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Recette ───────────────────────────────────────────────────── */}
      {modal === "revenue" && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Nouvelle recette — {selectedDate}</h2>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-600">Entité</label>
                <select className="mt-1 w-full border border-gray-300 rounded px-3 py-2 text-sm"
                  value={form.entityId ?? ""} onChange={e => setForm(f => ({ ...f, entityId: e.target.value }))}>
                  <option value="">— Choisir —</option>
                  {entities.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">Montant (€)</label>
                <input className="mt-1 w-full border border-gray-300 rounded px-3 py-2 text-sm"
                  value={form.amount ?? ""} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} placeholder="0,00" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">Notes</label>
                <input className="mt-1 w-full border border-gray-300 rounded px-3 py-2 text-sm"
                  value={form.notes ?? ""} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Optionnel" />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={submitRevenue}
                disabled={!form.entityId || !form.amount}
                className="flex-1 bg-green-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed">
                Enregistrer
              </button>
              <button onClick={() => { setModal(null); setForm({}); }}
                className="flex-1 border border-gray-300 text-gray-700 rounded-lg py-2 text-sm hover:bg-gray-50">
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
