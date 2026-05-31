"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Download, Upload, Plus, Pencil, Trash2, Check, X, ChevronLeft, ChevronRight } from "lucide-react";

type Category = { id: string; name: string };
type BankAccount = { id: string; name: string };
type Entity = { id: string; name: string; code: string };
type WeeklyObjective = {
  id: string; entityId: string; targetAmount: number; weekStart: string;
  entity: Entity;
};
type DailyObjective = {
  id: string; entityId: string; targetAmount: number; date: string;
  entity: Entity;
};

const METHODS = ["VIREMENT", "PRELEVEMENT", "CHEQUE", "CB", "EFFET"] as const;
const METHOD_LABELS: Record<string, string> = {
  VIREMENT: "Virement", PRELEVEMENT: "Prélèvement", CHEQUE: "Chèque", CB: "CB", EFFET: "Effet",
};
const TABS = ["Paiement", "Recette", "Solde bancaire", "Objectif CA", "Import Shopify"] as const;
type Tab = (typeof TABS)[number];

const STORE_CODES = ["RNV_O", "RNV_B", "RNV_T"];
const WEB_CODES = ["RNV_WEB", "OMC_WEB"];
const ENTITY_CODE_ORDER = ["RNV_O", "RNV_B", "RNV_T", "RNV_WEB", "OMC_WEB"];
const DAY_LABELS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];

function todayISO() { return new Date().toLocaleDateString("sv-SE"); }

function getMondayOf(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00.000Z");
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().slice(0, 10);
}

function getMondayISO(): string {
  return getMondayOf(new Date().toLocaleDateString("sv-SE"));
}

