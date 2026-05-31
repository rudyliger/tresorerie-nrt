"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, CalendarDays, AlignLeft, PenLine, Landmark, BookOpen } from "lucide-react";

const NAV = [
  { href: "/dashboard", label: "Dashboard",  icon: LayoutDashboard },
  { href: "/planning",  label: "Planning",   icon: CalendarDays },
  { href: "/liste",     label: "Liste",      icon: AlignLeft },
  { href: "/saisie",    label: "Saisie",     icon: PenLine },
  { href: "/prets",     label: "Prêts",      icon: Landmark },
  { href: "/chequier",  label: "Chéquier",   icon: BookOpen },
];

export function SidebarNav() {
  const path = usePathname();
  return (
    <nav className="flex-1 px-3 py-5 space-y-0.5">
      {NAV.map(({ href, label, icon: Icon }) => {
        const active = path === href || path.startsWith(href + "/");
        return (
          <Link
            key={href}
            href={href}
            className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
              active
                ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/25"
                : "text-slate-400 hover:text-slate-100 hover:bg-white/[0.06]"
            }`}
          >
            <Icon size={17} strokeWidth={active ? 2.5 : 1.8} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
