"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Plus, Pencil, Trash2, X, BookOpen, Clock,
  CheckCircle2, Ban, Upload, ArrowUpDown, ArrowUp, ArrowDown,
} from "lucide-react";

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
  chequier: string | null;
  notes: string | null;
};

type FormData = {
  number: string; recipient: string; subject: string; amount: string;
  issuedAt: string; expectedCashDate: string; notes: string;
};

type SortField = "number" | "recipient" | "amount" | "issuedAt" | "expectedCashDate" | "status";
type SortDir   = "asc" | "desc";

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
  EN_ATTENTE: { label: "En attente", badge: "bg-amber-50 text-amber-600 border border-amber-200",      icon: Clock         },
  ENCAISSE:   { label: "Encaissé",   badge: "bg-emerald-50 text-emerald-600 border border-emerald-200", icon: CheckCircle2  },
  ANNULE:     { label: "Annulé",     badge: "bg-slate-100 text-slate-500 border border-slate-200",       icon: Ban           },
};
const STATUSES: ChequeStatus[] = ["EN_ATTENTE", "ENCAISSE", "ANNULE"];

const STATUS_SORT_ORDER: Record<ChequeStatus, number> = { EN_ATTENTE: 0, ENCAISSE: 1, ANNULE: 2 };

// ── Composant en-tête de colonne triable ────────────────────────────────────
function SortTh({
  field, label, active, dir, onSort, className = "",
}: {
  field: SortField; label: string; active: boolean; dir: SortDir;
  onSort: (f: SortField) => void; className?: string;
}) {
  const Icon = active ? (dir === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown;
  return (
    <th
      onClick={() => onSort(field)}
      className={`cursor-pointer select-none group ${className}`}
    >
      <span className="flex items-center gap-1">
        {label}
        <Icon size={11} className={active ? "text-indigo-500" : "text-slate-300 group-hover:text-slate-400"} />
      </span>
    </th>
  );
}

// ── Page principale ─────────────────────────────────────────────────────────
export default function ChequierPage() {
  const [cheques,    setCheques]    = useState<Cheque[]>([]);
  const [allCheques, setAllCheques] = useState<Cheque[]>([]);

  // Filtres
  const [filterStatus, setFilterStatus] = useState<ChequeStatus | "all">("all");
  const [filterYear,   setFilterYear]   = useState<number | "all">("all");

  // Tri
  const [sortField, setSortField] = useState<SortField>("number");
  const [sortDir,   setSortDir]   = useState<SortDir>("desc");

  // Édition inline du sujet
  const [editSubject, setEditSubject] = useState<{ id: string; value: string } | null>(null);

  // Modal ajout / édition
  const [modal,   setModal]   = useState<"add" | "edit" | null>(null);
  const [editing, setEditing] = useState<Cheque | null>(null);
  const [form,    setForm]    = useState<FormData>(EMPTY_FORM);
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState("");
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // Import
  const [importing,     setImporting]     = useState(false);
  const [importResult,  setImportResult]  = useState<{ imported: number; updated: number; duplicates: number; skipped: number } | null>(null);
  const [importError,   setImportError]   = useState("");
  const importFileRef = useRef<HTMLInputElement>(null);

  // ── Chargement ─────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    const qs = filterStatus !== "all" ? `?status=${filterStatus}` : "";
    const data = await fetch(`/api/cheques${qs}`).then((r) => r.json());
    setCheques(data);
  }, [filterStatus]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    fetch("/api/cheques").then((r) => r.json()).then(setAllCheques);
  }, [cheques]);

  // ── Données dérivées ───────────────────────────────────────────────────────
  const { yearList, yearCounts } = useMemo(() => {
    const counts: Record<number, number> = {};
    for (const c of allCheques) {
      const y = new Date(c.issuedAt).getFullYear();
      counts[y] = (counts[y] ?? 0) + 1;
    }
    const years = Object.keys(counts).map(Number).sort((a, b) => b - a);
    return { yearList: years, yearCounts: counts };
  }, [allCheques]);

  const displayedCheques = useMemo(() => {
    let list = cheques;
    if (filterYear !== "all") {
      list = list.filter((c) => new Date(c.issuedAt).getFullYear() === filterYear);
    }
    return [...list].sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case "number":
          cmp = (parseInt(a.number, 10) || 0) - (parseInt(b.number, 10) || 0);
          break;
        case "recipient":
          cmp = a.recipient.localeCompare(b.recipient, "fr");
          break;
        case "amount":
          cmp = a.amount - b.amount;
          break;
        case "issuedAt":
          cmp = new Date(a.issuedAt).getTime() - new Date(b.issuedAt).getTime();
          break;
        case "expectedCashDate":
          cmp = (a.expectedCashDate ? new Date(a.expectedCashDate).getTime() : 0)
              - (b.expectedCashDate ? new Date(b.expectedCashDate).getTime() : 0);
          break;
        case "status":
          cmp = STATUS_SORT_ORDER[a.status] - STATUS_SORT_ORDER[b.status];
          break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [cheques, filterYear, sortField, sortDir]);

  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir(field === "number" || field === "amount" || field === "issuedAt" ? "desc" : "asc");
    }
  }

  // ── KPIs ───────────────────────────────────────────────────────────────────
  const enAttente = allCheques.filter((c) => c.status === "EN_ATTENTE");
  const totalEnAttente = enAttente.reduce((s, c) => s + c.amount, 0);

  const now = new Date();
  const capFirst = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  const fmtMonthLabel = (d: Date) =>
    capFirst(d.toLocaleDateString("fr-FR", { month: "long", year: "numeric" }));

  const labelMoisCourant  = fmtMonthLabel(now);
  const prevMonthDate     = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const labelMoisPrecedent = fmtMonthLabel(prevMonthDate);

  const encaisseCeMois = allCheques.filter((c) => {
    if (c.status !== "ENCAISSE" || !c.actualCashDate) return false;
    const d = new Date(c.actualCashDate);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const encaisseMoisPrecedent = allCheques.filter((c) => {
    if (c.status !== "ENCAISSE" || !c.actualCashDate) return false;
    const d = new Date(c.actualCashDate);
    return d.getMonth() === prevMonthDate.getMonth() && d.getFullYear() === prevMonthDate.getFullYear();
  });

  // ── Actions modal ──────────────────────────────────────────────────────────
  function openAdd() { setEditing(null); setForm(EMPTY_FORM); setError(""); setModal("add"); }
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
      setError("Les champs obligatoires (*) doivent être remplis."); return;
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

  // ── Édition inline objet ───────────────────────────────────────────────────
  async function saveSubject(id: string) {
    if (!editSubject || editSubject.id !== id) return;
    await fetch(`/api/cheques/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subject: editSubject.value.toUpperCase() }),
    });
    setEditSubject(null);
    load();
  }

  // ── Import ─────────────────────────────────────────────────────────────────
  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (importFileRef.current) importFileRef.current.value = "";
    if (!file) return;
    setImporting(true); setImportError(""); setImportResult(null);
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/cheques/import", { method: "POST", body: fd });
    setImporting(false);
    if (res.ok) {
      setImportResult(await res.json()); load();
    } else {
      const err = await res.json();
      setImportError(err.error ?? "Erreur lors de l'import");
    }
  }

  const fieldCls = "mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white";
  const labelCls = "text-xs font-medium text-slate-600";
  const thCls    = "text-left px-4 py-3.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider";

  return (
    <div className="space-y-6">

      {/* ── En-tête ──────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Chéquier</h1>
          <p className="text-slate-400 text-sm mt-0.5">Suivi des chèques émis et de leur encaissement</p>
        </div>
        <div className="flex items-center gap-2">
          <label className={`flex items-center gap-2 px-4 py-2 border border-slate-200 text-slate-600 text-sm font-medium rounded-xl hover:bg-slate-50 transition-colors cursor-pointer ${importing ? "opacity-50 pointer-events-none" : ""}`}>
            <Upload size={15} />
            {importing ? "Import…" : "Importer Excel/CSV"}
            <input ref={importFileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleImportFile} />
          </label>
          <button onClick={openAdd}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-xl hover:bg-indigo-700 transition-colors shadow-sm shadow-indigo-600/20">
            <Plus size={16} /> Nouveau chèque
          </button>
        </div>
      </div>

      {/* ── KPIs ─────────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-xl bg-amber-50 flex items-center justify-center"><Clock size={16} className="text-amber-500" /></div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">En attente</p>
          </div>
          <p className="text-3xl font-bold text-slate-900 tracking-tight">{fmt(totalEnAttente)}</p>
          <p className="text-xs text-slate-400 mt-1">{enAttente.length} chèque{enAttente.length > 1 ? "s" : ""} non encaissé{enAttente.length > 1 ? "s" : ""}</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-xl bg-emerald-50 flex items-center justify-center"><CheckCircle2 size={16} className="text-emerald-500" /></div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Encaissés — {labelMoisCourant}</p>
          </div>
          <p className="text-3xl font-bold text-slate-900 tracking-tight">{fmt(encaisseCeMois.reduce((s, c) => s + c.amount, 0))}</p>
          <p className="text-xs text-slate-400 mt-1">{encaisseCeMois.length} chèque{encaisseCeMois.length > 1 ? "s" : ""}</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-xl bg-slate-50 flex items-center justify-center"><BookOpen size={16} className="text-slate-400" /></div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Encaissés — {labelMoisPrecedent}</p>
          </div>
          <p className="text-3xl font-bold text-slate-900 tracking-tight">{fmt(encaisseMoisPrecedent.reduce((s, c) => s + c.amount, 0))}</p>
          <p className="text-xs text-slate-400 mt-1">{encaisseMoisPrecedent.length} chèque{encaisseMoisPrecedent.length > 1 ? "s" : ""}</p>
        </div>
      </div>

      {/* ── Résultats import ─────────────────────────────────────────────────── */}
      {importError && (
        <div className="flex items-center justify-between bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          <p className="text-sm text-red-600">{importError}</p>
          <button onClick={() => setImportError("")} className="text-red-400 hover:text-red-600 ml-4"><X size={14} /></button>
        </div>
      )}
      {importResult && (
        <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
          <p className="text-sm text-emerald-700">
            {importResult.imported > 0 && <span className="font-semibold">{importResult.imported} chèque{importResult.imported > 1 ? "s" : ""} importé{importResult.imported > 1 ? "s" : ""}</span>}
            {importResult.updated > 0 && <span className="font-semibold ml-2">· {importResult.updated} chéquier{importResult.updated > 1 ? "s" : ""} mis à jour</span>}
            {importResult.duplicates > 0 && <span className="text-emerald-500 ml-2">· {importResult.duplicates} doublon{importResult.duplicates > 1 ? "s" : ""} ignoré{importResult.duplicates > 1 ? "s" : ""}</span>}
            {importResult.skipped > 0 && <span className="text-emerald-500 ml-2">· {importResult.skipped} ligne{importResult.skipped > 1 ? "s" : ""} vide{importResult.skipped > 1 ? "s" : ""}</span>}
          </p>
          <button onClick={() => setImportResult(null)} className="text-emerald-400 hover:text-emerald-600 ml-4"><X size={14} /></button>
        </div>
      )}

      {/* ── Filtre année d'émission ──────────────────────────────────────────── */}
      {yearList.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mr-1">Année</span>
          <button
            onClick={() => setFilterYear("all")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              filterYear === "all"
                ? "bg-indigo-600 text-white shadow-sm"
                : "bg-white border border-slate-200 text-slate-500 hover:text-slate-700"
            }`}>
            Tous
            <span className={`ml-1.5 text-[10px] font-normal ${filterYear === "all" ? "opacity-75" : "text-slate-400"}`}>
              ({allCheques.length})
            </span>
          </button>
          {yearList.map((year) => {
            const count = yearCounts[year] ?? 0;
            const active = filterYear === year;
            return (
              <button
                key={year}
                onClick={() => setFilterYear(year)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  active
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "bg-white border border-slate-200 text-slate-500 hover:text-slate-700"
                }`}>
                {year}
                <span className={`ml-1.5 text-[10px] font-normal ${active ? "opacity-75" : "text-slate-400"}`}>
                  ({count})
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* ── Filtre statut ────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2">
        <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mr-1">Statut</span>
        {(["all", ...STATUSES] as const).map((s) => {
          const active = filterStatus === s;
          return (
            <button key={s} onClick={() => setFilterStatus(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                active ? "bg-indigo-600 text-white shadow-sm" : "bg-white border border-slate-200 text-slate-500 hover:text-slate-700"
              }`}>
              {s !== "all" ? STATUS_CONFIG[s].label : "Tous"}
            </button>
          );
        })}
        {displayedCheques.length !== allCheques.length && (
          <span className="ml-2 text-xs text-slate-400">
            {displayedCheques.length} résultat{displayedCheques.length > 1 ? "s" : ""}
          </span>
        )}
      </div>

      {/* ── Tableau ──────────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {displayedCheques.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-400">
            <BookOpen size={32} strokeWidth={1.2} />
            <p className="text-sm">Aucun chèque{filterStatus !== "all" || filterYear !== "all" ? " pour ces filtres" : ""}</p>
            {filterStatus === "all" && filterYear === "all" && (
              <button onClick={openAdd} className="text-sm text-indigo-500 hover:underline font-medium">
                Ajouter un premier chèque →
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <SortTh field="number"          label="N° chèque"     active={sortField === "number"}          dir={sortDir} onSort={toggleSort} className={`${thCls} pl-5`} />
                  <SortTh field="recipient"        label="Destinataire"  active={sortField === "recipient"}        dir={sortDir} onSort={toggleSort} className={thCls} />
                  <th className={thCls}>Objet</th>
                  <SortTh field="amount"           label="Montant"       active={sortField === "amount"}           dir={sortDir} onSort={toggleSort} className={`${thCls} text-right`} />
                  <SortTh field="issuedAt"         label="Date émission" active={sortField === "issuedAt"}         dir={sortDir} onSort={toggleSort} className={`${thCls} text-center`} />
                  <SortTh field="expectedCashDate" label="Prévu"         active={sortField === "expectedCashDate"} dir={sortDir} onSort={toggleSort} className={`${thCls} text-center`} />
                  <th className={`${thCls} text-center`}>Encaissé le</th>
                  <SortTh field="status"           label="Statut"        active={sortField === "status"}           dir={sortDir} onSort={toggleSort} className={`${thCls} text-center`} />
                  <th className={`${thCls} w-20`}></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {displayedCheques.map((c) => {
                  const cfg = STATUS_CONFIG[c.status];
                  const StatusIcon = cfg.icon;
                  const isCancelled = c.status === "ANNULE";
                  const isUpdating  = updatingId === c.id;

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

                      {/* Objet — édition inline */}
                      <td className="px-4 py-3.5 text-slate-500 text-xs max-w-[180px]">
                        {editSubject?.id === c.id ? (
                          <input
                            autoFocus
                            className="w-full border-b border-indigo-400 bg-transparent text-xs text-slate-800 focus:outline-none uppercase"
                            value={editSubject.value}
                            onChange={(e) => setEditSubject({ id: c.id, value: e.target.value.toUpperCase() })}
                            onBlur={() => saveSubject(c.id)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") saveSubject(c.id);
                              if (e.key === "Escape") setEditSubject(null);
                            }}
                          />
                        ) : (
                          <span
                            className="block truncate cursor-pointer hover:text-slate-700 hover:underline decoration-dotted"
                            title={`${c.subject}  — cliquer pour modifier`}
                            onClick={() => setEditSubject({ id: c.id, value: c.subject })}
                          >
                            {c.subject}
                          </span>
                        )}
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
                              ? "text-red-500 font-semibold" : "text-slate-500"
                          }`}>{fmtDate(c.expectedCashDate)}</span>
                        ) : <span className="text-slate-300 text-xs">—</span>}
                      </td>

                      {/* Date réelle encaissement */}
                      <td className="px-4 py-3.5 text-center">
                        {c.actualCashDate
                          ? <span className="text-xs text-emerald-600 font-medium tabular-nums">{fmtDate(c.actualCashDate)}</span>
                          : <span className="text-slate-300 text-xs">—</span>}
                      </td>

                      {/* Statut — select inline */}
                      <td className="px-4 py-3.5 text-center">
                        <div className="relative inline-block">
                          <select
                            value={c.status}
                            onChange={(e) => updateStatus(c.id, e.target.value as ChequeStatus)}
                            className={`appearance-none text-xs font-semibold px-3 py-1.5 rounded-lg cursor-pointer border focus:outline-none focus:ring-2 focus:ring-indigo-400 pr-6 ${cfg.badge}`}>
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

              {displayedCheques.length > 1 && (
                <tfoot>
                  <tr className="border-t-2 border-slate-100 bg-slate-50">
                    <td colSpan={3} className="px-5 py-3.5 text-xs font-bold text-slate-500 uppercase tracking-wide">
                      Total affiché
                    </td>
                    <td className="px-4 py-3.5 text-right font-bold text-slate-900 tabular-nums">
                      {fmt(displayedCheques.filter((c) => c.status !== "ANNULE").reduce((s, c) => s + c.amount, 0))}
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
                    onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value.toUpperCase() }))}
                    placeholder="Ex : LOYER MAI 2026" />
                </div>
                <div>
                  <label className={labelCls}>Date d&apos;émission *</label>
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
