"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { MapContract } from "@/lib/contractmap";
import type { Chain, Finding } from "@/lib/types";
import { AskBox } from "./AskBox";
import { CodeViewerProvider } from "./CodeViewer";
import { ContractMap } from "./ContractMap";
import { FindingList } from "./FindingList";

type Tab = "findings" | "map" | "ask";

export function ReportClient({
  reportId,
  chain,
  initialFindings,
  initialWorking,
  map,
  hasSources,
  hasLlm,
}: {
  reportId: string;
  chain: Chain;
  initialFindings: Finding[];
  initialWorking: string[];
  map: MapContract[];
  hasSources: boolean;
  hasLlm: boolean;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("findings");
  const [findings, setFindings] = useState(initialFindings);
  const [working, setWorking] = useState(initialWorking);
  const [reauditing, setReauditing] = useState(false);
  const [error, setError] = useState("");

  async function reaudit() {
    setReauditing(true);
    setError("");
    try {
      const res = await fetch(`/api/report/${reportId}/reaudit`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Re-audit failed.");
      router.push(`/report/${data.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Re-audit failed.");
      setReauditing(false);
    }
  }

  const applied = findings.filter((f) => f.fix?.applied).length;
  const tabs: [Tab, string][] = [
    ["findings", `Findings (${findings.filter((f) => f.status !== "false_positive").length})`],
    ["map", "Contract map"],
    ["ask", "Ask about the code"],
  ];

  return (
    <CodeViewerProvider reportId={reportId} findings={findings}>
      {hasSources && (
        <div
          className={`flex flex-wrap items-center gap-3 rounded-xl border px-4 py-3 text-sm ${
            working.length ? "border-sky-500/40 bg-sky-500/5" : "border-zinc-800"
          }`}
        >
          <span className="text-zinc-300">
            {working.length
              ? `${applied} fix(es) applied to ${working.length} file(s). Re-audit to see what changed.`
              : "Generate and apply fixes below, then re-audit to compare."}
          </span>
          <button
            onClick={reaudit}
            disabled={reauditing}
            className="ml-auto rounded-lg bg-sky-400 px-4 py-1.5 text-sm font-semibold text-zinc-950 hover:bg-sky-300 disabled:opacity-60"
          >
            {reauditing ? "Re-auditing…" : working.length ? "Re-audit with fixes" : "Re-audit"}
          </button>
          {error && <p className="w-full text-red-400">{error}</p>}
        </div>
      )}

      <div className="flex gap-1 border-b border-zinc-800">
        {tabs.map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm transition ${
              tab === id ? "border-amber-400 text-zinc-50" : "border-transparent text-zinc-400 hover:text-zinc-200"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Panels stay mounted (hidden) so chat history and map layout survive tab switches. */}
      <div hidden={tab !== "findings"}>
        <FindingList
          findings={findings}
          actions={{
            reportId,
            chain,
            canGenerate: hasSources && hasLlm,
            onUpdate: (f, w) => {
              setFindings(f);
              setWorking(w);
            },
          }}
        />
      </div>
      <div hidden={tab !== "map"}>
        {hasSources ? (
          <ContractMap contracts={map} />
        ) : (
          <p className="rounded-xl border border-zinc-800 p-6 text-sm text-zinc-500">This report was saved without source code. Re-run the audit to see the map.</p>
        )}
      </div>
      <div hidden={tab !== "ask"}>
        <AskBox reportId={reportId} enabled={hasSources && hasLlm} />
      </div>
    </CodeViewerProvider>
  );
}
