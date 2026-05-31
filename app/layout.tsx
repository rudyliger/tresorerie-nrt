import type { Metadata } from "next";
import localFont from "next/font/local";
import { SidebarNav } from "@/components/SidebarNav";
import "./globals.css";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "Renouveau — Trésorerie",
  description: "Gestion de trésorerie Renouveau / Onze Mètres Carrés",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body className={`${geistSans.variable} antialiased bg-slate-50 min-h-screen`}>
        <div className="flex min-h-screen">

          {/* ── Sidebar ──────────────────────────────────────────────────────── */}
          <aside className="fixed inset-y-0 left-0 w-60 bg-[#0f172a] flex flex-col z-20">
            {/* Logo */}
            <div className="px-6 pt-8 pb-6">
              <p className="text-white font-bold text-[22px] tracking-tight leading-none">
                RENOUVEAU
              </p>
              <p className="text-slate-500 text-[9px] font-semibold tracking-[0.22em] uppercase mt-2.5">
                Onze Mètres Carrés
              </p>
            </div>

            <div className="mx-5 h-px bg-slate-800" />

            <SidebarNav />

            <div className="px-6 py-4 border-t border-slate-800/60">
              <p className="text-slate-600 text-[11px] font-medium">Trésorerie · 2026</p>
            </div>
          </aside>

          {/* ── Contenu principal ─────────────────────────────────────────────── */}
          <div className="pl-60 flex-1 min-w-0">
            <main className="min-h-screen p-4">{children}</main>
          </div>

        </div>
      </body>
    </html>
  );
}
