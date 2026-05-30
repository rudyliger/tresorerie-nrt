"use client";

import { useEffect, useState } from "react";

type BankAccount = {
  id: string;
  name: string;
  code: string;
  currentBalance: number;
};

type Payment = {
  id: string;
  label: string;
  amount: number;
  dueDate: string;
  method: string;
  isPaid: boolean;
  category: { name: string };
  bankAccount: { name: string };
};

type DashboardData = {
  bankAccounts: BankAccount[];
  totalBalances: number;
  overduePayments: Payment[];
  overdueTotal: number;
  dueIn7Days: Payment[];
  dueIn7DaysTotal: number;
  dueIn30Days: Payment[];
  dueIn30DaysTotal: number;
};

function fmt(amount: number) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
  }).format(amount);
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

const METHOD_LABELS: Record<string, string> = {
  VIREMENT: "Virement",
  PRELEVEMENT: "Prélèvement",
  CHEQUE: "Chèque",
  CB: "CB",
  EFFET: "Effet",
};

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  async function load() {
    const res = await fetch("/api/dashboard");
    setData(await res.json());
  }

  useEffect(() => {
    load();
  }, []);

  async function saveBalance(id: string) {
    const balance = parseFloat(editValue.replace(",", "."));
    if (isNaN(balance)) return;
    await fetch("/api/bank-accounts", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, currentBalance: balance }),
    });
    setEditing(null);
    load();
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        Chargement…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Dashboard Trésorerie</h1>

      {/* Soldes bancaires */}
      <section>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
          Comptes bancaires
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {data.bankAccounts.map((acc) => (
            <div
              key={acc.id}
              className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm"
            >
              <p className="text-sm text-gray-500 mb-1">{acc.name}</p>
              {editing === acc.id ? (
                <div className="flex gap-2 mt-2">
                  <input
                    type="text"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    className="border border-gray-300 rounded px-2 py-1 text-sm w-32"
                    placeholder="Solde"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter") saveBalance(acc.id);
                      if (e.key === "Escape") setEditing(null);
                    }}
                  />
                  <button
                    onClick={() => saveBalance(acc.id)}
                    className="text-xs bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700"
                  >
                    OK
                  </button>
                  <button
                    onClick={() => setEditing(null)}
                    className="text-xs text-gray-500 hover:text-gray-700"
                  >
                    Annuler
                  </button>
                </div>
              ) : (
                <div className="flex items-end justify-between mt-1">
                  <p
                    className={`text-2xl font-bold ${
                      acc.currentBalance < 0 ? "text-red-600" : "text-gray-900"
                    }`}
                  >
                    {fmt(acc.currentBalance)}
                  </p>
                  <button
                    onClick={() => {
                      setEditing(acc.id);
                      setEditValue(acc.currentBalance.toString());
                    }}
                    className="text-xs text-blue-500 hover:underline"
                  >
                    Modifier
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
        <div className="mt-3 bg-blue-50 border border-blue-200 rounded-lg px-5 py-3 inline-flex items-center gap-3">
          <span className="text-sm text-blue-700 font-medium">Total</span>
          <span
            className={`text-xl font-bold ${
              data.totalBalances < 0 ? "text-red-600" : "text-blue-800"
            }`}
          >
            {fmt(data.totalBalances)}
          </span>
        </div>
      </section>

      {/* Alertes et échéances */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Échéances dépassées */}
        <div className="bg-white rounded-xl border border-red-200 shadow-sm overflow-hidden">
          <div className="bg-red-50 border-b border-red-200 px-5 py-3 flex justify-between items-center">
            <h3 className="text-sm font-semibold text-red-700">
              Échéances dépassées
            </h3>
            <span className="text-sm font-bold text-red-700">
              {fmt(data.overdueTotal)}
            </span>
          </div>
          {data.overduePayments.length === 0 ? (
            <p className="px-5 py-4 text-sm text-gray-400">Aucune échéance</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {data.overduePayments.map((p) => (
                <li key={p.id} className="px-5 py-3">
                  <div className="flex justify-between">
                    <span className="text-sm font-medium text-gray-900">
                      {p.label}
                    </span>
                    <span className="text-sm font-bold text-red-600">
                      {fmt(p.amount)}
                    </span>
                  </div>
                  <div className="flex gap-2 mt-0.5">
                    <span className="text-xs text-gray-400">
                      {fmtDate(p.dueDate)}
                    </span>
                    <span className="text-xs text-gray-400">·</span>
                    <span className="text-xs text-gray-400">
                      {p.bankAccount.name}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* À payer dans 7 jours */}
        <div className="bg-white rounded-xl border border-amber-200 shadow-sm overflow-hidden">
          <div className="bg-amber-50 border-b border-amber-200 px-5 py-3 flex justify-between items-center">
            <h3 className="text-sm font-semibold text-amber-700">
              À payer dans 7 jours
            </h3>
            <span className="text-sm font-bold text-amber-700">
              {fmt(data.dueIn7DaysTotal)}
            </span>
          </div>
          {data.dueIn7Days.length === 0 ? (
            <p className="px-5 py-4 text-sm text-gray-400">Aucun paiement</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {data.dueIn7Days.map((p) => (
                <li key={p.id} className="px-5 py-3">
                  <div className="flex justify-between">
                    <span className="text-sm font-medium text-gray-900">
                      {p.label}
                    </span>
                    <span className="text-sm font-bold text-gray-900">
                      {fmt(p.amount)}
                    </span>
                  </div>
                  <div className="flex gap-2 mt-0.5">
                    <span className="text-xs text-gray-400">
                      {fmtDate(p.dueDate)}
                    </span>
                    <span className="text-xs text-gray-400">·</span>
                    <span className="text-xs text-gray-400">
                      {METHOD_LABELS[p.method] ?? p.method}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* À payer dans 30 jours */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="bg-gray-50 border-b border-gray-200 px-5 py-3 flex justify-between items-center">
            <h3 className="text-sm font-semibold text-gray-700">
              À payer dans 30 jours
            </h3>
            <span className="text-sm font-bold text-gray-700">
              {fmt(data.dueIn30DaysTotal)}
            </span>
          </div>
          {data.dueIn30Days.length === 0 ? (
            <p className="px-5 py-4 text-sm text-gray-400">Aucun paiement</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {data.dueIn30Days.map((p) => (
                <li key={p.id} className="px-5 py-3">
                  <div className="flex justify-between">
                    <span className="text-sm font-medium text-gray-900">
                      {p.label}
                    </span>
                    <span className="text-sm font-bold text-gray-900">
                      {fmt(p.amount)}
                    </span>
                  </div>
                  <div className="flex gap-2 mt-0.5">
                    <span className="text-xs text-gray-400">
                      {fmtDate(p.dueDate)}
                    </span>
                    <span className="text-xs text-gray-400">·</span>
                    <span className="text-xs text-gray-400">
                      {p.category.name}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
