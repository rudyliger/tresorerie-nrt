"use client";

import { useCallback, useEffect, useState } from "react";

type Payment = {
  id: string; label: string; amount: number; dueDate: string;
  method: string; isPaid: boolean; notes: string | null;
  category: { id: string; name: string };
  bankAccount: { id: string; name: string };
};
type Category = { id: string; name: string; order: number };

const fmt = (n: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(n);

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function toInputDate(iso: string) {
  return new Date(iso).toLocaleDateString("sv-SE"); // yyyy-mm-dd
}

const METHODS = ["VIREMENT", "PRELEVEMENT", "CHEQUE", "CB", "EFFET"] as const;
const METHOD_LABELS: Record<string, string> = {
  VIREMENT: "Virement", PRELEVEMENT: "Prélèvement", CHEQUE: "Chèque", CB: "CB", EFFET: "Effet",
};
const METHOD_BADGE: Record<string, string> = {
  VIREMENT: "bg-blue-100 text-blue-700", PRELEVEMENT: "bg-orange-100 text-orange-700",
  CHEQUE: "bg-purple-100 text-purple-700", CB: "bg-yellow-100 text-yellow-700", EFFET: "bg-gray-100 text-gray-500",
};

type EditState = { id: string; field: string; value: string };

export default function ListePage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [filterCat, setFilterCat] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterYear, setFilterYear] = useState(new Date().getFullYear().toString());
  const [edit, setEdit] = useState<EditState | null>(null);
  const [saving, setSaving] = useState<string | null>(null);

  const load = useCallback(async () => {
    const qs = new URLSearchParams();
    if (filterYear) {
      qs.set("from", `${filterYear}-01-01T00:00:00Z`);
      qs.set("to", `${filterYear}-12-31T23:59:59Z`);
    }
    if (filterCat !== "all") qs.set("categoryId", filterCat);
    if (filterStatus !== "all") qs.set("isPaid", filterStatus);

    const [p, c] = await Promise.all([
      fetch(`/api/payments?${qs}`).then((r) => r.json()),
      fetch("/api/categories").then((r) => r.json()),
    ]);
    setPayments(p);
    setCategories(c);
  }, [filterCat, filterStatus, filterYear]);

  useEffect(() => { load(); }, [load]);

  async function saveEdit(p: Payment, field: string, value: string) {
    setSaving(p.id);
    const body: Record<string, unknown> = {};
    if (field === "dueDate") body.dueDate = value + "T12:00:00.000Z";
    else if (field === "amount") body.amount = parseFloat(value.replace(",", "."));
    else if (field === "method") body.method = value;
    else if (field === "isPaid") body.isPaid = value === "true";
    else if (field === "label") body.label = value;

    await fetch(`/api/payments/${p.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setEdit(null);
    setSaving(null);
    load();
  }

  async function deletePayment(id: string) {
    if (!confirm("Supprimer ce paiement ?")) return;
    await fetch(`/api/payments/${id}`, { method: "DELETE" });
    load();
  }

  function startEdit(id: string, field: string, value: string) {
    setEdit({ id, field, value });
  }


  const totalAmount = payments.reduce((s, p) => s + p.amount, 0);
  const paidAmount = payments.filter((p) => p.isPaid).reduce((s, p) => s + p.amount, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Liste des échéances</h1>
        <div className="text-sm text-gray-500">
          <span className="font-semibold text-gray-900">{payments.length}</span> entrées ·{" "}
          <span className="text-red-600 font-semibold">{fmt(totalAmount)}</span> total ·{" "}
          <span className="text-green-600 font-semibold">{fmt(paidAmount)}</span> payé
        </div>
      </div>

      {/* Filtres */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-wrap gap-3 shadow-sm">
        <div>
          <label className="text-xs text-gray-500 block mb-1">Année</label>
          <select value={filterYear} onChange={(e) => setFilterYear(e.target.value)}
            className="border border-gray-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400">
            {[2025, 2026, 2027].map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-500 block mb-1">Catégorie</label>
          <select value={filterCat} onChange={(e) => setFilterCat(e.target.value)}
            className="border border-gray-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400">
            <option value="all">Toutes</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-500 block mb-1">Statut</label>
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
            className="border border-gray-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400">
            <option value="all">Tous</option>
            <option value="false">En attente</option>
            <option value="true">Payé</option>
          </select>
        </div>
      </div>

      {/* Tableau */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-xs text-gray-500 uppercase tracking-wide">
                <th className="text-left px-4 py-3 font-semibold">Date</th>
                <th className="text-left px-4 py-3 font-semibold">Libellé</th>
                <th className="text-left px-4 py-3 font-semibold">Catégorie</th>
                <th className="text-right px-4 py-3 font-semibold">Montant</th>
                <th className="text-left px-4 py-3 font-semibold">Mode</th>
                <th className="text-left px-4 py-3 font-semibold">Compte</th>
                <th className="text-center px-4 py-3 font-semibold">Statut</th>
                <th className="px-4 py-3 w-12"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {payments.map((p) => {
                const overdue = !p.isPaid && new Date(p.dueDate) < new Date();
                return (
                  <tr key={p.id}
                    className={`hover:bg-gray-50 ${saving === p.id ? "opacity-50" : ""} ${p.isPaid ? "opacity-60" : ""}`}>

                    {/* Date */}
                    <td className="px-4 py-2.5 text-gray-700 whitespace-nowrap">
                      {edit?.id === p.id && edit.field === "dueDate" ? (
                        <div className="flex items-center gap-1">
                          <input type="date" value={edit.value}
                            onChange={(e) => setEdit({ ...edit, value: e.target.value })}
                            className="border border-gray-300 rounded px-1.5 py-0.5 text-xs w-32"
                            autoFocus
                            onKeyDown={(e) => { if (e.key === "Enter") saveEdit(p, "dueDate", edit.value); if (e.key === "Escape") setEdit(null); }}
                          />
                          <button onClick={() => saveEdit(p, "dueDate", edit.value)} className="text-[10px] bg-blue-600 text-white px-1.5 py-0.5 rounded">✓</button>
                          <button onClick={() => setEdit(null)} className="text-[10px] text-gray-400 px-1">×</button>
                        </div>
                      ) : (
                        <span
                          onClick={() => startEdit(p.id, "dueDate", toInputDate(p.dueDate))}
                          className={`cursor-pointer hover:bg-blue-50 rounded px-1 -mx-1 ${overdue ? "text-red-600 font-semibold" : ""}`}>
                          {fmtDate(p.dueDate)}
                        </span>
                      )}
                    </td>

                    {/* Libellé */}
                    <td className="px-4 py-2.5 font-medium text-gray-900">
                      {edit?.id === p.id && edit.field === "label" ? (
                        <div className="flex items-center gap-1">
                          <input type="text" value={edit.value}
                            onChange={(e) => setEdit({ ...edit, value: e.target.value })}
                            className="border border-gray-300 rounded px-1.5 py-0.5 text-xs w-48"
                            autoFocus
                            onKeyDown={(e) => { if (e.key === "Enter") saveEdit(p, "label", edit.value); if (e.key === "Escape") setEdit(null); }}
                          />
                          <button onClick={() => saveEdit(p, "label", edit.value)} className="text-[10px] bg-blue-600 text-white px-1.5 py-0.5 rounded">✓</button>
                          <button onClick={() => setEdit(null)} className="text-[10px] text-gray-400 px-1">×</button>
                        </div>
                      ) : (
                        <span onClick={() => startEdit(p.id, "label", p.label)}
                          className="cursor-pointer hover:bg-blue-50 rounded px-1 -mx-1">
                          {p.label}
                        </span>
                      )}
                    </td>

                    {/* Catégorie */}
                    <td className="px-4 py-2.5 text-gray-500 text-xs">{p.category.name}</td>

                    {/* Montant */}
                    <td className="px-4 py-2.5 text-right font-semibold text-gray-900">
                      {edit?.id === p.id && edit.field === "amount" ? (
                        <div className="flex items-center justify-end gap-1">
                          <input type="text" value={edit.value}
                            onChange={(e) => setEdit({ ...edit, value: e.target.value })}
                            className="border border-gray-300 rounded px-1.5 py-0.5 text-xs w-24 text-right"
                            autoFocus
                            onKeyDown={(e) => { if (e.key === "Enter") saveEdit(p, "amount", edit.value); if (e.key === "Escape") setEdit(null); }}
                          />
                          <button onClick={() => saveEdit(p, "amount", edit.value)} className="text-[10px] bg-blue-600 text-white px-1.5 py-0.5 rounded">✓</button>
                          <button onClick={() => setEdit(null)} className="text-[10px] text-gray-400 px-1">×</button>
                        </div>
                      ) : (
                        <span onClick={() => startEdit(p.id, "amount", String(p.amount))}
                          className="cursor-pointer hover:bg-blue-50 rounded px-1 -mx-1">
                          {fmt(p.amount)}
                        </span>
                      )}
                    </td>

                    {/* Mode */}
                    <td className="px-4 py-2.5">
                      {edit?.id === p.id && edit.field === "method" ? (
                        <div className="flex items-center gap-1">
                          <select value={edit.value}
                            onChange={(e) => setEdit({ ...edit, value: e.target.value })}
                            className="border border-gray-300 rounded px-1.5 py-0.5 text-xs"
                            autoFocus
                            onBlur={() => saveEdit(p, "method", edit.value)}>
                            {METHODS.map((m) => <option key={m} value={m}>{METHOD_LABELS[m]}</option>)}
                          </select>
                        </div>
                      ) : (
                        <span onClick={() => startEdit(p.id, "method", p.method)}
                          className={`cursor-pointer text-xs px-2 py-0.5 rounded font-medium ${METHOD_BADGE[p.method]}`}>
                          {METHOD_LABELS[p.method]}
                        </span>
                      )}
                    </td>

                    {/* Compte */}
                    <td className="px-4 py-2.5 text-xs text-gray-500">{p.bankAccount.name}</td>

                    {/* Statut */}
                    <td className="px-4 py-2.5 text-center">
                      {edit?.id === p.id && edit.field === "isPaid" ? (
                        <div className="flex items-center justify-center gap-1">
                          <select value={edit.value}
                            onChange={(e) => setEdit({ ...edit, value: e.target.value })}
                            className="border border-gray-300 rounded px-1.5 py-0.5 text-xs"
                            autoFocus onBlur={() => saveEdit(p, "isPaid", edit.value)}>
                            <option value="false">En attente</option>
                            <option value="true">Payé</option>
                          </select>
                        </div>
                      ) : (
                        <span onClick={() => startEdit(p.id, "isPaid", String(p.isPaid))}
                          className={`cursor-pointer text-xs px-2 py-0.5 rounded-full font-medium ${p.isPaid ? "bg-green-100 text-green-700" : overdue ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-600"}`}>
                          {p.isPaid ? "Payé" : overdue ? "En retard" : "En attente"}
                        </span>
                      )}
                    </td>

                    {/* Supprimer */}
                    <td className="px-4 py-2.5 text-center">
                      <button onClick={() => deletePayment(p.id)}
                        className="text-gray-300 hover:text-red-500 text-lg leading-none transition-colors">×</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {payments.length === 0 && (
            <p className="text-center py-12 text-gray-400 text-sm">Aucun paiement pour ces filtres.</p>
          )}
        </div>
      </div>
    </div>
  );
}
