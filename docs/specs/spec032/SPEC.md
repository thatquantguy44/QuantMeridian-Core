# Spec 032 — Platform Performance & Visual Responsiveness

Status: draft for review. Specification only; performance improvements and budgets
have not been implemented or validated.

Created: 2026-11-05. Priority: SXU first, then shared loading and visual workflows.

## Objective

Make the terminal feel fast when opening modules, changing scenarios, dragging
controls, inspecting graphs and working with dense tables. Address the reported
slowness in Sources & Uses (`SXU`) first, then carry measured improvements into
other visual modules without changing analytical results or source semantics.

Success means shorter waits for usable content, immediate control feedback,
smooth chart inspection and bounded resource use across repeated navigation.
A skeleton or an early input echo alone does not count as a completed result.

## Scope and priority

This is one performance initiative across existing modules, with independently
verifiable slices in [PLAN.md](PLAN.md) and [TASKS.md](TASKS.md).

| Priority | Workflow | Required coverage |
|---|---|---|
| P0 | `/sources-uses#synthetic` | Initial solved book, all existing scenarios, stress/penalty controls, network hover, tableau selection and copy to workspace |
| P0 | `/sources-uses#workspace` | SIM off, saved-book load, search/edit, compatibility matrix and JSON/CSV round-trip |
| P1 | Terminal shell and route loading | Home → SXU → KGR → home; command navigation, direct URLs, back/forward, module flags and failed chunk recovery |
| P1 | `/knowledge-graph` | Scenario/lens switching, graph selection, impact drillthrough and effective-date selection |
| P1 | `/market-chart`, `/macro-chart` | Crosshair/tooltip, range changes, studies, drawings and export on admitted deterministic history fixtures |
| P2 | `/collateral`, `/inventory-optimizer`, economics visuals | Profile dense tables, matrices and shared chart consumers; fix the highest measured remaining bottleneck in at least two modules |

Inventory the other enabled routes during baselining. Rank further work by user
delay, frequency and affected workflows; do not declare every module optimized
because one shared component changed.

## Current evidence and hypotheses

Inspected on branch `feat/spec031-kgr-expanded-scenarios`, HEAD
`f376597213dc41f533848cb0799a3902e8fbade2`, with pre-existing uncommitted KGR
changes. These observations are structural evidence, not browser latency data.

| Observation | Evidence | Investigation required |
|---|---|---|
| The router statically imports page components across the platform | `src/App.tsx` | Attribute initial parse/evaluation and bytes to routes and shared dependencies; check eager transitive imports before choosing split boundaries |
| Main client chunk is 2,913.02 kB minified / 807.93 kB gzip; Vite emits its large-chunk warning | `npm run build:client`, 2026-11-05; Vite reports decimal kB | Capture the complete initial request graph; this chunk size is not total route transfer size or proof of the perceived delay |
| SXU solves the selected book synchronously in `useMemo`; a second memo solves every comparison scenario when penalty config changes | `src/app/sources-uses/synthetic/SyntheticShowcase.tsx` | Separate solve, verifier, comparison, React render, layout and paint costs during slider bursts |
| Network pointer movement updates tooltip state and reads geometry; flow paths animate continuously | `src/app/sources-uses/synthetic/TransportNetwork.tsx` | Inspect event frequency, forced layout, paint cost and offscreen/hidden-tab activity |
| `ChartCanvas` renders SVG despite its name; hover changes component state while extent/date/path work lives in render | `src/components/charting/ChartCanvas.tsx` | Trace long histories with crosshair movement; distinguish geometry rebuilding from paint cost |
| Shared matrices render cells for the supplied grid | `src/components/charts/Matrix.tsx` and SXU workspace | Measure DOM/cell count, validation and persistence overhead before choosing windowing or pagination |

No browser baseline, leak, slow API, database bottleneck or frame-rate result is
asserted here. The SXU Python package currently contains contracts/canonicalization;
this spec does not assume a working production solve endpoint.

## Measurement contract

Use a production build, the same pinned Chromium version and an otherwise idle
named runner for comparisons. Record commit, dirty-file diff digest, lockfile hash,
OS/CPU/RAM, Node/browser versions, module flags, fixture digest and service mode.
Never compare Vite development/StrictMode timings against production timings.

- **Reference desktop:** 1440 × 900, DPR 1, 60 Hz, unthrottled CPU and network.
- **Constrained desktop:** same runner/viewport, 4× CPU slowdown, 10 Mbps download,
  2 Mbps upload and 40 ms added network latency; record the exact tool settings.
- Check functionality at 320, 768, 1024 and 1440 px, normal and reduced motion.
  Timing gates apply to the desktop profiles; report smaller-width diagnostics.
- Cold runs use a fresh browser context with HTTP cache and app storage cleared,
  then seed only the named fixture/preferences. Warm runs prime the exact route
  and data once before timing; never pool cold, warm or profile samples.
