# Platform performance validation record

Status: specification checks only. No browser performance baseline or optimization
claim is established by this record.

## Evidence collected during specification — 2026-11-05

- Inspected routing, SXU workspace/showcase, transport/tableau, KGR shell, shared
  SVG chart/matrix code, production server and existing test/build configuration.
- `npm run check:agent-skills-pin`: passed; 188 paths / 24 skills at upstream
  `f63ec56a3cc9`. The pinned mirror was not modified.
- `npm run build:client`: passed using Vite 5.4.11; main file
  `dist/assets/index-B1mU0rxp.js`, 2,913.02 kB minified / 807.93 kB gzip.
  The build emitted the existing >500 kB chunk warning. This is build output,
  not browser transfer, route latency or a measured cause of slowness.
- Build basis: HEAD `f376597213dc41f533848cb0799a3902e8fbade2` on
  `feat/spec031-kgr-expanded-scenarios`, including pre-existing uncommitted edits
  to `src/app/knowledge-graph/GraphView.tsx`, `src/data/knowledgeGraph.ts` and
  `src/data/knowledgeGraph.test.ts`. This is not a reproducible clean-commit
  benchmark; PERF-01 must record the full environment and fixture/diff digests.
- Existing behavior tests are not rerun for this documentation-only change.
  This specification changes no UI, model, service, test, configuration or
  dependency behavior.
- Markdown relative links, code fences and whitespace checked; passed.

## Independent specification review

Reviewed claim: the proposed acceptance gates are reproducible and cannot pass
by acknowledging input while delaying the required result. A fresh-context
reviewer received the artifact and task contract with an adversarial prompt.

Four findings were classified as valid and actionable: missing non-SXU completion
budgets, nonexistent KGR timed-playback assumptions, underspecified input recipes
and incomparable heap states. The spec now includes per-action completion gates
and failure timeouts, actual effective-date controls, input timestamp/dispatch
rules, and identical fully warmed heap-capture states with cache/noise accounting.
These corrections validate the draft's reviewability, not platform performance.
An optional cross-model review was offered; no external reviewer CLI was run.
At the user's request, a [self-contained manual external review prompt](reviews/MANUAL_EXTERNAL_REVIEW_PROMPT.md)
was prepared with the draft documents, relevant source excerpts and product
constraints. No external review result has been received.
A recheck found an export-scope ambiguity: chart CSV currently exports dates and
selected input series, while PNG exports rendered chart content. The completion
gates now preserve those distinct existing contracts without adding CSV fields.
The reviewer reported no other substantive remaining issues. Documentation review
also checked scope, source claims, readability, unchanged model boundaries and
the absence of secrets/new data collection. Implementation criteria remain open.

## Required implementation evidence

PERF-01 must record the exact command and pinned production test configuration.
For each route/interaction, store runner/profile/cache/fixture identity, raw
samples, p50/p95/max, failed completions, batch variation, before/after traces,
resource/byte counts and correctness results. Link raw files from CI artifact
storage or an ignored local output directory; commit compact summaries only.

| Criterion | Required evidence | State |
|---|---|---|
| PERF-AC01 | Complete baseline, profiles, fixed workloads and ranked traces | Not measured |
| PERF-AC02 | Both-profile timings, byte budgets, SXU improvement, heap/cleanup and regression matrix | Not measured |
| PERF-AC03 | SXU golden/verifier, SIM, workspace/export and revision-race tests | Not run for this spec |
| PERF-AC04 | KGR, two chart routes and two selected P2 module comparisons | Not measured |
| PERF-AC05 | Keyboard/focus, four widths, reduced motion, loading/stale/error checks | Not run for this spec |
| PERF-AC06 | Approved CI gates, negative-gate tests, experiment records and rollback | Not implemented |

## Experiment ledger

No optimization experiments have been performed. Add one row per attempt,
including rejected/reverted candidates:

| Task / hypothesis | Fixture / profile | Baseline → candidate p95 | Batch variation | Correctness / trace link | Keep or revert / reason |
|---|---|---|---|---|---|

## Field validation

No field telemetry, observation window, sample sufficiency or production rollout
is approved here. When available, record LCP/INP/CLS p75 by device class and
compare real user results against the lab evidence. Lack of field data must
remain explicit; it cannot be represented as a passing real-user improvement.
