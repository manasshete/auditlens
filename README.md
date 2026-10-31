# AuditLens

**Slither finds the bugs. Gemma 4 explains them. Code verifies everything.**

An AI-assisted smart contract auditor for Solidity (and Soroban). It runs a static analyzer, sends the findings and the whole codebase to Gemma 4 (long context) for triage and plain-English explanations, then checks every AI claim against the real source code. Claims that can't be verified are removed and listed.

> Automated first-pass review. Not a substitute for a professional audit.

---

## Quick start (local)

**Requirements:** Node 22+ and Python 3.10+.

```bash
# 1. Install the app
npm install

# 2. Install Slither + the Solidity compiler (recommended)
pip install slither-analyzer solc-select
solc-select install 0.8.20
solc-select use 0.8.20

# 3. Optional: Foundry, so exploit tests actually run
#    https://getfoundry.sh  (curl -L https://foundry.paradigm.xyz | bash && foundryup)

# 4. Configure the LLM
cp .env.example .env      # Windows: copy .env.example .env
#    then fill in JARVIS_API_KEY, JARVIS_BASE_URL, GEMMA_MODEL (or use local mode, below)

# 5. Run
npm run dev               # open http://localhost:3000
```

Click **Try sample** to audit `samples/VulnerableVault.sol`, which contains 5 deliberate bugs.

### Run without the UI

```bash
npm run audit -- samples                    # summary + grade in the terminal
npm run audit -- samples --md               # full Markdown report
npm run audit -- path/to/repo --diff main   # diff mode: only functions changed since main
npm run benchmark                           # precision/recall vs Slither alone
```

## Run with Docker

```bash
cp .env.example .env   # fill in the API values
docker compose up --build
```
The image includes Slither, solc 0.8.20 and Foundry. Add `--build-arg INSTALL_SCOUT=true` for Soroban/Scout support (large). Reports are saved to `./reports`.

---

## Features

### On the report page
| Feature | What it does | What keeps it honest |
|---|---|---|
| **Risk grade** | One grade A–F from the severity counts, at the top of the report. **Copy README badge** gives a shields-style SVG (`/api/report/<id>/badge`). | Any critical → F. Any high → D at best. |
| **Code view** | Click a location or quoted line to open the whole file, with the line highlighted and the lines around it shaded. Dots mark every finding in the file. | Shows the stored source, not model output. |
| **Explain like I'm new** | Toggle a simpler explanation per finding, with a link to its SWC Registry entry. | SWC IDs from the model are checked against the registry list in `lib/swc.ts`. Unknown IDs are discarded. |
| **Attack scenario** | Step-by-step attack story for high and critical findings. | Only kept for high/critical findings that passed the quote check. |
| **Fix it** | Gemma writes a patch, shown as a before/after diff. | Code applies the patch, then compiles it with solc-js. Shows **✓ compiles** only if it does. If the *original* doesn't compile here (e.g. missing OpenZeppelin imports), it says the check is unavailable instead of failing the fix. |
| **Apply + Re-audit** | Apply fixes, re-run the whole audit on the patched code, and get *"High: 2 → 0. Fixed: Reentrancy. New: none."* | The comparison is computed by code (matched on file + issue type + code line). |
| **Prove it (exploit test)** | Gemma writes a Foundry test for the bug, and AuditLens runs `forge test`. | **Exploit confirmed** only if the test *passes* against the original code. If a fix is applied, the same test is re-run to show the fix blocks it. Without Foundry the test is shown but marked "not run". |
| **Contract map** | Contracts, functions, who can call them (anyone / restricted / tx.origin / internal), which send ETH, make external calls or delegatecall, with internal call arrows. Risky functions are highlighted. | Built by parsing the source, so it works even when Slither can't compile the project. |
| **Ask about the code** | Chat box: "Can anyone drain funds?", "Who can call execute()?" | Every cited line goes through the same quote check. Unverified citations are struck through and flagged. |

### Other ways in
- **Deployed contracts.** Pick a chain, paste an address. AuditLens fetches the verified source from Sourcify (no key needed) or Etherscan (set `ETHERSCAN_API_KEY`) and audits it.
- **Soroban.** Rust projects (no `.sol` files) are detected automatically. Scout (`cargo install cargo-scout-audit`) is used as the analyzer if installed. Otherwise it's an AI-only review. Try **Soroban sample**.
- **Local mode.** `LLM_PROVIDER=ollama` runs Gemma 4 through Ollama, so code never leaves the machine. AuditLens uses Ollama's native API so it can set `num_ctx`; the OpenAI-compatible endpoint silently truncates long prompts.

### History and benchmark
- **History** (`/history`) lists every audit with its grade and severity counts, plus a risk-score trend per project. It's indexed in SQLite (Node's built-in `node:sqlite`, no native build). The JSON reports stay the source of truth, and the index rebuilds itself if deleted.
- **Benchmark** (`/benchmark`). `npm run benchmark` runs Slither alone and AuditLens on the labelled cases in `benchmark/cases` (plus a clean control contract) and scores both against `benchmark/labels.json`. The page shows the real results from `benchmark/results.json`, or nothing until you've run it.

