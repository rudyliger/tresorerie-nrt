import type { Metadata } from "next";
import localFont from "next/font/local";
import Link from "next/link";
import "./globals.css";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "NRT Associés — Trésorerie",
  description: "Gestion de trésorerie NRT Associés",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body className={`${geistSans.variable} antialiased bg-gray-50 min-h-screen`}>
        <nav className="bg-white border-b border-gray-200 shadow-sm">
          <div className="max-w-screen-xl mx-auto px-4 py-3 flex items-center gap-8">
            <span className="font-bold text-gray-900 text-lg tracking-tight">
              NRT Associés
            </span>
            <div className="flex gap-6">
              <Link
                href="/dashboard"
                className="text-sm font-medium text-gray-600 hover:text-blue-600 transition-colors"
              >
                Dashboard
              </Link>
              <Link
                href="/planning"
                className="text-sm font-medium text-gray-600 hover:text-blue-600 transition-colors"
              >
                Planning
              </Link>
            </div>
          </div>
        </nav>
        <main className="max-w-screen-xl mx-auto px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
