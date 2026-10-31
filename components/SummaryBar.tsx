import type { Report } from "@/lib/types";
import { SEVERITY_ORDER } from "@/lib/types";
import { SEVERITY_STYLE } from "./SeverityBadge";

export function SummaryBar({ report }: { report: Report }) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        {SEVERITY_ORDER.map((s) => (
          <div key={s} className={`rounded-lg px-3 py-2 ring-1 ${SEVERITY_STYLE[s]}`}>
            <div className="text-2xl font-semibold">{report.summary[s]}</div>
            <div className="text-xs uppercase tracking-wide opacity-80">{s}</div>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-zinc-400">
        <span>
          <b className="text-zinc-100">{report.counts.tool_confirmed}</b> tool-confirmed
        </span>
        <span>
          <b className="text-zinc-100">{report.counts.ai_suggested}</b> AI-suggested
        </span>
        <span>
          <b className="text-zinc-100">{report.counts.false_positives}</b> false positives filtered
        </span>
        <span>
          <b className="text-zinc-100">{report.dropped_findings.length}</b> unverifiable AI claims removed
        </span>
      </div>
    </div>
  );
}
