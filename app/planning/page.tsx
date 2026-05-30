"use client";

import { useEffect, useState, useCallback } from "react";

type Payment = {
  id: string;
  label: string;
  amount: number;
  dueDate: string;
  method: string;
  isPaid: boolean;
  category: { id: string; name: string };
  bankAccount: { id: string; name: string };
};

type Revenue = {
  id: string;
  amount: number;
  date: string;
  entity: { id: string; name: string; code: string };
};

type Category = { id: string; name: string; order: number };
type BankAccount = { id: string; name: string; code: string };
type Entity = { id: string; name: string; code: string };

const CATEGORIES_ORDER = [
  "Fournisseurs",
  "Loyers",
  "Charges personnel",
  "Charges fiscales",
  "Banque",
  "Autres charges",
];

const METHOD_LABELS: Record<string, string> = {
  VIREMENT: "Vir.",
  PRELEVEMENT: "Prél.",
  CHEQUE: "Chq.",
  CB: "CB",
  EFFET: "Eff.",
};

function fmt(amount: number) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function toDateKey(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

export default function PlanningPage() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());

  const [payments, setPayments] = useState<Payment[]>([]);
  const [revenues, setRevenues] = useState<Revenue[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [entities, setEntities] = useState<Entity[]>([]);

  // Modal state
  const [modal, setModal] = useState<null | "payment" | "revenue">(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  // Form state
  const [form, setForm] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    const from = new Date(year, month, 1).toISOString();
    const to = new Date(year, month + 1, 0, 23, 59, 59).toISOString();
    const qs = `from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;

    const [p, r, c, b, e] = await Promise.all([
      fetch(`/api/payments?${qs}`).then((x) => x.json()),
      fetch(`/api/revenues?${qs}`).then((x) => x.json()),
      fetch("/api/categories").then((x) => x.json()),
      fetch("/api/bank-accounts").then((x) => x.json()),
      fetch("/api/entities").then((x) => x.json()),
    ]);
    setPayments(p);
    setRevenues(r);
    setCategories(c);
    setBankAccounts(b);
    setEntities(e);
  }, [year, month]);

  useEffect(() => {
    load();
  }, [load]);

  // Group payments and revenues by day
  const paymentsByDay: Record<string, Payment[]> = {};
  const revenuesByDay: Record<string, Revenue[]> = {};

  for (const p of payments) {
    const key = toDateKey(new Date(p.dueDate));
    paymentsByDay[key] = paymentsByDay[key] ?? [];
    paymentsByDay[key].push(p);
  }
  for (const r of revenues) {
    const key = toDateKey(new Date(r.date));
    revenuesByDay[key] = revenuesByDay[key] ?? [];
    revenuesByDay[key].push(r);
  }

  // Compute cumulative starting balance (sum of all prior months payments)
  // For simplicity, we start from 0 and compute within the month
  const daysInMonth = getDaysInMonth(year, month);
  const days = Array.from({ length: daysInMonth }, (_, i) => {
    const d = new Date(year, month, i + 1);
    return toDateKey(d);
  });

  let cumul = 0;
  const dayData = days.map((dateKey) => {
    const dayPayments = paymentsByDay[dateKey] ?? [];
    const dayRevenues = revenuesByDay[dateKey] ?? [];
    const totalExpenses = dayPayments.reduce((s, p) => s + p.amount, 0);
    const totalRevenues = dayRevenues.reduce((s, r) => s + r.amount, 0);
    const balance = totalRevenues - totalExpenses;
    cumul += balance;
    return { dateKey, dayPayments, dayRevenues, totalExpenses, totalRevenues, balance, cumul };
  });

  // Group payments by category for display
  function getPaymentsByCategory(dayPayments: Payment[]) {
    const grouped: Record<string, Payment[]> = {};
    for (const p of dayPayments) {
      const cat = p.category.name;
      grouped[cat] = grouped[cat] ?? [];
      grouped[cat].push(p);
    }
    return grouped;
  }

  const monthNames = [
    "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
    "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
  ];

  function prevMonth() {
    if (month === 0) { setYear(y => y - 1); setMonth(11); }
    else setMonth(m => m - 1);
  }
  function nextMonth() {
    if (month === 11) { setYear(y => y + 1); setMonth(0); }
    else setMonth(m => m + 1);
  }

  async function submitPayment() {
    await fetch("/api/payments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        label: form.label,
        amount: parseFloat(form.amount.replace(",", ".")),
        dueDate: selectedDate,
        method: form.method,
        categoryId: form.categoryId,
        bankAccountId: form.bankAccountId,
        notes: form.notes,
      }),
    });
    setModal(null);
    setForm({});
    load();
  }

  async function submitRevenue() {
    await fetch("/api/revenues", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amount: parseFloat(form.amount.replace(",", ".")),
        date: selectedDate,
        entityId: form.entityId,
        notes: form.notes,
      }),
    });
    setModal(null);
    setForm({});
    load();
  }

  async function togglePaid(payment: Payment) {
    await fetch(`/api/payments/${payment.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isPaid: !payment.isPaid }),
    });
    load();
  }

  async function deletePayment(id: string) {
    if (!confirm("Supprimer ce paiement ?")) return;
    await fetch(`/api/payments/${id}`, { method: "DELETE" });
    load();
  }

  async function deleteRevenue(id: string) {
    if (!confirm("Supprimer cette recette ?")) return;
    await fetch(`/api/revenues/${id}`, { method: "DELETE" });
    load();
  }

  const dayNames = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
  const firstDayOfMonth = new Date(year, month, 1).getDay();
  const firstDayOffset = (firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1);

  return (
    <div className="space-y-4">
      {/* Header navigation */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Planning Trésorerie</h1>
        <div className="flex items-center gap-4">
          <button
            onClick={prevMonth}
            className="p-2 rounded-lg border border-gray-200 hover:bg-gray-100 text-gray-600"
          >
            ‹
          </button>
          <span className="text-lg font-semibold text-gray-800 min-w-[160px] text-center">
            {monthNames[month]} {year}
          </span>
          <button
            onClick={nextMonth}
            className="p-2 rounded-lg border border-gray-200 hover:bg-gray-100 text-gray-600"
          >
            ›
          </button>
        </div>
      </div>

      {/* Calendar grid */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        {/* Day headers */}
        <div className="grid grid-cols-7 border-b border-gray-200 bg-gray-50">
          {dayNames.map((d) => (
            <div key={d} className="px-2 py-2 text-xs font-semibold text-gray-500 text-center">
              {d}
            </div>
          ))}
        </div>

        {/* Calendar body */}
        <div className="grid grid-cols-7">
          {/* Empty cells before first day */}
          {Array.from({ length: firstDayOffset }).map((_, i) => (
            <div key={`empty-${i}`} className="min-h-[100px] bg-gray-50 border-r border-b border-gray-100" />
          ))}

          {/* Day cells */}
          {dayData.map(({ dateKey, dayPayments, dayRevenues, totalExpenses, totalRevenues, balance, cumul: cumulVal }) => {
            const dayNum = parseInt(dateKey.slice(8, 10));
            const isToday = dateKey === toDateKey(today);
            const payByCategory = getPaymentsByCategory(dayPayments);
            const hasActivity = dayPayments.length > 0 || dayRevenues.length > 0;

            return (
              <div
                key={dateKey}
                className={`min-h-[100px] border-r border-b border-gray-100 p-1.5 flex flex-col gap-1 ${
                  isToday ? "bg-blue-50" : ""
                }`}
              >
                {/* Day number + actions */}
                <div className="flex items-center justify-between mb-0.5">
                  <span
                    className={`text-xs font-bold w-5 h-5 flex items-center justify-center rounded-full ${
                      isToday
                        ? "bg-blue-600 text-white"
                        : "text-gray-600"
                    }`}
                  >
                    {dayNum}
                  </span>
                  <div className="flex gap-1">
                    <button
                      onClick={() => { setSelectedDate(dateKey); setModal("payment"); setForm({ method: "VIREMENT" }); }}
                      className="text-xs text-gray-400 hover:text-blue-600 leading-none"
                      title="Ajouter un paiement"
                    >
                      +€
                    </button>
                    <button
                      onClick={() => { setSelectedDate(dateKey); setModal("revenue"); setForm({}); }}
                      className="text-xs text-gray-400 hover:text-green-600 leading-none"
                      title="Ajouter une recette"
                    >
                      +↑
                    </button>
                  </div>
                </div>

                {/* Payments by category */}
                {CATEGORIES_ORDER.filter(cat => payByCategory[cat]).map(cat => (
                  <div key={cat}>
                    <p className="text-[9px] text-gray-400 uppercase font-semibold leading-none mb-0.5">{cat.slice(0, 12)}</p>
                    {payByCategory[cat].map(p => (
                      <div
                        key={p.id}
                        className={`flex items-center gap-1 text-[10px] leading-tight group ${
                          p.isPaid ? "opacity-50 line-through" : ""
                        }`}
                      >
                        <span className="font-medium text-gray-800 truncate flex-1" title={p.label}>
                          {p.label}
                        </span>
                        <span className="text-red-600 font-semibold shrink-0">
                          {fmt(-p.amount)}
                        </span>
                        <span className="text-gray-400 hidden group-hover:inline text-[9px]">
                          {METHOD_LABELS[p.method]}
                        </span>
                        <button
                          onClick={() => togglePaid(p)}
                          className="hidden group-hover:inline text-gray-400 hover:text-green-600"
                          title={p.isPaid ? "Marquer non payé" : "Marquer payé"}
                        >
                          ✓
                        </button>
                        <button
                          onClick={() => deletePayment(p.id)}
                          className="hidden group-hover:inline text-gray-400 hover:text-red-600"
                          title="Supprimer"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                ))}

                {/* Revenues */}
                {dayRevenues.length > 0 && (
                  <div>
                    <p className="text-[9px] text-gray-400 uppercase font-semibold leading-none mb-0.5">Recettes</p>
                    {dayRevenues.map(r => (
                      <div key={r.id} className="flex items-center gap-1 text-[10px] leading-tight group">
                        <span className="text-gray-600 truncate flex-1">{r.entity.name}</span>
                        <span className="text-green-600 font-semibold shrink-0">{fmt(r.amount)}</span>
                        <button
                          onClick={() => deleteRevenue(r.id)}
                          className="hidden group-hover:inline text-gray-400 hover:text-red-600"
                          title="Supprimer"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Balance + Cumul */}
                {hasActivity && (
                  <div className="mt-auto pt-1 border-t border-gray-100 space-y-0.5">
                    <div className="flex justify-between text-[10px]">
                      <span className="text-gray-400">Balance</span>
                      <span className={`font-semibold ${balance >= 0 ? "text-green-600" : "text-red-600"}`}>
                        {fmt(balance)}
                      </span>
                    </div>
                    <div className="flex justify-between text-[10px]">
                      <span className="text-gray-400">Cumul</span>
                      <span className={`font-semibold ${cumulVal >= 0 ? "text-blue-600" : "text-red-700"}`}>
                        {fmt(cumulVal)}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Monthly summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
          <p className="text-xs text-gray-500 mb-1">Total dépenses du mois</p>
          <p className="text-xl font-bold text-red-600">
            {fmt(dayData.reduce((s, d) => s + d.totalExpenses, 0))}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
          <p className="text-xs text-gray-500 mb-1">Total recettes du mois</p>
          <p className="text-xl font-bold text-green-600">
            {fmt(dayData.reduce((s, d) => s + d.totalRevenues, 0))}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
          <p className="text-xs text-gray-500 mb-1">Solde net du mois</p>
          <p className={`text-xl font-bold ${dayData[dayData.length - 1]?.cumul >= 0 ? "text-blue-600" : "text-red-600"}`}>
            {fmt(dayData[dayData.length - 1]?.cumul ?? 0)}
          </p>
        </div>
      </div>

      {/* Modal Paiement */}
      {modal === "payment" && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md">
            <h2 className="text-lg font-bold text-gray-900 mb-4">
              Nouveau paiement — {selectedDate}
            </h2>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-600">Libellé</label>
                <input
                  className="mt-1 w-full border border-gray-300 rounded px-3 py-2 text-sm"
                  value={form.label ?? ""}
                  onChange={(e) => setForm(f => ({ ...f, label: e.target.value }))}
                  placeholder="Nom du fournisseur / charge"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">Montant (€)</label>
                <input
                  className="mt-1 w-full border border-gray-300 rounded px-3 py-2 text-sm"
                  value={form.amount ?? ""}
                  onChange={(e) => setForm(f => ({ ...f, amount: e.target.value }))}
                  placeholder="0,00"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">Mode de paiement</label>
                <select
                  className="mt-1 w-full border border-gray-300 rounded px-3 py-2 text-sm"
                  value={form.method ?? "VIREMENT"}
                  onChange={(e) => setForm(f => ({ ...f, method: e.target.value }))}
                >
                  <option value="VIREMENT">Virement</option>
                  <option value="PRELEVEMENT">Prélèvement</option>
                  <option value="CHEQUE">Chèque</option>
                  <option value="CB">CB</option>
                  <option value="EFFET">Effet</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">Catégorie</label>
                <select
                  className="mt-1 w-full border border-gray-300 rounded px-3 py-2 text-sm"
                  value={form.categoryId ?? ""}
                  onChange={(e) => setForm(f => ({ ...f, categoryId: e.target.value }))}
                >
                  <option value="">— Choisir —</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">Compte bancaire</label>
                <select
                  className="mt-1 w-full border border-gray-300 rounded px-3 py-2 text-sm"
                  value={form.bankAccountId ?? ""}
                  onChange={(e) => setForm(f => ({ ...f, bankAccountId: e.target.value }))}
                >
                  <option value="">— Choisir —</option>
                  {bankAccounts.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">Notes</label>
                <input
                  className="mt-1 w-full border border-gray-300 rounded px-3 py-2 text-sm"
                  value={form.notes ?? ""}
                  onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="Optionnel"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button
                onClick={submitPayment}
                disabled={!form.label || !form.amount || !form.categoryId || !form.bankAccountId}
                className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Enregistrer
              </button>
              <button
                onClick={() => { setModal(null); setForm({}); }}
                className="flex-1 border border-gray-300 text-gray-700 rounded-lg py-2 text-sm hover:bg-gray-50"
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Recette */}
      {modal === "revenue" && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md">
            <h2 className="text-lg font-bold text-gray-900 mb-4">
              Nouvelle recette — {selectedDate}
            </h2>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-600">Entité</label>
                <select
                  className="mt-1 w-full border border-gray-300 rounded px-3 py-2 text-sm"
                  value={form.entityId ?? ""}
                  onChange={(e) => setForm(f => ({ ...f, entityId: e.target.value }))}
                >
                  <option value="">— Choisir —</option>
                  {entities.map((e) => (
                    <option key={e.id} value={e.id}>{e.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">Montant (€)</label>
                <input
                  className="mt-1 w-full border border-gray-300 rounded px-3 py-2 text-sm"
                  value={form.amount ?? ""}
                  onChange={(e) => setForm(f => ({ ...f, amount: e.target.value }))}
                  placeholder="0,00"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">Notes</label>
                <input
                  className="mt-1 w-full border border-gray-300 rounded px-3 py-2 text-sm"
                  value={form.notes ?? ""}
                  onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="Optionnel"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button
                onClick={submitRevenue}
                disabled={!form.entityId || !form.amount}
                className="flex-1 bg-green-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Enregistrer
              </button>
              <button
                onClick={() => { setModal(null); setForm({}); }}
                className="flex-1 border border-gray-300 text-gray-700 rounded-lg py-2 text-sm hover:bg-gray-50"
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
