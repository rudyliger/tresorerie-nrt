"use client";

import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, X, Landmark, CalendarDays, TrendingDown } from "lucide-react";

type Loan = {
  id: string;
  name: string;
  bankName: string;
  initialAmount: number;
  remainingAmount: number;
  monthlyPayment: number;
  nextDueDate: string;
  endDate: string;
  notes: string | null;
};

type FormData = {
  name: string; bankName: string;
  initialAmount: string; remainingAmount: string; monthlyPayment: string;
  nextDueDate: string; endDate: string; notes: string;
};

const EMPTY_FORM: FormData = {
  name: "", bankName: "",
  initialAmount: "", remainingAmount: "", monthlyPayment: "",
  nextDueDate: "", endDate: "", notes: "",
};

const fmt = (n: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(n);

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });

function toInputDate(iso: string) {
  return new Date(iso).toLocaleDateString("sv-SE");
}

function progressPct(remaining: number, initial: number) {
  if (initial <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round(((initial - remaining) / initial) * 100)));
}

function monthsRemaining(endDate: string) {
  const end = new Date(endDate);
  const now = new Date();
  const diff = (end.getFullYear() - now.getFullYear()) * 12 + (end.getMonth() - now.getMonth());
  return Math.max(0, diff);
}

export default function PretsPage() {
  const [loans, setLoans] = useState<Loan[]>([]);
  const [modal, setModal] = useState<"add" | "edit" | null>(null);
  const [editing, setEditing] = useState<Loan | null>(null);
  const [form, setForm] = useState<FormData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    const data = await fetch("/api/loans").then((r) => r.json());
    setLoans(data);
  }
  useEffect(() => { load(); }, []);

  function openAdd() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setError("");
    setModal("add");
  }

  function openEdit(loan: Loan) {
    setEditing(loan);
    setForm({
      name: loan.name, bankName: loan.bankName,
      initialAmount: String(loan.initialAmount),
      remainingAmount: String(loan.remainingAmount),
      monthlyPayment: String(loan.monthlyPayment),
      nextDueDate: toInputDate(loan.nextDueDate),
      endDate: toInputDate(loan.endDate),
      notes: loan.notes ?? "",
    });
    setError("");
    setModal("edit");
  }

  function closeModal() { setModal(null); setEditing(null); }

  async function save() {
    setError("");
    if (!form.name || !form.bankName || !form.initialAmount || !form.remainingAmount || !form.monthlyPayment || !form.nextDueDate || !form.endDate) {
      setError("Tous les champs obligatoires doivent être remplis.");
      return;
    }
    setSaving(true);
    const payload = {
      name: form.name, bankName: form.bankName,
      initialAmount: form.initialAmount.replace(",", "."),
      remainingAmount: form.remainingAmount.replace(",", "."),
      monthlyPayment: form.monthlyPayment.replace(",", "."),
      nextDueDate: form.nextDueDate, endDate: form.endDate,
      notes: form.notes || null,
    };

    if (modal === "edit" && editing) {
      await fetch(`/api/loans/${editing.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } else {
      await fetch("/api/loans", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    }
    setSaving(false);
    closeModal();
    load();
  }

  async function deleteLoan(id: string) {
    if (!confirm("Supprimer ce prêt ?")) return;
    await fetch(`/api/loans/${id}`, { method: "DELETE" });
    load();
  }

  // KPIs
  const totalMonthly = loans.reduce((s, l) => s + l.monthlyPayment, 0);
  const totalRemaining = loans.reduce((s, l) => s + l.remainingAmount, 0);

  const fieldCls = "mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white";
  const labelCls = "text-xs font-medium text-slate-600";

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Prêts bancaires</h1>
          <p className="text-slate-400 text-sm mt-0.5">Suivi des encours et mensualités</p>
        </div>
        <button onClick={openAdd}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-xl hover:bg-indigo-700 transition-colors shadow-sm shadow-indigo-600/20">
          <Plus size={16} />
          Nouveau prêt
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-xl bg-indigo-50 flex items-center justify-center">
              <CalendarDays size={16} className="text-indigo-500" />
            </div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Mensualités totales</p>
          </div>
          <p className="text-3xl font-bold text-slate-900 tracking-tight">{fmt(totalMonthly)}</p>
          <p className="text-xs text-slate-400 mt-1">par mois sur {loans.length} prêt{loans.length > 1 ? "s" : ""}</p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-xl bg-amber-50 flex items-center justify-center">
              <TrendingDown size={16} className="text-amber-500" />
            </div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Capital restant dû</p>
          </div>
          <p className="text-3xl font-bold text-slate-900 tracking-tight">{fmt(totalRemaining)}</p>
          <p className="text-xs text-slate-400 mt-1">sur l'ensemble des prêts</p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-xl bg-slate-50 flex items-center justify-center">
              <Landmark size={16} className="text-slate-400" />
            </div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Prêts actifs</p>
          </div>
          <p className="text-3xl font-bold text-slate-900 tracking-tight">{loans.length}</p>
          <p className="text-xs text-slate-400 mt-1">
            {loans.length > 0
              ? `prochain : ${fmtDate(loans[0].nextDueDate)}`
              : "Aucun prêt enregistré"}
          </p>
        </div>
      </div>

      {/* Tableau */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {loans.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-400">
            <Landmark size={32} strokeWidth={1.2} />
            <p className="text-sm">Aucun prêt enregistré</p>
            <button onClick={openAdd}
              className="text-sm text-indigo-500 hover:underline font-medium">
              Ajouter un premier prêt →
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  <th className="text-left px-5 py-3.5">Prêt</th>
                  <th className="text-left px-4 py-3.5">Établissement</th>
                  <th className="text-right px-4 py-3.5">Montant initial</th>
                  <th className="text-right px-4 py-3.5">Capital restant</th>
                  <th className="text-center px-4 py-3.5">Remboursé</th>
                  <th className="text-right px-4 py-3.5">Mensualité</th>
                  <th className="text-center px-4 py-3.5">Prochaine éch.</th>
                  <th className="text-center px-4 py-3.5">Date de fin</th>
                  <th className="px-4 py-3.5 w-20"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {loans.map((loan) => {
                  const pct = progressPct(loan.remainingAmount, loan.initialAmount);
                  const months = monthsRemaining(loan.endDate);
                  const isNearEnd = months <= 12;
                  const nextOverdue = new Date(loan.nextDueDate) < new Date();

                  return (
                    <tr key={loan.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-5 py-4">
                        <p className="font-semibold text-slate-800">{loan.name}</p>
                        {loan.notes && <p className="text-xs text-slate-400 mt-0.5">{loan.notes}</p>}
                      </td>
                      <td className="px-4 py-4">
                        <span className="text-xs font-medium px-2.5 py-1 bg-slate-100 text-slate-600 rounded-lg">
                          {loan.bankName}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-right font-medium text-slate-500 tabular-nums">
                        {fmt(loan.initialAmount)}
                      </td>
                      <td className="px-4 py-4 text-right">
                        <p className="font-bold text-slate-900 tabular-nums">{fmt(loan.remainingAmount)}</p>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex flex-col items-center gap-1">
                          <div className="w-24 bg-slate-100 rounded-full h-1.5">
                            <div
                              className={`h-1.5 rounded-full ${pct >= 75 ? "bg-emerald-400" : pct >= 40 ? "bg-indigo-400" : "bg-amber-400"}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="text-[10px] text-slate-400 tabular-nums">{pct}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-right">
                        <p className="font-bold text-indigo-700 tabular-nums">{fmt(loan.monthlyPayment)}</p>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <span className={`text-xs font-medium px-2.5 py-1 rounded-lg ${nextOverdue ? "bg-red-50 text-red-600" : "bg-slate-50 text-slate-600"}`}>
                          {fmtDate(loan.nextDueDate)}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <span className={`text-xs font-medium px-2.5 py-1 rounded-lg ${isNearEnd ? "bg-amber-50 text-amber-600" : "bg-slate-50 text-slate-500"}`}>
                          {fmtDate(loan.endDate)}
                        </span>
                        {months > 0 && (
                          <p className="text-[10px] text-slate-400 mt-0.5">{months} mois</p>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center justify-center gap-1">
                          <button onClick={() => openEdit(loan)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors">
                            <Pencil size={13} />
                          </button>
                          <button onClick={() => deleteLoan(loan.id)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors">
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>

              {/* Ligne de total */}
              <tfoot>
                <tr className="border-t-2 border-slate-100 bg-slate-50">
                  <td colSpan={3} className="px-5 py-3.5 text-xs font-bold text-slate-500 uppercase tracking-wide">
                    Total
                  </td>
                  <td className="px-4 py-3.5 text-right font-bold text-slate-900 tabular-nums">
                    {fmt(totalRemaining)}
                  </td>
                  <td />
                  <td className="px-4 py-3.5 text-right font-bold text-indigo-700 tabular-nums">
                    {fmt(totalMonthly)}
                  </td>
                  <td colSpan={3} />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* ── Modal ajout / édition ──────────────────────────────────────────────── */}
      {modal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
              <h2 className="text-base font-bold text-slate-900">
                {modal === "add" ? "Nouveau prêt" : `Modifier — ${editing?.name}`}
              </h2>
              <button onClick={closeModal}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors">
                <X size={16} />
              </button>
            </div>

            {/* Form */}
            <div className="px-6 py-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className={labelCls}>Nom du prêt *</label>
                  <input className={fieldCls} value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    placeholder="Ex : Prêt immobilier Orléans" />
                </div>
                <div className="col-span-2">
                  <label className={labelCls}>Établissement bancaire *</label>
                  <input className={fieldCls} value={form.bankName}
                    onChange={(e) => setForm((f) => ({ ...f, bankName: e.target.value }))}
                    placeholder="Ex : CACL, Banque Populaire…" />
                </div>
                <div>
                  <label className={labelCls}>Montant initial (€) *</label>
                  <input className={fieldCls} value={form.initialAmount}
                    onChange={(e) => setForm((f) => ({ ...f, initialAmount: e.target.value }))}
                    placeholder="0" />
                </div>
                <div>
                  <label className={labelCls}>Capital restant dû (€) *</label>
                  <input className={fieldCls} value={form.remainingAmount}
                    onChange={(e) => setForm((f) => ({ ...f, remainingAmount: e.target.value }))}
                    placeholder="0" />
                </div>
                <div>
                  <label className={labelCls}>Mensualité (€) *</label>
                  <input className={fieldCls} value={form.monthlyPayment}
                    onChange={(e) => setForm((f) => ({ ...f, monthlyPayment: e.target.value }))}
                    placeholder="0" />
                </div>
                <div>
                  <label className={labelCls}>Prochaine échéance *</label>
                  <input type="date" className={fieldCls} value={form.nextDueDate}
                    onChange={(e) => setForm((f) => ({ ...f, nextDueDate: e.target.value }))} />
                </div>
                <div>
                  <label className={labelCls}>Date de fin *</label>
                  <input type="date" className={fieldCls} value={form.endDate}
                    onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))} />
                </div>
                <div>
                  <label className={labelCls}>Notes</label>
                  <input className={fieldCls} value={form.notes}
                    onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                    placeholder="Optionnel" />
                </div>
              </div>

              {error && <p className="text-sm text-red-500">{error}</p>}
            </div>

            {/* Footer */}
            <div className="flex gap-3 px-6 py-4 border-t border-slate-100">
              <button onClick={save} disabled={saving}
                className="flex-1 py-2.5 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-colors shadow-sm shadow-indigo-600/20">
                {saving ? "Enregistrement…" : modal === "add" ? "Ajouter le prêt" : "Enregistrer les modifications"}
              </button>
              <button onClick={closeModal}
                className="px-5 py-2.5 border border-slate-200 text-slate-600 text-sm font-medium rounded-xl hover:bg-slate-50 transition-colors">
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
