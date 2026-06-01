"use client";

import { useEffect, useState } from "react";
import { TrendingUp, TrendingDown, AlertTriangle, Clock, CalendarCheck, CalendarClock, Target, Receipt } from "lucide-react";

type BankAccount = { id: string; name: string; currentBalance: number };
type Payment = {
  id: string; label: string; amount: number; dueDate: string;
  method: string; isPaid: boolean;
  category: { name: string }; bankAccount: { name: string };
};
type Entity = { id: string; name: string; code: string };
type WeeklyObjective = { id: string; entityId: string; targetAmount: number; entity: Entity };

type DashboardData = {
  bankAccounts: BankAccount[];
  totalBalances: number;
  overdueOld: Payment[];     overdueOldTotal: number;
  overdueRecent: Payment[];  overdueRecentTotal: number;
  thisWeekPayments: Payment[]; thisWeekPaymentsTotal: number;
  nextWeekPayments: Payment[]; nextWeekPaymentsTotal: number;
  weekStart: string; weekEnd: string;
  entities: Entity[];
  weeklyObjectives: WeeklyObjective[];
  caByEntity: Record<string, number>;
  caObjectiveByEntity: Record<string, number>;
  thisWeekRevenueTotal: number;
  thisWeekExpensesTotal: number;
};

const fmt = (n: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
const fmtFull = (n: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(n);
const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });

const METHOD_LABELS: Record<string, string> = {
  VIREMENT: "Vir.", PRELEVEMENT: "Prél.", CHEQUE: "Chq.", CB: "CB", EFFET: "Eff.",
};
const METHOD_BADGE: Record<string, string> = {
  VIREMENT: "bg-blue-100 text-blue-600",
  PRELEVEMENT: "bg-orange-100 text-orange-600",
  CHEQUE: "bg-purple-100 text-purple-600",
  CB: "bg-yellow-100 text-yellow-600",
  EFFET: "bg-slate-100 text-slate-500",
};

type ColDef = {
  key: "thisWeekPayments" | "nextWeekPayments" | "overdueOld" | "overdueRecent";
  totalKey: "thisWeekPaymentsTotal" | "nextWeekPaymentsTotal" | "overdueOldTotal" | "overdueRecentTotal";
  label: string;
  Icon: React.ElementType;
  accentBg: string;
  accentText: string;
  emptyText: string;
};

const SHOP_ACCENT: Record<string, { bg: string; text: string }> = {
  RNV_O:   { bg: "bg-indigo-600",  text: "text-white" },
  RNV_B:   { bg: "bg-emerald-600", text: "text-white" },
  RNV_T:   { bg: "bg-amber-500",   text: "text-white" },
  RNV_WEB: { bg: "bg-sky-500",     text: "text-white" },
  OMC_WEB: { bg: "bg-violet-600",  text: "text-white" },
};

const CAT_ORDER = [
  "Fournisseurs",
  "Loyers",
  "Charges personnel",
  "Charges fiscales",
  "Banque",
  "Autres charges",
];

function groupByCategory(payments: Payment[]): Payment[] {
  const grouped: Record<string, Payment[]> = {};
  for (const p of payments) {
    const cat = p.category.name;
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(p);
  }
  // Trier chaque groupe par montant décroissant
  for (const cat of Object.keys(grouped)) {
    grouped[cat].sort((a, b) => b.amount - a.amount);
  }
  // Ordonner les catégories
  const known = CAT_ORDER.filter(c => grouped[c]);
  const other = Object.keys(grouped).filter(c => !CAT_ORDER.includes(c));
  return [...known, ...other].flatMap(cat => grouped[cat]);
}

