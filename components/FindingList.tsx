"use client";

import { useMemo, useState } from "react";
import { SWC, swcUrl } from "@/lib/swc";
import type { Chain, Finding } from "@/lib/types";
import { SEVERITY_ORDER } from "@/lib/types";
import { CodeBlock, useCodeViewer } from "./CodeViewer";
import { SeverityBadge } from "./SeverityBadge";

type Filter = "all" | "tool" | "ai" | "false_positive";

export interface FindingActions {
  reportId: string;
  chain: Chain;
  canGenerate: boolean; // LLM configured and source stored
  onUpdate: (findings: Finding[], working: string[]) => void;
}

export function FindingList({ findings, actions }: { findings: Finding[]; actions: FindingActions }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [eli5, setEli5] = useState(false);
  const [open, setOpen] = useState<Set<string>>(() => new Set(findings.slice(0, 1).map((f) => f.id)));

  const shown = useMemo(
    () =>
      findings.filter((f) =>
        filter === "false_positive"
          ? f.status === "false_positive"
          : f.status !== "false_positive" && (filter === "all" || (filter === "ai" ? f.source === "ai" : f.source !== "ai")),
      ),
    [findings, filter],
  );

  const toggle = (id: string) =>
    setOpen((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });

  const filters: [Filter, string][] = [
    ["all", "All"],
    ["tool", "Tool-confirmed"],
    ["ai", "AI-suggested"],
    ["false_positive", "False positives"],
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {filters.map(([id, label]) => (
          <button
            key={id}
            onClick={() => setFilter(id)}
            className={`rounded-full px-3 py-1 text-sm ring-1 transition ${
              filter === id ? "bg-zinc-100 text-zinc-900 ring-zinc-100" : "text-zinc-400 ring-zinc-700 hover:text-zinc-200"
            }`}
          >
            {label}
          </button>
        ))}
        <label className="ml-2 flex cursor-pointer items-center gap-2 text-sm text-zinc-300">
          <span
            role="switch"
            aria-checked={eli5}
            tabIndex={0}
            onClick={() => setEli5(!eli5)}
            onKeyDown={(e) => (e.key === " " || e.key === "Enter") && (e.preventDefault(), setEli5(!eli5))}
            className={`relative h-5 w-9 rounded-full transition ${eli5 ? "bg-amber-400" : "bg-zinc-700"}`}
          >
            <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${eli5 ? "left-[18px]" : "left-0.5"}`} />
          </span>
          Explain like I&apos;m new
        </label>
        <span className="ml-auto flex gap-3 text-xs text-zinc-500">
          <button onClick={() => setOpen(new Set(shown.map((f) => f.id)))} className="hover:text-zinc-300">
            Expand all
          </button>
          <button onClick={() => setOpen(new Set())} className="hover:text-zinc-300">
            Collapse all
          </button>
        </span>
      </div>

      {shown.length === 0 && <p className="rounded-xl border border-zinc-800 p-6 text-sm text-zinc-500">No findings in this view.</p>}

      {SEVERITY_ORDER.map((sev) => {
        const group = shown.filter((f) => f.severity === sev);
        if (!group.length) return null;
        return (
          <section key={sev} className="space-y-2">
            <h3 className="text-xs font-medium uppercase tracking-widest text-zinc-500">
              {sev} · {group.length}
            </h3>
            {group.map((f) => (
              <FindingCard key={f.id} f={f} eli5={eli5} open={open.has(f.id)} onToggle={() => toggle(f.id)} actions={actions} />
            ))}
          </section>
        );
      })}
    </div>
  );
}

function FindingCard({
  f,
  eli5,
  open,
  onToggle,
  actions,
}: {
  f: Finding;
  eli5: boolean;
  open: boolean;
  onToggle: () => void;
  actions: FindingActions;
}) {
  const view = useCodeViewer();
  const [busy, setBusy] = useState<"" | "fix" | "apply" | "unapply" | "exploit">("");
  const [error, setError] = useState("");
  const lang = actions.chain === "soroban" ? "rust" : "solidity";
  const swc = f.swc_id ? SWC[f.swc_id] : undefined;
  const simple = f.simple_explanation || swc?.simple;

  async function act(action: "fix" | "apply" | "unapply" | "exploit") {
    setBusy(action);
    setError("");
    try {
      const res = await fetch(`/api/report/${actions.reportId}/finding`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, finding_id: f.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Action failed.");
      actions.onUpdate(data.findings, data.working);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed.");
    } finally {
      setBusy("");
    }
  }

  const openCode = () => view({ path: f.file_name, line: f.line, title: f.title });

  return (
    <article className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/40">
      <button onClick={onToggle} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-zinc-900">
        <SeverityBadge severity={f.severity} />
        <span className="flex-1 font-medium text-zinc-100">{f.title}</span>
        {f.exploit?.status === "confirmed" && (
          <span className="rounded bg-red-500/15 px-2 py-0.5 text-xs text-red-300 ring-1 ring-red-500/40">Exploit confirmed</span>
        )}
        {f.fix?.applied && <span className="rounded bg-sky-500/10 px-2 py-0.5 text-xs text-sky-300 ring-1 ring-sky-500/30">Fix applied</span>}
        <SourceBadge f={f} />
        <span className="hidden font-mono text-xs text-zinc-500 sm:inline">
          {f.file_name}:{f.line}
        </span>
        <span className={`text-zinc-500 transition ${open ? "rotate-90" : ""}`}>›</span>
      </button>

      {open && (
        <div className="space-y-4 border-t border-zinc-800 px-4 py-4 text-sm">
          <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-zinc-500">
            <span>{f.id}</span>
            <button onClick={openCode} className="font-mono text-amber-300/90 underline decoration-dotted underline-offset-2 hover:text-amber-200">
              {f.file_name}:{f.line}
            </button>
            <span>Type: {f.vulnerability_type}</span>
            {f.swc_id && (
              <a href={swcUrl(f.swc_id)} target="_blank" rel="noreferrer" className="text-sky-400 hover:text-sky-300">
                {f.swc_id} ↗
              </a>
            )}
            {f.slither_check && <span>{f.source === "scout" ? "Scout" : "Slither"}: {f.slither_check}</span>}
            <span>Status: {f.status.replace("_", " ")}</span>
          </div>

          {f.code_quote && (
            <button
              onClick={openCode}
              title="Open the whole file"
              className="group block w-full overflow-x-auto rounded-lg bg-zinc-950 p-3 text-left font-mono text-xs text-amber-100 ring-1 ring-zinc-800 hover:ring-amber-400/50"
            >
              <span className="select-none text-zinc-600">{String(f.line).padStart(4)} │ </span>
              {f.code_quote}
              <span className="float-right select-none pl-4 font-sans text-zinc-600 group-hover:text-amber-300">View in file →</span>
            </button>
          )}

          <div>
            <h4 className="mb-1 text-xs font-medium uppercase tracking-wide text-zinc-500">{eli5 ? "In plain words" : "Explanation"}</h4>
            {eli5 ? (
              <div className="rounded-lg border border-amber-400/20 bg-amber-400/5 p-3 leading-relaxed text-zinc-200">
                <p>{simple ?? "No beginner explanation is available for this finding yet. The technical explanation is below."}</p>
                {!simple && <p className="mt-2 text-zinc-400">{f.explanation}</p>}
                {swc && (
                  <a href={swcUrl(f.swc_id!)} target="_blank" rel="noreferrer" className="mt-2 inline-block text-xs text-sky-400 hover:text-sky-300">
                    Learn more: {f.swc_id} {swc.title} ↗
                  </a>
                )}
              </div>
            ) : (
              <p className="leading-relaxed text-zinc-300">{f.explanation}</p>
            )}
          </div>

          {f.attack_scenario?.length ? (
            <div>
              <h4 className="mb-1 text-xs font-medium uppercase tracking-wide text-zinc-500">Attack scenario</h4>
              <ol className="space-y-1.5 border-l-2 border-red-500/40 pl-4">
                {f.attack_scenario.map((s, i) => (
                  <li key={i} className="flex gap-2 text-zinc-300">
                    <span className="font-mono text-xs leading-5 text-red-400">{i + 1}.</span>
                    <span>{s}</span>
                  </li>
                ))}
              </ol>
            </div>
          ) : null}

          {f.suggested_fix.trim() && (
            <div>
              <h4 className="mb-1 text-xs font-medium uppercase tracking-wide text-zinc-500">Suggested fix</h4>
              <p className="whitespace-pre-wrap leading-relaxed text-zinc-300">{f.suggested_fix}</p>
            </div>
          )}

          {f.status !== "false_positive" && (
            <div className="flex flex-wrap items-center gap-2">
              <ActionButton
                onClick={() => act("fix")}
                busy={busy === "fix"}
                disabled={!!busy || !actions.canGenerate}
                label={f.fix ? "Regenerate fix" : "Fix it"}
                busyLabel="Gemma is writing a patch…"
              />
              {lang === "solidity" && (
                <ActionButton
                  onClick={() => act("exploit")}
                  busy={busy === "exploit"}
                  disabled={!!busy || !actions.canGenerate}
                  label={f.exploit ? "Re-run exploit test" : "Prove it (exploit test)"}
                  busyLabel="Writing and running a Foundry test…"
                />
              )}
              {!actions.canGenerate && <span className="text-xs text-zinc-600">Needs an LLM and a report with stored source.</span>}
            </div>
          )}
          {error && <p className="text-sm text-red-400">{error}</p>}

          {f.fix && <FixPanel f={f} lang={lang} busy={busy} onAct={act} />}
          {f.exploit && <ExploitPanel f={f} />}

          <p className={`text-xs ${f.verified ? "text-emerald-400" : "text-amber-400"}`}>
            {f.verified ? "✓ Verified against source" : "⚠ Not verified"}
            {f.verification_note && <span className="text-zinc-500"> · {f.verification_note}</span>}
          </p>
        </div>
      )}
    </article>
  );
}

function FixPanel({
  f,
  lang,
  busy,
  onAct,
}: {
  f: Finding;
  lang: "solidity" | "rust";
  busy: string;
  onAct: (a: "apply" | "unapply") => void;
}) {
  const fix = f.fix!;
  return (
    <div className="space-y-2 rounded-lg border border-zinc-800 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <h4 className="text-xs font-medium uppercase tracking-wide text-zinc-500">Generated patch</h4>
        {fix.compiles === true && (
          <span className="rounded bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-300 ring-1 ring-emerald-500/30">✓ compiles</span>
        )}
        {fix.compiles === false && (
          <span className="rounded bg-red-500/10 px-2 py-0.5 text-xs text-red-300 ring-1 ring-red-500/30">✗ does not compile</span>
        )}
        {fix.compiles === null && (
          <span className="rounded bg-zinc-500/10 px-2 py-0.5 text-xs text-zinc-400 ring-1 ring-zinc-600">compile check unavailable</span>
        )}
        <span className="text-xs text-zinc-600">{fix.compiler}</span>
        <span className="ml-auto">
          {fix.applied ? (
            <ActionButton onClick={() => onAct("unapply")} busy={busy === "unapply"} disabled={!!busy} label="Undo apply" busyLabel="…" subtle />
          ) : (
            <ActionButton
              onClick={() => onAct("apply")}
              busy={busy === "apply"}
              disabled={!!busy || fix.compiles === false}
              label="Apply fix"
              busyLabel="…"
            />
          )}
        </span>
      </div>
      {fix.summary && <p className="text-zinc-300">{fix.summary}</p>}
      <CodeBlock code={fix.diff.trim()} lang={lang} diff />
      {fix.compile_note && (
        <details className="text-xs text-zinc-500">
          <summary className="cursor-pointer">Compiler notes</summary>
          <pre className="mt-1 whitespace-pre-wrap">{fix.compile_note}</pre>
        </details>
      )}
    </div>
  );
}

const EXPLOIT_STYLE: Record<string, [string, string]> = {
  confirmed: ["Exploit confirmed", "bg-red-500/15 text-red-300 ring-red-500/40"],
  not_confirmed: ["Not confirmed", "bg-zinc-500/10 text-zinc-300 ring-zinc-600"],
  not_run: ["Test written, not run", "bg-zinc-500/10 text-zinc-300 ring-zinc-600"],
  error: ["Test did not compile", "bg-amber-400/10 text-amber-200 ring-amber-400/30"],
};

function ExploitPanel({ f }: { f: Finding }) {
  const ex = f.exploit!;
  const [label, style] = EXPLOIT_STYLE[ex.status];
  return (
    <div className="space-y-2 rounded-lg border border-zinc-800 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <h4 className="text-xs font-medium uppercase tracking-wide text-zinc-500">Exploit test</h4>
        <span className={`rounded px-2 py-0.5 text-xs ring-1 ${style}`}>{label}</span>
        {ex.after_fix === "blocked" && (
          <span className="rounded bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-300 ring-1 ring-emerald-500/30">✓ applied fix blocks it</span>
        )}
        {ex.after_fix === "still_exploitable" && (
          <span className="rounded bg-red-500/10 px-2 py-0.5 text-xs text-red-300 ring-1 ring-red-500/30">✗ still exploitable after fix</span>
        )}
      </div>
      {ex.note && <p className="text-zinc-400">{ex.note}</p>}
      <details>
        <summary className="cursor-pointer text-xs text-zinc-500">test/Exploit.t.sol</summary>
        <div className="mt-2">
          <CodeBlock code={ex.test} lang="solidity" />
        </div>
      </details>
      {ex.output && (
        <details>
          <summary className="cursor-pointer text-xs text-zinc-500">forge output</summary>
          <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap rounded bg-zinc-950 p-2 text-xs text-zinc-400">{ex.output}</pre>
        </details>
      )}
    </div>
  );
}

function ActionButton({
  onClick,
  busy,
  disabled,
  label,
  busyLabel,
  subtle,
}: {
  onClick: () => void;
  busy: boolean;
  disabled: boolean;
  label: string;
  busyLabel: string;
  subtle?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`rounded-md px-3 py-1.5 text-xs font-medium transition disabled:opacity-50 ${
        subtle ? "text-zinc-300 ring-1 ring-zinc-700 hover:ring-zinc-500" : "bg-zinc-800 text-zinc-100 hover:bg-zinc-700"
      }`}
    >
      {busy ? busyLabel : label}
    </button>
  );
}

function SourceBadge({ f }: { f: Finding }) {
  return f.source !== "ai" ? (
    <span className="rounded bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-300 ring-1 ring-emerald-500/30">Tool-confirmed</span>
  ) : (
    <span className="rounded bg-violet-500/10 px-2 py-0.5 text-xs text-violet-300 ring-1 ring-violet-500/30">AI-suggested</span>
  );
}
