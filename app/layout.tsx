import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "AuditLens",
  description: "Slither finds. Gemma 4 explains. Code verifies.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      {/* Browser extensions add attributes to <body>; don't flag that as a hydration error. */}
      <body className="min-h-screen font-sans" suppressHydrationWarning>
        <header className="border-b border-zinc-800">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
            <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight text-zinc-100">
              <span className="grid h-7 w-7 place-items-center rounded-md bg-amber-400 font-mono text-sm text-zinc-950">AL</span>
              AuditLens
            </Link>
            <nav className="flex items-center gap-5 text-sm text-zinc-400">
              <span className="hidden text-xs text-zinc-500 md:block">Slither finds · Gemma 4 explains · code verifies</span>
              <Link href="/history" className="hover:text-zinc-100">
                History
              </Link>
              <Link href="/benchmark" className="hover:text-zinc-100">
                Benchmark
              </Link>
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
        <footer className="mx-auto max-w-5xl px-4 pb-10 text-xs text-zinc-600">
          Automated first-pass review. Not a substitute for a professional audit.
        </footer>
      </body>
    </html>
  );
}
