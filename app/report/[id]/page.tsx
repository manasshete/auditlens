import Link from "next/link";
import { notFound } from "next/navigation";
import { ComparisonBanner } from "@/components/ComparisonBanner";
import { ReportClient } from "@/components/ReportClient";
import { RiskGrade } from "@/components/RiskGrade";
import { SummaryBar } from "@/components/SummaryBar";
import { compareReports } from "@/lib/compare";
import { buildContractMap } from "@/lib/contractmap";
import { llmConfig } from "@/lib/gemma";
import { riskScore } from "@/lib/score";
import { loadReport } from "@/lib/storage";

export const dynamic = "force-dynamic";

export default async function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const report = await loadReport(id);
  if (!report) notFound();

  // Recompute the re-audit comparison so it always uses the current matching rules.
  const parent = report.parent_id ? await loadReport(report.parent_id) : null;
  if (parent) report.comparison = compareReports(parent, report);

  const sources = report.sources ?? [];
  const map = buildContractMap(
    sources.filter((f) => f.path.endsWith(report.chain === "soroban" ? ".rs" : ".sol")),
    report.findings,
    report.chain,
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/" className="text-sm text-zinc-500 hover:text-zinc-300">
            ← New audit
          </Link>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-50">{report.project_name}</h1>
          <p className="mt-1 text-sm text-zinc-500">
            {report.files_analyzed} file(s) · {report.chain} · {report.analyzer} · model: {report.model} ·{" "}
            {(report.duration_ms / 1000).toFixed(1)}s · {new Date(report.created_at).toLocaleString()}
          </p>
          {report.origin && <p className="mt-1 font-mono text-xs text-zinc-500">{report.origin}</p>}
          {report.local_llm && (
            <p className="mt-2 inline-block rounded bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-300 ring-1 ring-emerald-500/30">
              Local mode · code never left this machine
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <Link
            href={`/history?project=${encodeURIComponent(report.project_name)}`}
            className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-200 hover:border-amber-400/60"
          >
            History
          </Link>
          <a
            href={`/api/report/${report.report_id}?format=md`}
            className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-200 hover:border-amber-400/60"
          >
            Export Markdown
          </a>
        </div>
      </div>

      <div className="rounded-lg border border-amber-400/30 bg-amber-400/5 px-4 py-2 text-sm text-amber-200">
        Automated first-pass review. Not a substitute for a professional audit.
      </div>

      {report.comparison && <ComparisonBanner c={report.comparison} />}

      <RiskGrade risk={riskScore(report.summary)} reportId={report.report_id} />

      {report.focus && (
        <div className="rounded-lg border border-sky-500/30 bg-sky-500/5 px-4 py-2 text-sm text-sky-200">
          Diff mode: only {report.focus.length} changed function(s) were audited ({report.focus.map((f) => f.name).join(", ")}).
        </div>
      )}

      {report.warnings.length > 0 && (
        <ul className="space-y-1 rounded-lg border border-zinc-800 px-4 py-3 text-sm text-zinc-400">
          {report.warnings.map((w) => (
            <li key={w}>⚠ {w}</li>
          ))}
        </ul>
      )}

      <SummaryBar report={report} />

      <ReportClient
        reportId={report.report_id}
        chain={report.chain}
        initialFindings={report.findings}
        initialWorking={Object.keys(report.working ?? {})}
        map={map}
        hasSources={sources.length > 0}
        hasLlm={llmConfig() !== null}
      />

      {report.dropped_findings.length > 0 && (
        <details className="rounded-xl border border-zinc-800 p-4 text-sm">
          <summary className="cursor-pointer text-zinc-300">
            {report.dropped_findings.length} AI claim(s) removed because they could not be verified
          </summary>
          <ul className="mt-3 space-y-1 text-zinc-500">
            {report.dropped_findings.map((d, i) => (
              <li key={i}>
                <span className="text-zinc-300">{d.title}</span>: {d.reason}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