### GitHub Action / PR bot
`action.yml` makes this repo a GitHub Action. On each pull request it:
1. finds the functions that changed against the base commit (**diff mode**, so it's faster and cheaper),
2. audits only those functions,
3. posts (and updates) one PR comment with the findings,
4. fails the check if a finding is at or above `fail-on` (default `high`). Make the check required to block the merge.

Copy `examples/auditlens-pr.yml` into your contracts repo's `.github/workflows/`.

---

## Modes

| Analyzer | LLM configured | Mode | What you get |
|---|---|---|---|
| ✓ | ✓ | `full` | Tool findings triaged and explained by Gemma, plus verified AI extras |
| ✓ | ✗ (or `MOCK_LLM=true`) | `tool-only` | Raw analyzer findings, no AI. Fix / exploit / Q&A are disabled |
| ✗ | ✓ | `ai-only` | AI review only; every finding is labelled AI-suggested |

## How verification works (`lib/verify.ts`)

For every finding the model returns:
1. **File check.** The file must exist, otherwise the finding is dropped.
2. **Quote check.** The `code_quote` must appear in that file (whitespace-insensitive), otherwise the finding is dropped. If it's a real tool finding, it's kept with the tool's location instead.
3. **Line check.** The line number is corrected to where the quote actually is.
4. **Source check.** Anything claiming to be a Slither/Scout finding must match a real tool result, otherwise it's relabelled as AI.
5. **No hiding.** Every tool finding the model didn't address is added back as "needs review". The model can merge duplicates only by listing their Slither IDs, and those IDs are checked.
6. **Coverage.** Slither silently skips files it can't compile. AuditLens compares the files Slither compiled with the files it collected, and warns about any that were never analyzed.
7. **Severity.** If the model rates a tool finding 2+ levels higher than the tool did, the finding says so.

The same idea runs through the newer features: patches are compiled, exploits are run, Q&A citations are quote-checked, SWC IDs are looked up.

## Project layout

```
app/
  page.tsx                      upload page (paste / zip / GitHub / address / samples)
  report/[id]/page.tsx          report view
  history/page.tsx              audit history + trend
  benchmark/page.tsx            benchmark results
  api/audit/route.ts            runs the pipeline, saves the report
  api/report/[id]/route.ts      report JSON, or ?format=md for Markdown
  api/report/[id]/file          one source file (code view)
  api/report/[id]/finding       fix / apply / unapply / exploit
  api/report/[id]/reaudit       re-audit with applied fixes + comparison
  api/report/[id]/ask           Q&A with verified citations
  api/report/[id]/badge         README badge (SVG)
lib/
  ingest.ts      collect .sol/.rs files, number lines, unzip, GitHub download
  onchain.ts     verified source from Sourcify / Etherscan
  slither.ts     run + parse Slither JSON
  scout.ts       run + parse Scout SARIF (Soroban)
  context.ts     findings-first prompt, token budget
  prompt.ts      system prompts + output schemas
  gemma.ts       OpenAI-compatible and Ollama client (timeout, retry, JSON parsing)
  verify.ts      the trust layer
  pipeline.ts    orchestrates steps 1–6
  fix.ts         patch generation, apply edits, diff
  compile.ts     solc-js / cargo compile check
  exploit.ts     Foundry exploit test generation + run
  ask.ts         Q&A with citation checks
  compare.ts     before/after comparison for re-audits
  contractmap.ts source parser for the contract map and diff mode
  diffmode.ts    changed functions between two versions / git refs
  score.ts       risk grade + badge
  swc.ts         SWC registry
  benchmark.ts   scoring for the benchmark
  storage.ts     JSON reports + SQLite history index
  export.ts      Markdown export
components/      FindingList, CodeViewer, ContractMap, AskBox, RiskGrade, ComparisonBanner, TrendChart, ...
samples/         VulnerableVault.sol, soroban-vault/ (demos)
benchmark/       labelled cases + labels.json (+ results.json once run)
scripts/         audit.ts (CLI), ci.ts (GitHub Action), benchmark.ts
action.yml       GitHub Action definition
```

## Configuring the LLM

AuditLens calls `POST {JARVIS_BASE_URL}/chat/completions` in the OpenAI format with `response_format: json_object`. If the provider rejects `response_format`, it automatically retries without it. Any OpenAI-compatible host that serves Gemma 4 works. Check your provider's docs for the exact base URL and model name.

Gemma 4's "thinking" is turned off by default (`chat_template_kwargs.enable_thinking=false`). In testing on Jarvis Labs (`gemma-4-26b-a4b-it`), thinking-on requests ran out of tokens without answering in 3 of 4 runs, while thinking-off answered every time in about 10 seconds. Set `LLM_THINKING=true` to try it anyway. If a provider rejects the option, AuditLens retries without it.

For local mode, set `LLM_PROVIDER=ollama`, `OLLAMA_MODEL` (the tag you pulled) and optionally `OLLAMA_NUM_CTX` (default 32768). The code budget is reduced automatically to fit.
