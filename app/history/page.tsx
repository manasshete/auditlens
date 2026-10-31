import Link from "next/link";
import { TrendChart } from "@/components/TrendChart";
import { GRADE_COLOR, type Grade } from "@/lib/score";
import { listReports } from "@/lib/storage";

export const dynamic = "force-dynamic";

export default async function HistoryPage({ searchParams }: { searchParams: Promise<{ project?: string }> }) {
  const { project } = await searchParams;
  const all = await listReports();
  const rows = project ? all.filter((r) => r.project_name === project) : all;
  const projects = [...new Set(all.map((r) => r.project_name))];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">Audit history</h1>
        <p className="mt-1 text-sm text-zinc-500">
          {all.length} report(s) across {projects.length} project(s). Indexed in SQLite; the JSON reports stay the source of truth.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Link
          href="/history"
          className={`rounded-full px-3 py-1 text-sm ring-1 ${!project ? "bg-zinc-100 text-zinc-900 ring-zinc-100" : "text-zinc-400 ring-zinc-700 hover:text-zinc-200"}`}
        >
          All projects
        </Link>
        {projects.map((p) => (
          <Link
            key={p}
            href={`/history?project=${encodeURIComponent(p)}`}
            className={`rounded-full px-3 py-1 text-sm ring-1 ${project === p ? "bg-zinc-100 text-zinc-900 ring-zinc-100" : "text-zinc-400 ring-zinc-700 hover:text-zinc-200"}`}
          >
            {p}
          </Link>
        ))}
      </div>

      {project && (
        <section className="rounded-xl border border-zinc-800 p-4">
          <h2 className="mb-3 text-sm font-medium text-zinc-300">Risk score trend · {project}</h2>
          <TrendChart
            points={rows.map((r) => ({ id: r.report_id, date: r.created_at, score: r.score, grade: r.grade, findings: r.findings }))}
          />
        </section>
      )}

      {rows.length === 0 ? (
        <p className="rounded-xl border border-zinc-800 p-6 text-sm text-zinc-500">
          No audits yet. <Link href="/" className="text-amber-300">Run one</Link>.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-zinc-800">
          <table className="w-full text-sm">
            <thead className="bg-zinc-900/60 text-left text-xs uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="px-3 py-2">Grade</th>
                <th className="px-3 py-2">Project</th>
                <th className="px-3 py-2">Date</th>
                <th className="px-3 py-2 text-right">Crit</th>
                <th className="px-3 py-2 text-right">High</th>
                <th className="px-3 py-2 text-right">Med</th>
                <th className="px-3 py-2 text-right">Low</th>
                <th className="px-3 py-2">Mode</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {rows.map((r) => (
                <tr key={r.report_id} className="hover:bg-zinc-900/40">
                  <td className="px-3 py-2">
                    <span
                      className="grid h-6 w-6 place-items-center rounded text-xs font-bold text-zinc-950"
                      style={{ backgroundColor: GRADE_COLOR[r.grade as Grade] }}
                    >
                      {r.grade}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-zinc-200">
                    {r.project_name}
                    {r.parent_id && <span className="ml-2 text-xs text-sky-400">re-audit</span>}
                  </td>
                  <td className="px-3 py-2 text-zinc-400">{new Date(r.created_at).toLocaleString()}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.summary.critical}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.summary.high}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.summary.medium}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.summary.low}</td>
                  <td className="px-3 py-2 text-xs text-zinc-500">
                    {r.chain} · {r.mode}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Link href={`/report/${r.report_id}`} className="text-amber-300 hover:text-amber-200">
                      Open →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
