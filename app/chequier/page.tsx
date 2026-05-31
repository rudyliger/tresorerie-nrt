"use client";

import { useEffect, useState, useCallback } from "react";
import { Plus, Pencil, Trash2, X, BookOpen, Clock, CheckCircle2, Ban } from "lucide-react";

type ChequeStatus = "EN_ATTENTE" | "ENCAISSE" | "ANNULE";

type Cheque = {
  id: string;
  number: string;
  recipient: string;
  subject: string;
  amount: number;
  issuedAt: string;
  expectedCashDate: string | null;
  actualCashDate: string | null;
  status: ChequeStatus;
  notes: string | null;
};

type FormData = {
  number: string; recipient: string; subject: string; amount: string;
  issuedAt: string; expectedCashDate: string; notes: string;
};

const EMPTY_FORM: FormData = {
  number: "", recipient: "", subject: "", amount: "",
  issuedAt: new Date().toLocaleDateString("sv-SE"), expectedCashDate: "", notes: "",
};

const fmt = (n: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(n);

const fmtDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" }) : "—";

const toInputDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("sv-SE") : "";

const STATUS_CONFIG: Record<ChequeStatus, { label: string; badge: string; icon: React.ElementType }> = {
  EN_ATTENTE: { label: "En attente",  badge: "bg-amber-50 text-amber-600 border border-amber-200",  icon: Clock },
  ENCAISSE:   { label: "Encaissé",    badge: "bg-emerald-50 text-emerald-600 border border-emerald-200", icon: CheckCircle2 },
  ANNULE:     { label: "Annulé",      badge: "bg-slate-100 text-slate-500 border border-slate-200",  icon: Ban },
};

const STATUSES: ChequeStatus[] = ["EN_ATTENTE", "ENCAISSE", "ANNULE"];

export default function ChequierPage() {
  const [cheques, setCheques] = useState<Cheque[]>([]);
  const [filterStatus, setFilterStatus] = useState<ChequeStatus | "all">("all");
  const [modal, setModal] = useState<"add" | "edit" | null>(null);
  const [editing, setEditing] = useState<Cheque | null>(null);
  const [form, setForm] = useState<FormData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const qs = filterStatus !== "all" ? `?status=${filterStatus}` : "";
    const data = await fetch(`/api/cheques${qs}`).then((r) => r.json());
    setCheques(data);
  }, [filterStatus]);

  useEffect(() => { load(); }, [load]);

  function openAdd() {
    setEditing(null); setForm(EMPTY_FORM); setError(""); setModal("add");
  }

  function openEdit(c: Cheque) {
    setEditing(c);
    setForm({
      number: c.number, recipient: c.recipient, subject: c.subject,
      amount: String(c.amount),
      issuedAt: toInputDate(c.issuedAt),
      expectedCashDate: toInputDate(c.expectedCashDate),
      notes: c.notes ?? "",
    });
    setError(""); setModal("edit");
  }

  function closeModal() { setModal(null); setEditing(null); }

  async function save() {
    setError("");
    if (!form.number || !form.recipient || !form.subject || !form.amount || !form.issuedAt) {
      setError("Les champs obligatoires (*) doivent être remplis.");
      return;
    }
    setSaving(true);
    const payload = {
      number: form.number, recipient: form.recipient, subject: form.subject,
      amount: form.amount.replace(",", "."),
      issuedAt: form.issuedAt,
      expectedCashDate: form.expectedCashDate || null,
      notes: form.notes || null,
    };
    if (modal === "edit" && editing) {
      await fetch(`/api/cheques/${editing.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } else {
      await fetch("/api/cheques", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    }
    setSaving(false); closeModal(); load();
  }

  async function updateStatus(id: string, status: ChequeStatus) {
    setUpdatingId(id);
    await fetch(`/api/cheques/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    setUpdatingId(null); load();
  }

  async function deleteCheque(id: string) {
    if (!confirm("Supprimer ce chèque ?")) return;
    await fetch(`/api/cheques/${id}`, { method: "DELETE" });
    load();
  }

  // KPIs calculés sur tous les chèques (pas filtrés)
  const [allCheques, setAllCheques] = useState<Cheque[]>([]);
  useEffect(() => {
    fetch("/api/cheques").then((r) => r.json()).then(setAllCheques);
  }, [cheques]);

  const enAttente = allCheques.filter((c) => c.status === "EN_ATTENTE");
  const totalEnAttente = enAttente.reduce((s, c) => s + c.amount, 0);
  const totalAll = allCheques.reduce((s, c) => s + c.amount, 0);
  const encaisseCeMois = allCheques.filter((c) => {
    if (c.status !== "ENCAISSE" || !c.actualCashDate) return false;
    const d = new Date(c.actualCashDate);
    const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });

  const fieldCls = "mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white";
  const labelCls = "text-xs font-medium text-slate-600";

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Chéquier</h1>
          <p className="text-slate-400 text-sm mt-0.5">Suivi des chèques émis et de leur encaissement</p>
        </div>
        <button onClick={openAdd}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-xl hover:bg-indigo-700 transition-colors shadow-sm shadow-indigo-600/20">
          <Plus size={16} />
          Nouveau chèque
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-xl bg-amber-50 flex items-center justify-center">
              <Clock size={16} className="text-amber-500" />
            </div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">En attente</p>
          </div>
          <p className="text-3xl font-bold text-slate-900 tracking-tight">{fmt(totalEnAttente)}</p>
          <p className="text-xs text-slate-400 mt-1">{enAttente.length} chèque{enAttente.length > 1 ? "s" : ""} non encaissé{enAttente.length > 1 ? "s" : ""}</p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-xl bg-emerald-50 flex items-center justify-center">
              <CheckCircle2 size={16} className="text-emerald-500" />
            </div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Encaissés ce mois</p>
          </div>
          <p className="text-3xl font-bold text-slate-900 tracking-tight">
            {fmt(encaisseCeMois.reduce((s, c) => s + c.amount, 0))}
          </p>
          <p className="text-xs text-slate-400 mt-1">{encaisseCeMois.length} chèque{encaisseCeMois.length > 1 ? "s" : ""}</p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-xl bg-slate-50 flex items-center justify-center">
              <BookOpen size={16} className="text-slate-400" />
            </div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total émis</p>
          </div>
          <p className="text-3xl font-bold text-slate-900 tracking-tight">{fmt(totalAll)}</p>
          <p className="text-xs text-slate-400 mt-1">{allCheques.length} chèque{allCheques.length > 1 ? "s" : ""} au total</p>
        </div>
      </div>

      {/* Filtre statut */}
      <div className="flex items-center gap-2">
        {(["all", ...STATUSES] as const).map((s) => {
          const active = filterStatus === s;
          const cfg = s !== "all" ? STATUS_CONFIG[s] : null;
          return (
            <button key={s} onClick={() => setFilterStatus(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                active
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "bg-white border border-slate-200 text-slate-500 hover:text-slate-700"
              }`}>
              {cfg ? cfg.label : "Tous"}
            </button>
          );
        })}
      </div>

      {/* Tableau */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {cheques.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-400">
            <BookOpen size={32} strokeWidth={1.2} />
            <p className="text-sm">Aucun chèque{filterStatus !== "all" ? " pour ce statut" : ""}</p>
            {filterStatus === "all" && (
              <button onClick={openAdd} className="text-sm text-indigo-500 hover:underline font-medium">
                Ajouter un premier chèque →
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  <th className="text-left px-5 py-3.5">N° chèque</th>
                  <th className="text-left px-4 py-3.5">Destinataire</th>
                  <th className="text-left px-4 py-3.5">Objet</th>
                  <th className="text-right px-4 py-3.5">Montant</th>
                  <th className="text-center px-4 py-3.5">Date émission</th>
                  <th className="text-center px-4 py-3.5">Prévu encaissement</th>
                  <th className="text-center px-4 py-3.5">Encaissé le</th>
                  <th className="text-center px-4 py-3.5">Statut</th>
                  <th className="px-4 py-3.5 w-20"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {cheques.map((c) => {
                  const cfg = STATUS_CONFIG[c.status];
                  const StatusIcon = cfg.icon;
                  const isCancelled = c.status === "ANNULE";
                  const isUpdating = updatingId === c.id;

                  return (
                    <tr key={c.id}
                      className={`transition-colors ${isCancelled ? "opacity-50" : "hover:bg-slate-50/70"} ${isUpdating ? "opacity-40 pointer-events-none" : ""}`}>

                      {/* N° chèque */}
                      <td className="px-5 py-3.5">
                        <span className="font-mono text-sm font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                          {c.number}
                        </span>
                      </td>

                      {/* Destinataire */}
                      <td className="px-4 py-3.5">
                        <p className={`font-semibold text-slate-800 ${isCancelled ? "line-through" : ""}`}>{c.recipient}</p>
                        {c.notes && <p className="text-xs text-slate-400 mt-0.5">{c.notes}</p>}
                      </td>

                      {/* Objet */}
                      <td className="px-4 py-3.5 text-slate-500 text-xs max-w-[160px] truncate" title={c.subject}>
                        {c.subject}
                      </td>

                      {/* Montant */}
                      <td className="px-4 py-3.5 text-right">
                        <p className={`font-bold tabular-nums ${isCancelled ? "text-slate-400 line-through" : "text-slate-900"}`}>
                          {fmt(c.amount)}
                        </p>
                      </td>

                      {/* Date émission */}
                      <td className="px-4 py-3.5 text-center">
                        <span className="text-xs text-slate-500 tabular-nums">{fmtDate(c.issuedAt)}</span>
                      </td>

                      {/* Prévu encaissement */}
                      <td className="px-4 py-3.5 text-center">
                        {c.expectedCashDate ? (
                          <span className={`text-xs tabular-nums ${
                            c.status === "EN_ATTENTE" && new Date(c.expectedCashDate) < new Date()
                              ? "text-red-500 font-semibold"
                              : "text-slate-500"
                          }`}>
                            {fmtDate(c.expectedCashDate)}
                          </span>
                        ) : (
                          <span className="text-slate-300 text-xs">—</span>
                        )}
                      </td>

                      {/* Date réelle encaissement */}
                      <td className="px-4 py-3.5 text-center">
                        {c.actualCashDate ? (
                          <span className="text-xs text-emerald-600 font-medium tabular-nums">
                            {fmtDate(c.actualCashDate)}
                          </span>
                        ) : (
                          <span className="text-slate-300 text-xs">—</span>
                        )}
                      </td>

                      {/* Statut — select inline */}
                      <td className="px-4 py-3.5 text-center">
                        <div className="relative inline-block">
                          <select
                            value={c.status}
                            onChange={(e) => updateStatus(c.id, e.target.value as ChequeStatus)}
                            className={`appearance-none text-xs font-semibold px-3 py-1.5 rounded-lg cursor-pointer border focus:outline-none focus:ring-2 focus:ring-indigo-400 pr-6 ${cfg.badge}`}
                          >
                            {STATUSES.map((s) => (
                              <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>
                            ))}
                          </select>
                          <StatusIcon size={10} className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none opacity-60" />
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3.5">
                        <div className="flex items-center justify-center gap-1">
                          <button onClick={() => openEdit(c)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors">
                            <Pencil size={13} />
                          </button>
                          <button onClick={() => deleteCheque(c.id)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors">
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>

              {/* Pied de tableau — total des lignes visibles */}
              {cheques.length > 1 && (
                <tfoot>
                  <tr className="border-t-2 border-slate-100 bg-slate-50">
                    <td colSpan={3} className="px-5 py-3.5 text-xs font-bold text-slate-500 uppercase tracking-wide">
                      Total affiché
                    </td>
                    <td className="px-4 py-3.5 text-right font-bold text-slate-900 tabular-nums">
                      {fmt(cheques.filter((c) => c.status !== "ANNULE").reduce((s, c) => s + c.amount, 0))}
                    </td>
                    <td colSpan={5} />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
      </div>

      {/* ── Modal ajout / édition ────────────────────────────────────────────── */}
      {modal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
            <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
              <h2 className="text-base font-bold text-slate-900">
                {modal === "add" ? "Nouveau chèque" : `Modifier — chèque n°${editing?.number}`}
              </h2>
              <button onClick={closeModal}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors">
                <X size={16} />
              </button>
            </div>

            <div className="px-6 py-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>N° de chèque *</label>
                  <input className={fieldCls} value={form.number}
                    onChange={(e) => setForm((f) => ({ ...f, number: e.target.value }))}
                    placeholder="Ex : 1234567" />
                </div>
                <div>
                  <label className={labelCls}>Montant (€) *</label>
                  <input className={fieldCls} value={form.amount}
                    onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                    placeholder="0,00" />
                </div>
                <div className="col-span-2">
                  <label className={labelCls}>Destinataire *</label>
                  <input className={fieldCls} value={form.recipient}
                    onChange={(e) => setForm((f) => ({ ...f, recipient: e.target.value }))}
                    placeholder="Nom du bénéficiaire" />
                </div>
                <div className="col-span-2">
                  <label className={labelCls}>Objet du paiement *</label>
                  <input className={fieldCls} value={form.subject}
                    onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
                    placeholder="Ex : Loyer mai 2026" />
                </div>
                <div>
                  <label className={labelCls}>Date d'émission *</label>
                  <input type="date" className={fieldCls} value={form.issuedAt}
                    onChange={(e) => setForm((f) => ({ ...f, issuedAt: e.target.value }))} />
                </div>
                <div>
                  <label className={labelCls}>Prévu encaissement</label>
                  <input type="date" className={fieldCls} value={form.expectedCashDate}
                    onChange={(e) => setForm((f) => ({ ...f, expectedCashDate: e.target.value }))} />
                </div>
                <div className="col-span-2">
                  <label className={labelCls}>Notes</label>
                  <input className={fieldCls} value={form.notes}
                    onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                    placeholder="Optionnel" />
                </div>
              </div>
              {error && <p className="text-sm text-red-500">{error}</p>}
            </div>

            <div className="flex gap-3 px-6 py-4 border-t border-slate-100">
              <button onClick={save} disabled={saving}
                className="flex-1 py-2.5 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-colors shadow-sm shadow-indigo-600/20">
                {saving ? "Enregistrement…" : modal === "add" ? "Ajouter le chèque" : "Enregistrer"}
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
