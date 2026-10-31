"use client";

import { useState } from "react";
import { GRADE_COLOR, type RiskScore } from "@/lib/score";

export function RiskGrade({ risk, reportId }: { risk: RiskScore; reportId: string }) {
  const [copied, setCopied] = useState(false);
  const color = GRADE_COLOR[risk.grade];

  function copy() {
    const base = window.location.origin;
    const md = `[![AuditLens](${base}/api/report/${reportId}/badge)](${base}/report/${reportId})`;
    navigator.clipboard.writeText(md).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-5 rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
      <div
        className="grid h-16 w-16 shrink-0 place-items-center rounded-xl text-4xl font-bold text-zinc-950"
        style={{ backgroundColor: color }}
        aria-label={`Risk grade ${risk.grade}`}
      >
        {risk.grade}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-xs uppercase tracking-widest text-zinc-500">Risk grade</div>
        <div className="text-lg font-semibold text-zinc-100">
          {risk.score}
          <span className="text-sm font-normal text-zinc-500">/100</span>
        </div>
        <div className="text-sm text-zinc-400">{risk.reason}</div>
      </div>
      <div className="flex flex-col items-end gap-2">
        <img src={`/api/report/${reportId}/badge`} alt={`AuditLens ${risk.grade}`} height={20} />
        <button onClick={copy} className="text-xs text-zinc-400 hover:text-zinc-200">
          {copied ? "✓ Copied" : "Copy README badge"}
        </button>
      </div>
    </div>
  );
}