function addDays(iso: string, n: number): string {
  const d = new Date(iso + "T12:00:00.000Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function fmtWeek(iso: string) {
  return new Date(iso + "T12:00:00.000Z").toLocaleDateString("fr-FR", {
    day: "2-digit", month: "2-digit", year: "numeric",
  });
}

function fmtDayDate(iso: string) {
  return new Date(iso + "T12:00:00.000Z").toLocaleDateString("fr-FR", {
    day: "2-digit", month: "2-digit",
  });
}

const fmt = (n: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);

export default function SaisiePage() {
  const [tab, setTab] = useState<Tab>("Paiement");
  const [caSubTab, setCaSubTab] = useState<"magasins" | "web">("magasins");

  const [categories, setCategories] = useState<Category[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [entities, setEntities] = useState<Entity[]>([]);

  // Paiement
  const [pay, setPay] = useState({ label: "", amount: "", dueDate: todayISO(), method: "VIREMENT", categoryId: "", bankAccountId: "", notes: "" });
  const [paySuccess, setPaySuccess] = useState("");
  const [payError, setPayError] = useState("");

  // Recette
  const [rev, setRev] = useState({ entityId: "", amount: "", date: todayISO(), notes: "" });
  const [revSuccess, setRevSuccess] = useState("");

  // Solde
  const [solde, setSolde] = useState({ bankAccountId: "", currentBalance: "" });
  const [soldeSuccess, setSoldeSuccess] = useState("");

  // ── Objectifs CA — Magasins (journalier) ───────────────────────────────────
  const [storeWeek, setStoreWeek] = useState(getMondayISO());
  // storeValues[entityId][dateISO] = string
  const [storeValues, setStoreValues] = useState<Record<string, Record<string, string>>>({});
  const [storeSaveMsg, setStoreSaveMsg] = useState("");
  const [storeImportFile, setStoreImportFile] = useState<File | null>(null);
  const [storeImportResult, setStoreImportResult] = useState<{ upserted: number; rows: number } | null>(null);
  const [storeImportError, setStoreImportError] = useState("");
  const storeFileRef = useRef<HTMLInputElement>(null);

  // ── Objectifs CA — Web (hebdomadaire) ──────────────────────────────────────
  const [allObjectives, setAllObjectives] = useState<WeeklyObjective[]>([]);
  const [editingWeek, setEditingWeek] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Record<string, string>>({});
  const [addingWeek, setAddingWeek] = useState(false);
  const [newWeekDate, setNewWeekDate] = useState(getMondayISO());
  const [newWeekValues, setNewWeekValues] = useState<Record<string, string>>({});
  const [webImportFile, setWebImportFile] = useState<File | null>(null);
  const [webImportResult, setWebImportResult] = useState<{ upserted: number; weeks: number } | null>(null);
  const [webImportError, setWebImportError] = useState("");
  const webFileRef = useRef<HTMLInputElement>(null);

  // Shopify
  const [shopifyEntity, setShopifyEntity] = useState("");
  const [shopifyFile, setShopifyFile] = useState<File | null>(null);
  const [shopifyResult, setShopifyResult] = useState<{ imported: number; entries: { date: string; amount: number }[] } | null>(null);
  const [shopifyError, setShopifyError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/categories").then((r) => r.json()),
      fetch("/api/bank-accounts").then((r) => r.json()),
      fetch("/api/entities").then((r) => r.json()),
    ]).then(([c, b, e]) => {
      setCategories(c);
      setBankAccounts(b);
      setEntities(e);
      if (b[0]) { setPay((p) => ({ ...p, bankAccountId: b[0].id })); setSolde((s) => ({ ...s, bankAccountId: b[0].id })); }
      if (c[0]) setPay((p) => ({ ...p, categoryId: c[0].id }));
      if (e[0]) { setRev((r) => ({ ...r, entityId: e[0].id })); setShopifyEntity(e[0].id); }
    });
  }, []);

  // Entités triées
  const sortedEntities = [...entities].sort((a, b) => {
    const ai = ENTITY_CODE_ORDER.indexOf(a.code);
    const bi = ENTITY_CODE_ORDER.indexOf(b.code);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });
  const storeEntities = sortedEntities.filter((e) => STORE_CODES.includes(e.code));
  const webEntities = sortedEntities.filter((e) => WEB_CODES.includes(e.code));

  // Semaine courante : 6 dates (Lun–Sam)
  const weekDays = Array.from({ length: 6 }, (_, i) => addDays(storeWeek, i));

  // Charger les objectifs journaliers de la semaine courante
  const loadStoreObjectives = useCallback(() => {
    const sat = addDays(storeWeek, 5);
    fetch(`/api/daily-ca-objective?from=${storeWeek}&to=${sat}`)
      .then((r) => r.json())
      .then((data: DailyObjective[]) => {
        const vals: Record<string, Record<string, string>> = {};
        for (const obj of data) {
          const dateKey = obj.date.slice(0, 10);
          if (!vals[obj.entityId]) vals[obj.entityId] = {};
          vals[obj.entityId][dateKey] = obj.targetAmount > 0 ? String(obj.targetAmount) : "";
        }
        setStoreValues(vals);
      });
  }, [storeWeek]);

  useEffect(() => { loadStoreObjectives(); }, [loadStoreObjectives]);

  // Objectifs web
  const loadObjectives = useCallback(() => {
    fetch("/api/weekly-ca-objective")
      .then((r) => r.json())
      .then(setAllObjectives);
  }, []);
  useEffect(() => { loadObjectives(); }, [loadObjectives]);

  // Grouper les objectifs web par semaine
  const weekMap = new Map<string, Record<string, number>>();
  for (const obj of allObjectives) {
    const entityCode = obj.entity?.code ?? "";
    if (!WEB_CODES.includes(entityCode)) continue;
    const key = obj.weekStart.slice(0, 10);
    if (!weekMap.has(key)) weekMap.set(key, {});
    weekMap.get(key)![obj.entityId] = obj.targetAmount;
  }
  const sortedWeeks = Array.from(weekMap.entries()).sort((a, b) => b[0].localeCompare(a[0]));

  // ── Actions ──────────────────────────────────────────────────────────────────

  async function submitPay() {
    setPayError(""); setPaySuccess("");
    if (!pay.label || !pay.amount || !pay.categoryId || !pay.bankAccountId) {
      setPayError("Tous les champs obligatoires (*) doivent être remplis."); return;
    }
    const res = await fetch("/api/payments", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...pay, amount: parseFloat(pay.amount.replace(",", ".")) }),
    });
    if (res.ok) { setPaySuccess("Paiement enregistré."); setPay((p) => ({ ...p, label: "", amount: "", notes: "" })); }
    else setPayError("Erreur lors de l'enregistrement.");
  }

  async function submitRev() {
    setRevSuccess("");
    if (!rev.entityId || !rev.amount) return;
    await fetch("/api/revenues", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...rev, amount: parseFloat(rev.amount.replace(",", ".")) }),
    });
    setRevSuccess("Recette enregistrée.");
    setRev((r) => ({ ...r, amount: "", notes: "" }));
  }

  async function submitSolde() {
    setSoldeSuccess("");
    if (!solde.bankAccountId || !solde.currentBalance) return;
    await fetch("/api/bank-accounts", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: solde.bankAccountId, currentBalance: parseFloat(solde.currentBalance.replace(",", ".")) }),
    });
    setSoldeSuccess("Solde mis à jour.");
    setSolde((s) => ({ ...s, currentBalance: "" }));
  }

  // ── Magasins CA : enregistrer la semaine ────────────────────────────────────
  async function saveStoreWeek() {
    setStoreSaveMsg("");
    await Promise.all(
      storeEntities.flatMap((e) =>
        weekDays.map((dateISO) =>
          fetch("/api/daily-ca-objective", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              entityId: e.id,
              date: dateISO,
              targetAmount: parseFloat((storeValues[e.id]?.[dateISO] ?? "0").replace(",", ".")) || 0,
            }),
          })
        )
      )
    );
    setStoreSaveMsg("Semaine enregistrée.");
    setTimeout(() => setStoreSaveMsg(""), 3000);
  }

  async function importStoreCSV() {
    setStoreImportError(""); setStoreImportResult(null);
    if (!storeImportFile) { setStoreImportError("Sélectionnez un fichier CSV."); return; }
    const fd = new FormData();
    fd.append("file", storeImportFile);
    const res = await fetch("/api/daily-ca-objective/import", { method: "POST", body: fd });
    if (res.ok) {
      setStoreImportResult(await res.json());
      setStoreImportFile(null);
      if (storeFileRef.current) storeFileRef.current.value = "";
      loadStoreObjectives();
    } else {
      const err = await res.json();
      setStoreImportError(err.error ?? "Erreur d'import");
    }
  }

  function downloadStoreTemplate() {
    const header = "semaine,mag,lun,mar,mer,jeu,ven,sam";
    const week1 = storeWeek;
    const week2 = addDays(storeWeek, 7);
    const rows = [
      `${week1},rnv_o,3000,2500,4000,3500,5000,6000`,
      `${week1},rnv_b,1500,1200,2000,1800,2500,3000`,
      `${week1},rnv_t,800,700,1000,900,1200,1500`,
      `${week2},rnv_o,3000,2500,4000,3500,5000,6000`,
      `${week2},rnv_b,1500,1200,2000,1800,2500,3000`,
      `${week2},rnv_t,800,700,1000,900,1200,1500`,
    ];
    const csv = "﻿" + [header, ...rows].join("\n") + "\n";
    const a = Object.assign(document.createElement("a"), {
      href: URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" })),
      download: "objectifs_magasins.csv",
    });
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  }

  // ── Web CA : sauvegarder une ligne ──────────────────────────────────────────
  async function saveWebWeekRow(weekDate: string, values: Record<string, string>) {
    await Promise.all(
      webEntities.map((e) =>
        fetch("/api/weekly-ca-objective", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            entityId: e.id,
            weekStart: weekDate + "T12:00:00.000Z",
            targetAmount: parseFloat((values[e.id] ?? "0").replace(",", ".")) || 0,
          }),
        })
      )
    );
    loadObjectives();
  }

  function startEditWeek(weekDate: string, vals: Record<string, number>) {
    const strVals: Record<string, string> = {};
    for (const [id, v] of Object.entries(vals)) strVals[id] = v > 0 ? String(v) : "";
    setEditValues(strVals);
    setEditingWeek(weekDate);
  }

  async function deleteWebWeek(weekDate: string) {
    if (!confirm("Supprimer les objectifs CA web de cette semaine ?")) return;
    await fetch(`/api/weekly-ca-objective?weekStart=${weekDate}T12:00:00.000Z`, { method: "DELETE" });
    loadObjectives();
  }

  async function importWebCSV() {
    setWebImportError(""); setWebImportResult(null);
    if (!webImportFile) { setWebImportError("Sélectionnez un fichier CSV."); return; }
    const fd = new FormData();
    fd.append("file", webImportFile);
    const res = await fetch("/api/weekly-ca-objective/import", { method: "POST", body: fd });
    if (res.ok) {
      setWebImportResult(await res.json());
      setWebImportFile(null);
      if (webFileRef.current) webFileRef.current.value = "";
      loadObjectives();
    } else {
      const err = await res.json();
      setWebImportError(err.error ?? "Erreur d'import");
    }
  }

  function downloadWebTemplate() {
    const header = "semaine,rnv_web,omc_web";
    const ex1 = `${getMondayISO()},1500,2500`;
    const ex2 = `${addDays(getMondayISO(), 7)},1500,2500`;
    const csv = "﻿" + [header, ex1, ex2].join("\n") + "\n";
    const a = Object.assign(document.createElement("a"), {
      href: URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" })),
      download: "objectifs_web.csv",
    });
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  }

  async function submitShopify() {
    setShopifyError(""); setShopifyResult(null);
    if (!shopifyFile || !shopifyEntity) { setShopifyError("Sélectionnez un shop et un fichier CSV."); return; }
    const fd = new FormData();
    fd.append("file", shopifyFile);
    fd.append("entityId", shopifyEntity);
    const res = await fetch("/api/shopify-import", { method: "POST", body: fd });
    if (res.ok) {
      setShopifyResult(await res.json());
      setShopifyFile(null);
      if (fileRef.current) fileRef.current.value = "";
    } else {
      const err = await res.json();
      setShopifyError(err.error ?? "Erreur d'import");
    }
  }

  const fieldCls = "mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white";
  const labelCls = "text-xs font-medium text-slate-600";
  const btnPrimary = "px-5 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-colors shadow-sm shadow-indigo-600/20";
  const cellInput = "w-full border border-slate-200 rounded-lg px-2 py-1.5 text-sm text-right focus:outline-none focus:ring-2 focus:ring-indigo-400 tabular-nums";

  const isCATab = tab === "Objectif CA";

  return (
    <div className={`${isCATab ? "max-w-5xl" : "max-w-2xl"} mx-auto space-y-6`}>
      <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Saisie</h1>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-colors ${
              tab === t ? "bg-white text-indigo-700 shadow-sm" : "text-slate-500 hover:text-slate-700"
            }`}>
            {t}
          </button>
        ))}
      </div>

      {/* ── Paiement ──────────────────────────────────────────────────────────── */}
      {tab === "Paiement" && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-4">
          <h2 className="text-sm font-bold text-slate-800">Ajouter un paiement</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className={labelCls}>Libellé *</label>
              <input className={fieldCls} value={pay.label} onChange={(e) => setPay((p) => ({ ...p, label: e.target.value }))} placeholder="Nom du fournisseur / charge" />
            </div>
            <div>
              <label className={labelCls}>Date d'échéance *</label>
              <input type="date" className={fieldCls} value={pay.dueDate} onChange={(e) => setPay((p) => ({ ...p, dueDate: e.target.value }))} />
            </div>
            <div>
              <label className={labelCls}>Montant (€) *</label>
              <input className={fieldCls} value={pay.amount} onChange={(e) => setPay((p) => ({ ...p, amount: e.target.value }))} placeholder="0,00" />
            </div>
            <div>
              <label className={labelCls}>Mode de paiement *</label>
              <select className={fieldCls} value={pay.method} onChange={(e) => setPay((p) => ({ ...p, method: e.target.value }))}>
                {METHODS.map((m) => <option key={m} value={m}>{METHOD_LABELS[m]}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Catégorie *</label>
              <select className={fieldCls} value={pay.categoryId} onChange={(e) => setPay((p) => ({ ...p, categoryId: e.target.value }))}>
                <option value="">— Choisir —</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Compte bancaire *</label>
              <select className={fieldCls} value={pay.bankAccountId} onChange={(e) => setPay((p) => ({ ...p, bankAccountId: e.target.value }))}>
                <option value="">— Choisir —</option>
                {bankAccounts.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <label className={labelCls}>Notes</label>
              <input className={fieldCls} value={pay.notes} onChange={(e) => setPay((p) => ({ ...p, notes: e.target.value }))} placeholder="Optionnel" />
            </div>
          </div>
          {payError && <p className="text-sm text-red-500">{payError}</p>}
          {paySuccess && <p className="text-sm text-emerald-600">{paySuccess}</p>}
          <button onClick={submitPay} className={btnPrimary}>Enregistrer le paiement</button>
        </div>
      )}

      {/* ── Recette ───────────────────────────────────────────────────────────── */}
      {tab === "Recette" && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-4">
          <h2 className="text-sm font-bold text-slate-800">Ajouter une recette</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Shop *</label>
              <select className={fieldCls} value={rev.entityId} onChange={(e) => setRev((r) => ({ ...r, entityId: e.target.value }))}>
                <option value="">— Choisir —</option>
                {entities.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Date *</label>
              <input type="date" className={fieldCls} value={rev.date} onChange={(e) => setRev((r) => ({ ...r, date: e.target.value }))} />
            </div>
            <div>
              <label className={labelCls}>Montant (€) *</label>
              <input className={fieldCls} value={rev.amount} onChange={(e) => setRev((r) => ({ ...r, amount: e.target.value }))} placeholder="0,00" />
            </div>
            <div>
              <label className={labelCls}>Notes</label>
              <input className={fieldCls} value={rev.notes} onChange={(e) => setRev((r) => ({ ...r, notes: e.target.value }))} placeholder="Optionnel" />
            </div>
          </div>
          {revSuccess && <p className="text-sm text-emerald-600">{revSuccess}</p>}
          <button onClick={submitRev} className={btnPrimary}>Enregistrer la recette</button>
        </div>
      )}

      {/* ── Solde bancaire ────────────────────────────────────────────────────── */}
      {tab === "Solde bancaire" && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-4">
          <h2 className="text-sm font-bold text-slate-800">Mettre à jour un solde</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Compte *</label>
              <select className={fieldCls} value={solde.bankAccountId} onChange={(e) => setSolde((s) => ({ ...s, bankAccountId: e.target.value }))}>
                {bankAccounts.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Solde actuel (€) *</label>
              <input className={fieldCls} value={solde.currentBalance} onChange={(e) => setSolde((s) => ({ ...s, currentBalance: e.target.value }))} placeholder="0,00" />
            </div>
          </div>
          {soldeSuccess && <p className="text-sm text-emerald-600">{soldeSuccess}</p>}
          <button onClick={submitSolde} className={btnPrimary}>Mettre à jour le solde</button>
        </div>
      )}

      {/* ── Objectif CA ────────────────────────────────────────────────────────── */}
      {tab === "Objectif CA" && (
        <div className="space-y-4">
          {/* Sub-tabs Magasins / Web */}
          <div className="flex gap-1 bg-slate-100 rounded-xl p-1 w-fit">
            <button onClick={() => setCaSubTab("magasins")}
              className={`px-5 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                caSubTab === "magasins" ? "bg-white text-indigo-700 shadow-sm" : "text-slate-500 hover:text-slate-700"
              }`}>
              Magasins
            </button>
            <button onClick={() => setCaSubTab("web")}
              className={`px-5 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                caSubTab === "web" ? "bg-white text-indigo-700 shadow-sm" : "text-slate-500 hover:text-slate-700"
              }`}>
              Web
            </button>
          </div>

          {/* ── Magasins : grille journalière par semaine ────────────────────── */}
          {caSubTab === "magasins" && (
            <div className="space-y-4">
              {/* Header bar */}
              <div className="flex items-center justify-between flex-wrap gap-2">
                {/* Navigation semaine */}
                <div className="flex items-center gap-2">
                  <button onClick={() => setStoreWeek(addDays(storeWeek, -7))}
                    className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50">
                    <ChevronLeft size={15} />
                  </button>
                  <span className="text-sm font-semibold text-slate-700 min-w-[120px] text-center">
                    Sem. du {fmtWeek(storeWeek)}
                  </span>
                  <button onClick={() => setStoreWeek(addDays(storeWeek, 7))}
                    className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50">
                    <ChevronRight size={15} />
                  </button>
                </div>
                {/* Actions */}
                <div className="flex gap-2 flex-wrap">
                  <button onClick={downloadStoreTemplate}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors">
                    <Download size={13} /> objectifs_magasins.csv
                  </button>
                  <div className="flex items-center gap-1.5">
                    <label className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 cursor-pointer transition-colors">
                      <Upload size={13} /> Importer CSV
                      <input ref={storeFileRef} type="file" accept=".csv" className="hidden"
                        onChange={(e) => setStoreImportFile(e.target.files?.[0] ?? null)} />
                    </label>
                    {storeImportFile && (
                      <button onClick={importStoreCSV}
                        className="px-3 py-1.5 text-xs font-semibold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors">
                        Charger
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {storeImportError && <p className="text-sm text-red-500">{storeImportError}</p>}
              {storeImportResult && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 text-sm text-emerald-700">
                  Import terminé : {storeImportResult.upserted} entrées sur {storeImportResult.rows} ligne{storeImportResult.rows > 1 ? "s" : ""}.
                </div>
              )}

              {/* Grille */}
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                      <th className="text-left px-5 py-3 w-32">Magasin</th>
                      {weekDays.map((d, i) => (
                        <th key={d} className="text-right px-3 py-3">
                          <span className="block">{DAY_LABELS[i]}</span>
                          <span className="block font-normal text-slate-300">{fmtDayDate(d)}</span>
                        </th>
                      ))}
                      <th className="text-right px-4 py-3">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {storeEntities.map((e) => {
                      const rowTotal = weekDays.reduce((s, d) =>
                        s + (parseFloat(storeValues[e.id]?.[d]?.replace(",", ".") ?? "0") || 0), 0);
                      return (
                        <tr key={e.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="px-5 py-2.5 text-sm font-semibold text-slate-700 whitespace-nowrap">{e.name}</td>
                          {weekDays.map((dateISO) => (
                            <td key={dateISO} className="px-3 py-2.5">
                              <input
                                type="text"
                                className={cellInput}
                                placeholder="0"
                                value={storeValues[e.id]?.[dateISO] ?? ""}
                                onChange={(ev) =>
                                  setStoreValues((prev) => ({
                                    ...prev,
                                    [e.id]: { ...(prev[e.id] ?? {}), [dateISO]: ev.target.value },
                                  }))
                                }
                              />
                            </td>
                          ))}
                          <td className="px-4 py-2.5 text-right">
                            <span className={`text-sm font-bold tabular-nums ${rowTotal > 0 ? "text-slate-900" : "text-slate-300"}`}>
                              {rowTotal > 0 ? fmt(rowTotal) : "—"}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                    {/* Ligne totaux colonnes */}
                    <tr className="bg-slate-50/80 text-[11px] font-semibold text-slate-500">
                      <td className="px-5 py-2 uppercase tracking-wide">Total</td>
                      {weekDays.map((dateISO) => {
                        const colTotal = storeEntities.reduce((s, e) =>
                          s + (parseFloat(storeValues[e.id]?.[dateISO]?.replace(",", ".") ?? "0") || 0), 0);
                        return (
                          <td key={dateISO} className="px-3 py-2 text-right tabular-nums">
                            {colTotal > 0 ? fmt(colTotal) : "—"}
                          </td>
                        );
                      })}
                      <td className="px-4 py-2 text-right tabular-nums text-slate-900 font-bold">
                        {(() => {
                          const grand = storeEntities.reduce((s, e) =>
                            s + weekDays.reduce((ss, d) =>
                              ss + (parseFloat(storeValues[e.id]?.[d]?.replace(",", ".") ?? "0") || 0), 0), 0);
                          return grand > 0 ? fmt(grand) : "—";
                        })()}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="flex items-center gap-3">
                <button onClick={saveStoreWeek} className={btnPrimary}>
                  Enregistrer la semaine
                </button>
                {storeSaveMsg && <p className="text-sm text-emerald-600">{storeSaveMsg}</p>}
              </div>
            </div>
          )}

          {/* ── Web : tableau hebdomadaire ──────────────────────────────────── */}
          {caSubTab === "web" && (
            <div className="space-y-4">
              {/* Actions bar */}
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <h2 className="text-sm font-bold text-slate-800">Objectifs CA Web (hebdomadaire)</h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {sortedWeeks.length} semaine{sortedWeeks.length > 1 ? "s" : ""} enregistrée{sortedWeeks.length > 1 ? "s" : ""}
                  </p>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <button onClick={downloadWebTemplate}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors">
                    <Download size={13} /> objectifs_web.csv
                  </button>
                  <div className="flex items-center gap-1.5">
                    <label className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 cursor-pointer transition-colors">
                      <Upload size={13} /> Importer CSV
                      <input ref={webFileRef} type="file" accept=".csv,.xlsx" className="hidden"
                        onChange={(e) => setWebImportFile(e.target.files?.[0] ?? null)} />
                    </label>
                    {webImportFile && (
                      <button onClick={importWebCSV}
                        className="px-3 py-1.5 text-xs font-semibold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors">
                        Charger
                      </button>
                    )}
                  </div>
                  <button onClick={() => { setAddingWeek(true); setNewWeekDate(getMondayISO()); setNewWeekValues({}); }}
                    disabled={addingWeek}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors">
                    <Plus size={13} /> Ajouter
                  </button>
                </div>
              </div>

              {webImportError && <p className="text-sm text-red-500">{webImportError}</p>}
              {webImportResult && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 text-sm text-emerald-700">
                  Import terminé : {webImportResult.upserted} entrées mises à jour sur {webImportResult.weeks} semaine{webImportResult.weeks > 1 ? "s" : ""}.
                </div>
              )}

              {/* Table */}
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                      <th className="text-left px-5 py-3">Semaine du</th>
                      {webEntities.map((e) => (
                        <th key={e.id} className="text-right px-3 py-3">{e.name}</th>
                      ))}
                      <th className="text-right px-4 py-3">Total</th>
                      <th className="px-4 py-3 w-20" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {addingWeek && (
                      <tr className="bg-indigo-50/50">
                        <td className="px-5 py-2.5">
                          <input type="date" className="border border-indigo-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                            value={newWeekDate}
                            onChange={(e) => setNewWeekDate(getMondayOf(e.target.value))} />
                        </td>
                        {webEntities.map((e) => (
                          <td key={e.id} className="px-3 py-2.5">
                            <input type="text" className={cellInput} placeholder="0"
                              value={newWeekValues[e.id] ?? ""}
                              onChange={(ev) => setNewWeekValues((v) => ({ ...v, [e.id]: ev.target.value }))} />
                          </td>
                        ))}
                        <td className="px-4 py-2.5 text-right text-xs text-slate-400 tabular-nums">
                          {fmt(webEntities.reduce((s, e) => s + (parseFloat(newWeekValues[e.id] ?? "0") || 0), 0))}
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="flex gap-1 justify-end">
                            <button onClick={async () => { await saveWebWeekRow(getMondayOf(newWeekDate), newWeekValues); setAddingWeek(false); }}
                              className="p-1.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700">
                              <Check size={13} />
                            </button>
                            <button onClick={() => setAddingWeek(false)}
                              className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100">
                              <X size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )}
                    {sortedWeeks.length === 0 && !addingWeek ? (
                      <tr>
                        <td colSpan={webEntities.length + 3} className="px-5 py-10 text-center text-slate-400 text-sm">
                          Aucun objectif web saisi. Cliquez sur « Ajouter » pour commencer.
                        </td>
                      </tr>
                    ) : (
                      sortedWeeks.map(([weekDate, vals]) => {
                        const isEditing = editingWeek === weekDate;
                        const rowTotal = webEntities.reduce((s, e) => {
                          const v = isEditing
                            ? parseFloat(editValues[e.id] ?? "0") || 0
                            : vals[e.id] ?? 0;
                          return s + v;
                        }, 0);
                        return (
                          <tr key={weekDate} className={`hover:bg-slate-50/70 transition-colors ${isEditing ? "bg-indigo-50/30" : ""}`}>
                            <td className="px-5 py-3">
                              <span className="text-sm font-semibold text-slate-700">{fmtWeek(weekDate)}</span>
                            </td>
                            {webEntities.map((e) => (
                              <td key={e.id} className="px-3 py-3">
                                {isEditing ? (
                                  <input type="text" className={cellInput}
                                    value={editValues[e.id] ?? ""}
                                    onChange={(ev) => setEditValues((v) => ({ ...v, [e.id]: ev.target.value }))}
                                    placeholder="0" />
                                ) : (
                                  <span className={`block text-right tabular-nums text-sm ${vals[e.id] > 0 ? "font-medium text-slate-800" : "text-slate-300"}`}>
                                    {vals[e.id] > 0 ? fmt(vals[e.id]) : "—"}
                                  </span>
                                )}
                              </td>
                            ))}
                            <td className="px-4 py-3 text-right">
                              <span className="text-sm font-bold text-slate-900 tabular-nums">{rowTotal > 0 ? fmt(rowTotal) : "—"}</span>
                            </td>
                            <td className="px-4 py-3">
                              {isEditing ? (
                                <div className="flex gap-1 justify-end">
                                  <button onClick={async () => { await saveWebWeekRow(weekDate, editValues); setEditingWeek(null); }}
                                    className="p-1.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700">
                                    <Check size={13} />
                                  </button>
                                  <button onClick={() => setEditingWeek(null)}
                                    className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100">
                                    <X size={13} />
                                  </button>
                                </div>
                              ) : (
                                <div className="flex gap-1 justify-end">
                                  <button onClick={() => startEditWeek(weekDate, vals)}
                                    className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors">
                                    <Pencil size={13} />
                                  </button>
                                  <button onClick={() => deleteWebWeek(weekDate)}
                                    className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors">
                                    <Trash2 size={13} />
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Import Shopify ────────────────────────────────────────────────────── */}
      {tab === "Import Shopify" && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-4">
          <h2 className="text-sm font-bold text-slate-800">Import CSV Shopify</h2>
          <p className="text-xs text-slate-500">
            Exportez vos commandes depuis Shopify (Commandes → Exporter → CSV toutes les commandes).
            Le système additionne les montants par jour pour les commandes payées.
          </p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Shop *</label>
              <select className={fieldCls} value={shopifyEntity} onChange={(e) => setShopifyEntity(e.target.value)}>
                <option value="">— Choisir —</option>
                {entities.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Fichier CSV *</label>
              <input ref={fileRef} type="file" accept=".csv"
                className="mt-1 w-full text-sm text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-indigo-50 file:text-indigo-700 file:text-xs file:font-medium hover:file:bg-indigo-100"
                onChange={(e) => setShopifyFile(e.target.files?.[0] ?? null)} />
            </div>
          </div>
          {shopifyError && <p className="text-sm text-red-500">{shopifyError}</p>}
          {shopifyResult && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
              <p className="text-sm font-semibold text-emerald-700 mb-2">{shopifyResult.imported} recette(s) importée(s)</p>
              <div className="max-h-48 overflow-y-auto">
                <table className="text-xs w-full">
                  <thead><tr className="text-emerald-600 font-semibold"><th className="text-left pb-1">Date</th><th className="text-right pb-1">Montant</th></tr></thead>
                  <tbody>
                    {shopifyResult.entries.map((e) => (
                      <tr key={e.date} className="border-t border-emerald-100">
                        <td className="py-1 text-emerald-800">{e.date}</td>
                        <td className="py-1 text-right text-emerald-800 font-medium">
                          {new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(e.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          <button onClick={submitShopify} className={btnPrimary}>Importer</button>
        </div>
      )}
    </div>
  );
}