const COLS: ColDef[] = [
  { key: "thisWeekPayments",  totalKey: "thisWeekPaymentsTotal",  label: "Cette semaine",      Icon: CalendarCheck,  accentBg: "bg-indigo-600", accentText: "text-white", emptyText: "Aucun paiement prévu" },
  { key: "nextWeekPayments",  totalKey: "nextWeekPaymentsTotal",  label: "Semaine prochaine",  Icon: CalendarClock,  accentBg: "bg-slate-700",  accentText: "text-white", emptyText: "Aucun paiement prévu" },
  { key: "overdueOld",        totalKey: "overdueOldTotal",        label: "Retards importants", Icon: AlertTriangle,  accentBg: "bg-red-600",    accentText: "text-white", emptyText: "Aucun retard" },
  { key: "overdueRecent",     totalKey: "overdueRecentTotal",     label: "Retards < 7 jours",  Icon: Clock,          accentBg: "bg-amber-500",  accentText: "text-white", emptyText: "Aucun retard récent" },
];

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [editingBalance, setEditingBalance] = useState<string | null>(null);
  const [editBalanceVal, setEditBalanceVal] = useState("");

  async function load() {
    const res = await fetch("/api/dashboard");
    setData(await res.json());
  }
  useEffect(() => { load(); }, []);

  async function saveBalance(id: string) {
    const balance = parseFloat(editBalanceVal.replace(",", "."));
    if (isNaN(balance)) return;
    await fetch("/api/bank-accounts", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, currentBalance: balance }),
    });
    setEditingBalance(null);
    load();
  }

  if (!data) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  // Calculs CA semaine
  const weekLabel = `${fmtDate(data.weekStart)} → ${fmtDate(data.weekEnd)}`;
  const objectiveByEntity = data.caObjectiveByEntity ?? {};

  const STORE_CODES = ["RNV_O", "RNV_B", "RNV_T"];
  const WEB_CODES   = ["RNV_WEB", "OMC_WEB"];
  const totalMagasins = (data.entities ?? [])
    .filter(e => STORE_CODES.includes(e.code))
    .reduce((s, e) => s + (objectiveByEntity[e.id] ?? 0), 0);
  const totalWeb = (data.entities ?? [])
    .filter(e => WEB_CODES.includes(e.code))
    .reduce((s, e) => s + (objectiveByEntity[e.id] ?? 0), 0);
  const totalObjectifs = totalMagasins + totalWeb;
  const ecart = totalObjectifs - data.thisWeekPaymentsTotal;

  return (
    <div className="space-y-5">

      {/* ── En-tête ──────────────────────────────────────────────────────────── */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Dashboard</h1>
        <p className="text-slate-400 text-sm mt-0.5">Vue d&apos;ensemble de votre trésorerie</p>
      </div>

      {/* ── 1. SOLDES BANCAIRES ──────────────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">
            Comptes bancaires
          </p>
          <div className="flex items-center gap-3 bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-2">
            {data.totalBalances >= 0
              ? <TrendingUp size={14} className="text-indigo-500" />
              : <TrendingDown size={14} className="text-red-500" />}
            <span className="text-xs text-indigo-700 font-medium">Total consolidé</span>
            <span className={`text-base font-bold tabular-nums ${data.totalBalances < 0 ? "text-red-600" : "text-indigo-700"}`}>
              {fmtFull(data.totalBalances)}
            </span>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4">
          {data.bankAccounts.map((acc) => (
            <div key={acc.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 flex flex-col gap-3">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{acc.name}</p>
              {editingBalance === acc.id ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text" value={editBalanceVal}
                    onChange={(e) => setEditBalanceVal(e.target.value)}
                    className="flex-1 border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter") saveBalance(acc.id);
                      if (e.key === "Escape") setEditingBalance(null);
                    }}
                  />
                  <button onClick={() => saveBalance(acc.id)}
                    className="px-3 py-1.5 bg-indigo-600 text-white text-xs font-medium rounded-lg hover:bg-indigo-700">
                    OK
                  </button>
                </div>
              ) : (
                <div className="flex items-end justify-between">
                  <p className={`text-3xl font-bold tracking-tight tabular-nums ${acc.currentBalance < 0 ? "text-red-500" : "text-slate-900"}`}>
                    {fmtFull(acc.currentBalance)}
                  </p>
                  <button
                    onClick={() => { setEditingBalance(acc.id); setEditBalanceVal(String(acc.currentBalance)); }}
                    className="text-xs text-slate-400 hover:text-indigo-600 transition-colors mb-0.5">
                    Modifier
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ── 2. BANDE KPI SEMAINE ─────────────────────────────────────────────── */}
      <div>
        <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest mb-3">
          Semaine en cours — {weekLabel}
        </p>
        <div className="grid grid-cols-4 gap-4">

          {/* Objectif CA Magasins */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-8 h-8 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0">
                <Target size={15} className="text-indigo-500" />
              </div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Obj. CA Magasins</p>
            </div>
            <p className="text-3xl font-bold text-slate-900 tracking-tight tabular-nums">{fmt(totalMagasins)}</p>
            {totalMagasins === 0 && (
              <a href="/saisie" className="text-xs text-indigo-400 hover:underline mt-1 block">Saisir les objectifs →</a>
            )}
          </div>

          {/* Objectif CA Web */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-8 h-8 rounded-xl bg-sky-50 flex items-center justify-center shrink-0">
                <Target size={15} className="text-sky-500" />
              </div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Obj. CA Web</p>
            </div>
            <p className="text-3xl font-bold text-slate-900 tracking-tight tabular-nums">{fmt(totalWeb)}</p>
            {totalWeb === 0 && (
              <a href="/saisie" className="text-xs text-sky-400 hover:underline mt-1 block">Saisir les objectifs →</a>
            )}
          </div>

          {/* Dépenses prévues */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-8 h-8 rounded-xl bg-red-50 flex items-center justify-center shrink-0">
                <Receipt size={15} className="text-red-400" />
              </div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Dépenses prévues semaine</p>
            </div>
            <p className="text-3xl font-bold text-red-500 tracking-tight tabular-nums">{fmt(data.thisWeekPaymentsTotal)}</p>
          </div>

          {/* Écart */}
          <div className={`rounded-2xl border shadow-sm p-5 ${ecart >= 0 ? "bg-emerald-50 border-emerald-100" : "bg-red-50 border-red-100"}`}>
            <div className="flex items-center gap-2.5 mb-4">
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${ecart >= 0 ? "bg-emerald-100" : "bg-red-100"}`}>
                {ecart >= 0
                  ? <TrendingUp size={15} className="text-emerald-600" />
                  : <TrendingDown size={15} className="text-red-500" />}
              </div>
              <p className={`text-xs font-semibold uppercase tracking-wide ${ecart >= 0 ? "text-emerald-600" : "text-red-500"}`}>Écart</p>
            </div>
            <p className={`text-3xl font-bold tracking-tight tabular-nums ${ecart >= 0 ? "text-emerald-700" : "text-red-600"}`}>
              {ecart >= 0 ? "+" : ""}{fmt(ecart)}
            </p>
            <p className={`text-xs mt-1 ${ecart >= 0 ? "text-emerald-500" : "text-red-400"}`}>
              {ecart >= 0 ? "Objectif CA > dépenses" : "Dépenses > objectif CA"}
            </p>
          </div>

        </div>
      </div>

      {/* ── 3. 4 COLONNES DE PAIEMENTS ──────────────────────────────────────── */}
      <div>
        <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest mb-3">
          Détail des paiements
        </p>
        <div className="grid grid-cols-4 gap-4">
        {COLS.map((col) => {
          const payments = data[col.key] as Payment[];
          const total = data[col.totalKey] as number;
          return (
            <div key={col.key} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col">
              <div className={`${col.accentBg} px-4 py-4`}>
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <col.Icon size={14} className={`${col.accentText} opacity-80`} />
                      <p className={`text-[11px] font-semibold uppercase tracking-widest ${col.accentText} opacity-80`}>
                        {col.label}
                      </p>
                    </div>
                    <p className={`text-2xl font-bold ${col.accentText} tracking-tight tabular-nums`}>
                      {fmt(total)}
                    </p>
                  </div>
                  <span className={`text-[10px] font-medium px-2 py-1 rounded-full bg-white/15 ${col.accentText}`}>
                    {payments.length} item{payments.length > 1 ? "s" : ""}
                  </span>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto max-h-64">
                {payments.length === 0 ? (
                  <p className="px-4 py-5 text-xs text-slate-400 text-center">{col.emptyText}</p>
                ) : (() => {
                  const grouped = groupByCategory(payments);
                  let lastCat = "";
                  return grouped.map((p) => {
                    const cat = p.category.name;
                    const showSep = lastCat !== "" && cat !== lastCat;
                    lastCat = cat;
                    return (
                      <div key={p.id}>
                        {showSep && <div className="mx-4 border-t border-slate-100" />}
                        <div className="px-4 py-3 hover:bg-slate-50 transition-colors">
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <p className="text-sm font-medium text-slate-800 leading-tight">{p.label}</p>
                            <p className="text-sm font-bold text-slate-900 shrink-0 tabular-nums">{fmt(p.amount)}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-slate-400 tabular-nums">{fmtDate(p.dueDate)}</span>
                            <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-md ${METHOD_BADGE[p.method] ?? "bg-slate-100 text-slate-500"}`}>
                              {METHOD_LABELS[p.method]}
                            </span>
                            <span className="text-[10px] text-slate-300">{p.bankAccount.name.replace("CACL ", "")}</span>
                          </div>
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>
          );
        })}
        </div>
      </div>

      {/* ── 4. 5 PETITES CARTES CA PAR SHOP ─────────────────────────────────── */}
      <div>
        <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest mb-3">
          Objectifs CA par shop — {weekLabel}
        </p>
        <div className="grid grid-cols-5 gap-3">
          {data.entities.map((e) => {
            const obj = objectiveByEntity[e.id] ?? 0;
            const accent = SHOP_ACCENT[e.code] ?? { bg: "bg-slate-600", text: "text-white" };
            return (
              <div key={e.id} className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden flex flex-col">
                <div className={`${accent.bg} px-4 py-3`}>
                  <p className={`text-[10px] font-semibold uppercase tracking-widest ${accent.text} opacity-90 leading-snug`}>
                    {e.name}
                  </p>
                </div>
                <div className="px-4 py-3">
                  <p className={`text-xl font-bold tracking-tight tabular-nums ${obj > 0 ? "text-slate-900" : "text-slate-300"}`}>
                    {obj > 0 ? fmt(obj) : "—"}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
}