- Take 20 fresh-context navigation samples per route/profile/cache condition and
  50 independent trials per named interaction/profile/fixture. A slider trial is
  a fixed one-second burst followed by release. PERF-01 freezes each control,
  starting value, value trajectory, dispatch cadence/count, reset/settling steps
  and final revision before comparing implementations. Use nearest-rank p95;
  retain all samples, including failures. Record failed/missing completions separately and
  fail the workflow rather than quietly excluding them.
- Repeat paired baseline/candidate batches three times on the same runner. A
  claimed improvement must exceed observed batch-to-batch variation. Retain
  traces for a typical and worst trial; record profiler overhead separately.
- Production browser traces and User Timing are the timing authority. Use React
  profiling builds only for attribution; ordinary production React profiling is
  disabled by default. Label unsupported browser metrics as unavailable.

Start interaction timing at the browser's original input timestamp (including
queue delay), not handler execution. Record every burst event's timestamp and
actual dispatch cadence; use the final event for final-result completion and all
events for feedback latency. End at the first presented frame containing the
expected revision, confirmed by trace/frame evidence. If an automated paint
proxy is used, document/calibrate it against traces; an arbitrary timeout or
double `requestAnimationFrame` alone is not proof of a presented result.

Separate: navigation → usable route; input → next visible feedback; final input
→ latest verified result painted; fetch/server/query time; solve/verifier time;
React work; layout/paint; long tasks; SVG/DOM counts; compressed bytes; retained
heap and active timers/listeners/workers. Mark result readiness only when the
expected snapshot/version is visible in every required result panel.

## Proposed performance budgets

These are engineering targets for review, not measured current performance or
external service SLAs. Freeze the runner, fixtures and budgets in PERF-01 before
optimization. A missed target remains a failed criterion until explicitly revised
with evidence; do not silently relax it after an experiment.

| Metric | Reference desktop target | Constrained desktop target |
|---|---|---|
| Cold navigation → usable route (P0/P1) | p95 ≤ 2.0 s | p95 ≤ 3.0 s |
| Warm navigation → usable route (P0/P1) | p95 ≤ 500 ms | p95 ≤ 800 ms |
| Click/key/range control → visible feedback | p95 ≤ 100 ms | p95 ≤ 200 ms |
| SXU final control input → latest verified default-book result painted | p95 ≤ 300 ms | p95 ≤ 750 ms |
| Chart/network pointer → correct tooltip/crosshair paint | p95 ≤ 50 ms | p95 ≤ 100 ms |
| Frame interval during a fixed 10 s continuous interaction | p95 ≤ 33.4 ms | p95 ≤ 50 ms |

Every result-changing action also has a completion gate. Feedback and completed
state are separate measurements. Fixture bytes, selected IDs, ranges, studies,
edit values and expected outputs must be frozen in the PERF-01 action recipes.

| Action | Completed state | Reference / constrained p95 |
|---|---|---|
| SXU scenario, stress, penalty, lane change or reset | All required panels show the latest verified result or correct infeasibility for the default book | 300 / 750 ms |
| Workspace saved-book load | Expected book, full validation and active view ready; measured from navigation start | Cold/warm route budgets above |
| Workspace search, edit or compatibility selection/change | Correct filtered rows/selected cell and validated edited state; accepted edits persisted | 300 / 750 ms; 100 × 100 stress view 1 / 2 s |
| Workspace JSON/CSV import or SIM copy | Expected whole book validated, selected and persisted in workspace | 500 / 1,500 ms |
| Workspace JSON/CSV export | Complete downloadable artifact matches the current accepted configuration | 500 / 1,500 ms |
| KGR scenario, lens, effective date or node selection | Expected snapshot/date, view and drillthrough agree | 300 / 750 ms |
| Chart range, study or drawing change | Full requested series/studies/drawing and exact inspect values ready | 500 / 1,500 ms |
| Chart PNG export | Complete image preserves the current rendered chart, including visible studies and drawings | 2 / 5 s |
| Chart CSV export | Complete data file preserves current axis dates, selected input-series values and null gaps; studies/drawings remain outside its existing contract | 500 / 1,500 ms |
| Selected P2 module's filter, selection or scenario action | Named final rows/visuals/totals agree with fixture | 750 / 1,500 ms |

The failure timeout is five times the applicable profile's completion budget
(including route budgets for saved-book load). Any timeout, wrong revision,
missing panel, failed validation or artifact failure fails that workload cell,
even if its other samples meet p95. Export completion uses artifact availability
and contents, rather than a paint marker. Existing copy/export restrictions and
infeasible states remain valid outcomes, asserted explicitly in each recipe.

