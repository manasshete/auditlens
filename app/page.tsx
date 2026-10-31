"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Mode = "paste" | "zip" | "github" | "address" | "sample" | "sample-soroban";

const TABS: { id: Mode; label: string }[] = [
  { id: "paste", label: "Paste code" },
  { id: "zip", label: "Upload .zip" },
  { id: "github", label: "GitHub repo" },
  { id: "address", label: "Deployed contract" },
  { id: "sample", label: "Try sample" },
  { id: "sample-soroban", label: "Soroban sample" },
];

const CHAINS = [
  { id: 1, name: "Ethereum" },
  { id: 11155111, name: "Sepolia" },
  { id: 8453, name: "Base" },
  { id: 42161, name: "Arbitrum One" },
  { id: 10, name: "Optimism" },
  { id: 137, name: "Polygon" },
  { id: 56, name: "BNB Chain" },
];

const STEPS = ["Collecting contracts", "Running the analyzer", "Asking Gemma 4", "Verifying every claim", "Writing report"];

export default function Home() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("paste");
  const [code, setCode] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState("");
  const [address, setAddress] = useState("");
  const [chainId, setChainId] = useState(1);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState(0);

  function validate(): string {
    if (mode === "paste" && !code.trim()) return "Paste some Solidity code first.";
    if (mode === "zip" && !file) return "Choose a .zip file first.";
    if (mode === "github" && !/^https:\/\/github\.com\/[\w.-]+\/[\w.-]+/.test(url.trim()))
      return "Enter a GitHub URL like https://github.com/owner/repo";
    if (mode === "address" && !/^0x[0-9a-fA-F]{40}$/.test(address.trim())) return "Enter a contract address like 0x1234…abcd (40 hex characters).";
    return "";
  }

  async function submit() {
    const v = validate();
    if (v) return setError(v);
    setError("");
    setBusy(true);
    setStep(0);
    const timer = setInterval(() => setStep((s) => Math.min(s + 1, STEPS.length - 1)), 2500);
    try {
      const fd = new FormData();
      fd.set("mode", mode);
      if (mode === "paste") fd.set("code", code);
      if (mode === "zip" && file) fd.set("file", file);
      if (mode === "github") fd.set("url", url.trim());
      if (mode === "address") {
        fd.set("address", address.trim());
        fd.set("chain_id", String(chainId));
      }
      const res = await fetch("/api/audit", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Audit failed.");
      router.push(`/report/${data.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Audit failed.");
      setBusy(false);
    } finally {
      clearInterval(timer);
    }
  }

  return (
    <div className="space-y-10">
      <section className="space-y-3 pt-4">
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-50 sm:text-4xl">
          Audit Solidity contracts <span className="text-amber-400">without the noise.</span>
        </h1>
        <p className="max-w-2xl text-zinc-400">
          Slither finds the issues, Gemma 4 ranks and explains them, and AuditLens checks every AI claim against your
          real source before it reaches the report. Anything it can&apos;t verify is removed.
        </p>
      </section>

      <section className="rounded-xl border border-zinc-800 bg-zinc-900/40">
        <div className="flex flex-wrap gap-1 border-b border-zinc-800 p-2">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => {
                setMode(t.id);
                setError("");
              }}
              disabled={busy}
              className={`rounded-md px-3 py-1.5 text-sm transition ${
                mode === t.id ? "bg-zinc-800 text-zinc-50" : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="p-4">
          {mode === "paste" && (
            <textarea
              value={code}
              onChange={(e) => {
                setCode(e.target.value);
                setError("");
              }}
              placeholder={"// SPDX-License-Identifier: MIT\npragma solidity ^0.8.20;\n\ncontract MyVault { ... }"}
              spellCheck={false}
              className="h-72 w-full resize-y rounded-lg border border-zinc-800 bg-zinc-950 p-3 font-mono text-sm text-zinc-200 outline-none focus:border-amber-400/60"
            />
          )}
          {mode === "zip" && (
            <label className="flex h-40 cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-zinc-700 text-sm text-zinc-400 hover:border-amber-400/60">
              <input
                type="file"
                accept=".zip"
                className="hidden"
                onChange={(e) => {
                  setFile(e.target.files?.[0] ?? null);
                  setError("");
                }}
              />
              {file ? <span className="text-zinc-200">{file.name}</span> : "Click to choose a .zip of your project (max 20 MB)"}
              <span className="text-xs text-zinc-600">node_modules, lib, test and mocks folders are skipped</span>
            </label>
          )}
          {mode === "github" && (
            <input
              value={url}
              onChange={(e) => {
                setUrl(e.target.value);
                setError("");
              }}
              placeholder="https://github.com/owner/repo"
              className="w-full rounded-lg border border-zinc-800 bg-zinc-950 p-3 font-mono text-sm outline-none focus:border-amber-400/60"
            />
          )}
          {mode === "address" && (
            <div className="space-y-2">
              <div className="flex gap-2">
                <select
                  value={chainId}
                  onChange={(e) => setChainId(Number(e.target.value))}
                  className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 text-sm outline-none focus:border-amber-400/60"
                >
                  {CHAINS.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <input
                  value={address}
                  onChange={(e) => {
                    setAddress(e.target.value);
                    setError("");
                  }}
                  placeholder="0x…"
                  className="flex-1 rounded-lg border border-zinc-800 bg-zinc-950 p-3 font-mono text-sm outline-none focus:border-amber-400/60"
                />
              </div>
              <p className="text-xs text-zinc-500">
                Fetches the verified source from Sourcify (or Etherscan, if ETHERSCAN_API_KEY is set) and audits it. Check a contract
                before you interact with it.
              </p>
            </div>
          )}
          {mode === "sample-soroban" && (
            <p className="text-sm text-zinc-400">
              Runs on <code className="text-amber-300">samples/soroban-vault</code>, a deliberately vulnerable Soroban (Stellar) contract
              in Rust with missing authorization, double initialisation and unchecked arithmetic. Uses Scout if installed.
            </p>
          )}
          {mode === "sample" && (
            <p className="text-sm text-zinc-400">
              Runs on <code className="text-amber-300">samples/VulnerableVault.sol</code>, a deliberately vulnerable
              contract with reentrancy, tx.origin auth, missing access control, an unchecked send and an arbitrary
              delegatecall.
            </p>
          )}

          {error && <p className="mt-3 text-sm text-red-400">{error}</p>}

          <div className="mt-4 flex items-center gap-4">
            <button
              onClick={submit}
              disabled={busy}
              className="rounded-lg bg-amber-400 px-5 py-2.5 text-sm font-semibold text-zinc-950 transition hover:bg-amber-300 disabled:opacity-60"
            >
              {busy ? "Auditing…" : "Run audit"}
            </button>
            {busy && <span className="text-sm text-zinc-400">{STEPS[step]}…</span>}
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        {[
          ["1 · Detect", "Slither scans the contracts. Its findings are ground truth."],
          ["2 · Explain", "Gemma 4 reads the whole codebase, ranks findings and suggests fixes."],
          ["3 · Verify", "Code checks every quoted line. Unverifiable AI claims are removed."],
        ].map(([t, d]) => (
          <div key={t} className="rounded-xl border border-zinc-800 p-4">
            <h3 className="font-medium text-zinc-100">{t}</h3>
            <p className="mt-1 text-sm text-zinc-400">{d}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
