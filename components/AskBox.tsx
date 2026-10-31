"use client";

import { useState } from "react";
import type { Answer } from "@/lib/ask";
import { useCodeViewer } from "./CodeViewer";

const EXAMPLES = ["Can anyone drain funds?", "Who can call execute()?", "Which functions send ETH?", "What happens if the owner key is lost?"];

interface Turn {
  q: string;
  a?: Answer;
  error?: string;
}

export function AskBox({ reportId, enabled }: { reportId: string; enabled: boolean }) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);

  async function ask(question: string) {
    if (!question.trim() || busy) return;
    const history = turns.filter((t) => t.a).map((t) => ({ q: t.q, a: t.a!.answer }));
    setTurns((t) => [...t, { q: question }]);
    setQ("");
    setBusy(true);
    try {
      const res = await fetch(`/api/report/${reportId}/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, history }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Question failed.");
      setTurns((t) => t.map((x, i) => (i === t.length - 1 ? { ...x, a: data } : x)));
    } catch (e) {
      setTurns((t) => t.map((x, i) => (i === t.length - 1 ? { ...x, error: e instanceof Error ? e.message : "Failed." } : x)));
    } finally {
      setBusy(false);
    }
  }

  if (!enabled) {
    return (
      <p className="rounded-xl border border-zinc-800 p-6 text-sm text-zinc-500">
        Q&amp;A needs an LLM (set JARVIS_API_KEY or LLM_PROVIDER=ollama) and a report that stores its source. Re-run the audit to enable it.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-zinc-400">
        Ask Gemma about this code. Every line it cites is checked against the source, like findings are.
      </p>

      {turns.map((t, i) => (
        <div key={i} className="space-y-2">
          <p className="ml-auto w-fit max-w-[80%] rounded-xl bg-zinc-800 px-3 py-2 text-sm text-zinc-100">{t.q}</p>
          {!t.a && !t.error && <p className="text-sm text-zinc-500">Reading the code…</p>}
          {t.error && <p className="text-sm text-red-400">{t.error}</p>}
          {t.a && <AnswerView a={t.a} />}
        </div>
      ))}

      {turns.length === 0 && (
        <div className="flex flex-wrap gap-2">
          {EXAMPLES.map((e) => (
            <button key={e} onClick={() => ask(e)} className="rounded-full px-3 py-1 text-sm text-zinc-300 ring-1 ring-zinc-700 hover:ring-amber-400/60">
              {e}
            </button>
          ))}
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          ask(q);
        }}
        className="flex gap-2"
      >
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Who can call withdraw()?"
          maxLength={1000}
          className="flex-1 rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-amber-400/60"
        />
        <button
          disabled={busy || !q.trim()}
          className="rounded-lg bg-amber-400 px-4 py-2 text-sm font-semibold text-zinc-950 hover:bg-amber-300 disabled:opacity-50"
        >
          {busy ? "…" : "Ask"}
        </button>
      </form>
    </div>
  );
}

function AnswerView({ a }: { a: Answer }) {
  const view = useCodeViewer();
  const ok = a.citations.filter((c) => c.verified).length;
  return (
    <div className="space-y-2 rounded-xl border border-zinc-800 bg-zinc-900/40 p-3 text-sm">
      <p className="whitespace-pre-wrap leading-relaxed text-zinc-200">
        {/* Line markers like [L42], [L42-L45] or [42, 44] link to the code, but only for lines a verified citation backs. */}
        {a.answer.split(/((?<![\w\]])\[L?\d+(?:\s*[-–,]\s*L?\d+)*\])/).map((part, i) => {
          const nums = i % 2 ? (part.match(/\d+/g) ?? []).map(Number) : [];
          const c = nums.map((n) => a.citations.find((x) => x.verified && x.line === n)).find(Boolean);
          if (!nums.length) return <span key={i}>{part}</span>;
          return c ? (
            <button key={i} onClick={() => view({ path: c.file_name, line: c.line })} className="text-amber-300 hover:underline">
              {part}
            </button>
          ) : (
            <span key={i} title="No verified citation for this line" className="text-zinc-500">
              {part}⚠
            </span>
          );
        })}
      </p>
      {a.citations.length > 0 && (
        <div className="space-y-1">
          <p className={`text-xs ${ok === a.citations.length ? "text-emerald-400" : "text-amber-400"}`}>
            {ok}/{a.citations.length} citation(s) verified against the source
          </p>
          <ol className="space-y-1">
            {a.citations.map((c, i) => (
              <li key={i} className="flex items-start gap-2 font-mono text-xs">
                <span className="text-zinc-500">[{i + 1}]</span>
                {c.verified ? (
                  <button onClick={() => view({ path: c.file_name, line: c.line })} className="text-left hover:text-amber-200">
                    <span className="text-emerald-400">✓ </span>
                    <span className="text-amber-300/90 underline decoration-dotted">
                      {c.file_name}:{c.line}
                    </span>{" "}
                    <span className="text-zinc-400">{c.code_quote}</span>
                  </button>
                ) : (
                  <span className="text-zinc-500 line-through decoration-red-400/60" title={c.note}>
                    <span className="text-red-400 no-underline">✗ </span>
                    {c.file_name}:{c.line} {c.code_quote}
                  </span>
                )}
                {c.note && c.verified && <span className="text-zinc-600">({c.note})</span>}
                {!c.verified && <span className="font-sans text-red-400/80">{c.note}</span>}
              </li>
            ))}
          </ol>
        </div>
      )}
      {a.citations.length === 0 && <p className="text-xs text-amber-400">No citations given. Treat this answer with care.</p>}
    </div>
  );
}