For both profiles, initial critical JavaScript (sum of each unique required file,
gzip level 9, source maps excluded) targets ≤ 300 KiB on home and ≤ 500 KiB on SXU.
Include eager and on-demand dependencies required before readiness; separate
deferred bytes and actual wire compression. Static-server gzip support must be
measured separately from artifact gzip sizes. Do not move required work behind
the readiness marker to pass the gate.

For each currently failing P0 flow, target at least 30% lower p95 completion time
as well as the absolute budget; already-passing flows must stay within budget.
All covered non-target flows must avoid >10% p95 regression outside measured
noise. Record >50 ms main-thread tasks and remove measured interaction blockers
over 100 ms; a worker does not excuse excessive end-to-end completion latency.

For the heap check, prewarm the complete measured route/scenario workload and
any bounded caches to their documented plateau. Return to home with no active
dialog, then settle and GC using a fixed procedure before taking the baseline.
Repeat the identical workload and capture on that same neutral route after
cycles 4, 8, 12, 16 and 20 using the same settling/GC procedure. Retained heap
growth must be ≤10% against the post-warmup baseline and within that envelope at
every checkpoint; route-owned retained objects/resources must not grow across
checkpoints. Record cache entry/byte caps separately. Establish diagnostic noise
with three unchanged-build control batches; a suspected trend inside that noise
requires a longer diagnostic run, not an automatic pass or fail. Caches that
never plateau and unsupported heap capture leave an unresolved validation gap.

Track field LCP ≤2.5 s, INP ≤200 ms and CLS ≤0.1 at p75, separated by device class,
when a governed deployment and sufficient samples exist. Report observation
window and sample counts. Lab interaction timings are not field INP, and these
field thresholds do not replace route/result readiness measurements.

## Workload fixtures

- Keep the existing eight-source/ten-use SXU book, every named scenario, feasible
  and hard-infeasible cases, penalties and verifier checks as the primary gate.
- Add a deterministic workspace-only stress configuration with 100 sources,
  100 uses and 10,000 explicit compatibility states. Gate input feedback above
  and filtered/matrix view completion at p95 ≤1 s / ≤2 s (reference/constrained).
  This is a rendering/configuration fixture, not approval for larger SIM solves.
- Use every existing KGR scenario and lens, including rapid selection changes
  and effective-date selection/route exit. Test playback cleanup only if timed
  playback already exists; adding playback is outside this performance scope.
  Freeze fixture shape/counts at PERF-01; changing the working branch's KGR
  fixture requires a new paired baseline.
- Chart fixtures: 1,000 and 10,000 dated points per series, four series, null gaps,
  two studies and drawings. Derive/verify full-data values; any display sampling
  must preserve gap/extrema meaning, exact inspect values and export semantics.
- For P2, reuse existing generated demo books and fixed as-of data. Record row,
  cell, node/edge and point counts; do not benchmark changing live feeds.

## Implementation requirements

1. **Load only needed work.** Investigate route/component splitting, shared import
   boundaries and delayed export/research dependencies. Preserve shell navigation,
   module flags, direct links, route errors and accessible reserved-space loading.
   Measure cold first-use costs and warm navigation, not just entry-file shrinkage.
2. **Keep SXU controls responsive.** Separate immediate draft input from completed
   verified results if scheduling changes. Reduce redundant comparison solves and
   stabilize data/geometry only where traces show a gain. Worker offload is an
   experiment if CPU blocking remains, not a preselected architecture.
3. **Preserve snapshot consistency.** Any deferred/async computation carries an
   input revision covering scenario, knobs, penalties and book. Only the latest
   verified revision may replace results. Old work is canceled or superseded
   without an unbounded queue; stale results remain clearly marked and cannot be
   copied/exported as current. Infeasible results expose no solution flows.
4. **Bound visual work.** Isolate pointer overlays from static geometry; coalesce
   high-frequency visual updates to animation frames when justified. Pause
   decorative work offscreen/hidden and honor reduced motion. Preserve exact
   selection, keyboard/focus access, units, provenance and table equivalents.
5. **Bound dense views and data work.** Choose pagination/windowing only after
   profiling; maintain whole-book validation, search, totals, editing, focus and
   export parity. Measure synchronous storage/serialization and request waterfalls.
   Any cache needs complete keys, bounded eviction and existing freshness rules;
   no stale financial data or cross-user response reuse as a speed shortcut.
6. **Guard the gain.** Keep per-flow timings, payload/bundle budgets and a short
   experiment ledger (baseline → candidate, variance, keep/revert, correctness).
   Land only gains beyond noise; avoid blanket memoization or rendering rewrites.

## Existing stack, project structure and style

React 18.3.1, React Router 6.28, TypeScript 5.6, Vite 5.4, Vitest 2.1 and Playwright
1.61 are declared in `package.json`; use the lockfile for exact resolutions.

Existing source anchors are listed above; tests live beside data/lib components
and in `test/`. Proposed tooling belongs in `scripts/`, `test/performance/` and
a dedicated `playwright.performance.config.ts`, with bounded helpers in
`src/lib/performance/` only if needed. Store methodology and summarized evidence
in this spec directory; keep raw traces/results in ignored artifacts or CI storage.

Preserve typed pure model functions, immutable inputs, named React components
and local memo dependencies. For example, the existing selected-book pipeline is:

```tsx
const problem = useMemo(() => applyKnobs(scenarioProblem, knobs), [scenarioProblem, knobs]);
const result = useMemo(() => solveSim(problem, config), [problem, config]);
```

This is a source-style example, not a requirement to retain synchronous solving.
Keep performance mechanics separate from numerical truth; add no package or
framework upgrade merely to begin profiling.

## Commands and testing strategy

Commands available now, from the repository root:

```bash
npm run check:agent-skills-pin
npm run typecheck
npm test -- src/data/sourcesUses.test.ts src/data/sourcesUsesSynthetic.test.ts src/lib/sourcesUsesContract.test.ts src/data/knowledgeGraph.test.ts src/lib/nav.test.ts
npm run build
PORT=3000 npm start
npx playwright test test/smoke.spec.ts test/optimization-demos.spec.ts --workers=1
```

The existing Playwright config starts Vite on port 5173; it verifies behavior,
not production performance. PERF-01 must add a separate configuration that uses
the built application/API with a checked-in runner and exact reproducible command.
Use isolated deterministic fixtures for timing; separately smoke-test real service
paths where available so stubs cannot hide waterfalls, errors or stale handling.

For implementation, reproduce each correctness failure first with Vitest or
Playwright; cover out-of-order completion, rapid edits, errors/unmount and full
result/export parity. Keep numerical/verifier tolerances unchanged. Use browser
traces for speed assertions instead of wall-clock limits in ordinary unit tests.
Run focused tests per slice, then the full relevant suite, typecheck/build and
browser checks before completion. This documentation-only change adds no behavior
tests and makes no runtime performance-pass claim.

## Boundaries

- **Always:** follow [spec012's approved decisions](../spec012/SPEC.md), keep SIM
  explicit, preserve compatibility/currency hard blocks, source haircuts, display-only
  rounding, full precision, verification, provenance and source-only missingness.
  Keep setup-only workspace behavior and the SIM-default preference intact.
- **Review before adopting:** new runtime dependencies, worker/renderer migration,
  data freshness or API/schema changes, infrastructure, remote telemetry, CI gate
  changes and revised budgets. Record the measured case and trade-offs first;
  this draft does not approve unresolved product/model decisions.
- **Never:** replace verified solves with heuristics, drop observations or validation
  to meet a timing budget, widen numerical tolerances, silently omit graph/table
  data, synthesize live data, change source permissions, or modify pinned `.agents/`.

## Acceptance criteria

- **PERF-AC01:** Reproducible per-flow baseline and ranked trace-backed bottlenecks
  cover P0/P1 and the P2 inventory, with all required profile/fixture metadata.
- **PERF-AC02:** P0/P1 feedback, per-action completion and bundle budgets pass both
  desktop profiles; SXU improvement and resource/regression gates pass without
  changing numerical truth.
- **PERF-AC03:** All SXU scenarios, verifier checks, SIM switch, workspace operations,
  import/export and rapid-input/error paths retain their specified behavior.
- **PERF-AC04:** KGR and both chart routes meet feedback and per-action completion
  gates; at least two additional P2 modules have measured improvements and
  regression coverage.
- **PERF-AC05:** Keyboard access, focus, reduced motion, responsive layout and clear
  loading/stale/error states survive every optimization.
- **PERF-AC06:** CI enforces approved deterministic byte/correctness gates and stable
  runner timing gates; before/after evidence and rollback exist for every kept change.

## Open decisions

Confirm a representative reference runner and prioritize the two P2 modules from
baseline evidence. Confirm proposed budgets at PERF-01. Decide worker offload,
virtualization or renderer changes only from traces. Field telemetry destination,
privacy/retention and rollout sample window remain proposals; local/CI measurement
can proceed without external telemetry. This draft authorizes no production rollout.

## Primary references

Reviewed 2026-11-05. These support measurement/API semantics; the route budgets
above are proposed product targets. Use APIs compatible with installed React 18.

- [Google Web Vitals](https://web.dev/articles/vitals) — field thresholds and percentiles.
- [React lazy](https://react.dev/reference/react/lazy) — deferred component loading and error handling.
- [React Profiler](https://react.dev/reference/react/Profiler) — render attribution and production profiling caveat.
- [MDN Long Tasks](https://developer.mozilla.org/en-US/docs/Web/API/PerformanceLongTaskTiming) — long-task observation and browser support.
