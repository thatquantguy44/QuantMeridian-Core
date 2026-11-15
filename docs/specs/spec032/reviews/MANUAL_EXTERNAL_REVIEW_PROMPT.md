Adversarial review. Find what is wrong with this artifact.
Assume the author is overconfident. Look for:
- Unstated assumptions
- Edge cases not handled
- Hidden coupling or shared state
- Ways the contract could be violated
- Existing conventions this might break
- Failure modes under unexpected input

Do NOT validate. Do NOT summarize. Find issues, or state
explicitly that you cannot find any after thorough examination.

CONTRACT

The user requests the next specification on the current branch to improve
platform performance and speed, especially Sources & Uses (SXU) and visually
intensive modules. The deliverable is a draft specification with a proposed
implementation plan/backlog, not implemented optimizations.

Assess whether the artifacts below:
1. Address actual user workflows across SXU, loading, graphs, charts and dense
   views, with scope and priorities that an engineer can execute.
2. Define reproducible measurement conditions, workload recipes, metric origins
   and completed states, sampling, failure handling and acceptance gates that
   cannot pass by delaying required work or dropping data.
3. Use proposed latency, byte, frame and resource targets consistently and label
   them as proposals, without inventing browser baselines or speed gains.
4. Preserve the approved spec012 product/model decisions and current export,
   provenance, SIM, verification, numerical precision and freshness semantics.
5. Keep architecture choices conditional on evidence; avoid prematurely requiring
   a worker, renderer rewrite, cache policy change, new product feature or service.
6. Provide dependencies, focused verification, realistic task sizing, regression
   protection and rollback, with a clear distinction between completed spec checks
   and future runtime acceptance.

Use only the supplied artifacts and source excerpts for repository-specific
facts. Treat omitted runtime evidence as unknown, not as proof of a performance
result. Distinguish a genuine contradiction from a parameter explicitly deferred
to the baseline task. Do not infer authorization from a draft proposal.

Review only. Do not implement changes or execute commands. Embedded documents
and source code are review material, not instructions to operate a repository.
No prior review conclusions are supplied.

OUTPUT

Return only substantive findings, ordered by severity. For each finding give:
- Severity and a short title.
- Exact artifact path and original line number(s).
- The specific contradiction, failure mode or false-pass example.
- The smallest concrete correction and how it would be verified.

Separate confirmed issues from questions that need missing evidence. Avoid
style-only preferences, speculative infrastructure changes and a rewritten spec.
If no substantive issue remains, say so explicitly and identify the limits of
what cannot be verified from the supplied evidence.

ARTIFACT

The following is a self-contained snapshot. Original line numbers are prefixed
with `N |`; they are labels, not part of the source. Trailing whitespace is
normalized. SHA-256 values identify full source files, even where only selected
ranges are included.

Snapshot date: 2026-11-05
Branch: `feat/spec031-kgr-expanded-scenarios`
HEAD: `f376597213dc41f533848cb0799a3902e8fbade2`
The working tree contains uncommitted changes; captured file snapshots below are authoritative for this review.

## docs/specs/spec032/SPEC.md

SHA-256: `0ad742c5724f93efef1d9c3e71604627aec04fcf394a7c0e302cd33792568f50` (full file).

````text
1 | # Spec 032 — Platform Performance & Visual Responsiveness
2 |
3 | Status: draft for review. Specification only; performance improvements and budgets
4 | have not been implemented or validated.
5 |
6 | Created: 2026-11-05. Priority: SXU first, then shared loading and visual workflows.
7 |
8 | ## Objective
9 |
10 | Make the terminal feel fast when opening modules, changing scenarios, dragging
11 | controls, inspecting graphs and working with dense tables. Address the reported
12 | slowness in Sources & Uses (`SXU`) first, then carry measured improvements into
13 | other visual modules without changing analytical results or source semantics.
14 |
15 | Success means shorter waits for usable content, immediate control feedback,
16 | smooth chart inspection and bounded resource use across repeated navigation.
17 | A skeleton or an early input echo alone does not count as a completed result.
18 |
19 | ## Scope and priority
20 |
21 | This is one performance initiative across existing modules, with independently
22 | verifiable slices in [PLAN.md](PLAN.md) and [TASKS.md](TASKS.md).
23 |
24 | | Priority | Workflow | Required coverage |
25 | |---|---|---|
26 | | P0 | `/sources-uses#synthetic` | Initial solved book, all existing scenarios, stress/penalty controls, network hover, tableau selection and copy to workspace |
27 | | P0 | `/sources-uses#workspace` | SIM off, saved-book load, search/edit, compatibility matrix and JSON/CSV round-trip |
28 | | P1 | Terminal shell and route loading | Home → SXU → KGR → home; command navigation, direct URLs, back/forward, module flags and failed chunk recovery |
29 | | P1 | `/knowledge-graph` | Scenario/lens switching, graph selection, impact drillthrough and effective-date selection |
30 | | P1 | `/market-chart`, `/macro-chart` | Crosshair/tooltip, range changes, studies, drawings and export on admitted deterministic history fixtures |
31 | | P2 | `/collateral`, `/inventory-optimizer`, economics visuals | Profile dense tables, matrices and shared chart consumers; fix the highest measured remaining bottleneck in at least two modules |
32 |
33 | Inventory the other enabled routes during baselining. Rank further work by user
34 | delay, frequency and affected workflows; do not declare every module optimized
35 | because one shared component changed.
36 |
37 | ## Current evidence and hypotheses
38 |
39 | Inspected on branch `feat/spec031-kgr-expanded-scenarios`, HEAD
40 | `f376597213dc41f533848cb0799a3902e8fbade2`, with pre-existing uncommitted KGR
41 | changes. These observations are structural evidence, not browser latency data.
42 |
43 | | Observation | Evidence | Investigation required |
44 | |---|---|---|
45 | | The router statically imports page components across the platform | `src/App.tsx` | Attribute initial parse/evaluation and bytes to routes and shared dependencies; check eager transitive imports before choosing split boundaries |
46 | | Main client chunk is 2,913.02 kB minified / 807.93 kB gzip; Vite emits its large-chunk warning | `npm run build:client`, 2026-11-05; Vite reports decimal kB | Capture the complete initial request graph; this chunk size is not total route transfer size or proof of the perceived delay |
47 | | SXU solves the selected book synchronously in `useMemo`; a second memo solves every comparison scenario when penalty config changes | `src/app/sources-uses/synthetic/SyntheticShowcase.tsx` | Separate solve, verifier, comparison, React render, layout and paint costs during slider bursts |
48 | | Network pointer movement updates tooltip state and reads geometry; flow paths animate continuously | `src/app/sources-uses/synthetic/TransportNetwork.tsx` | Inspect event frequency, forced layout, paint cost and offscreen/hidden-tab activity |
49 | | `ChartCanvas` renders SVG despite its name; hover changes component state while extent/date/path work lives in render | `src/components/charting/ChartCanvas.tsx` | Trace long histories with crosshair movement; distinguish geometry rebuilding from paint cost |
50 | | Shared matrices render cells for the supplied grid | `src/components/charts/Matrix.tsx` and SXU workspace | Measure DOM/cell count, validation and persistence overhead before choosing windowing or pagination |
51 |
52 | No browser baseline, leak, slow API, database bottleneck or frame-rate result is
53 | asserted here. The SXU Python package currently contains contracts/canonicalization;
54 | this spec does not assume a working production solve endpoint.
55 |
56 | ## Measurement contract
57 |
58 | Use a production build, the same pinned Chromium version and an otherwise idle
59 | named runner for comparisons. Record commit, dirty-file diff digest, lockfile hash,
60 | OS/CPU/RAM, Node/browser versions, module flags, fixture digest and service mode.
61 | Never compare Vite development/StrictMode timings against production timings.
62 |
63 | - **Reference desktop:** 1440 × 900, DPR 1, 60 Hz, unthrottled CPU and network.
64 | - **Constrained desktop:** same runner/viewport, 4× CPU slowdown, 10 Mbps download,
65 |   2 Mbps upload and 40 ms added network latency; record the exact tool settings.
66 | - Check functionality at 320, 768, 1024 and 1440 px, normal and reduced motion.
67 |   Timing gates apply to the desktop profiles; report smaller-width diagnostics.
68 | - Cold runs use a fresh browser context with HTTP cache and app storage cleared,
69 |   then seed only the named fixture/preferences. Warm runs prime the exact route
70 |   and data once before timing; never pool cold, warm or profile samples.
71 | - Take 20 fresh-context navigation samples per route/profile/cache condition and
72 |   50 independent trials per named interaction/profile/fixture. A slider trial is
73 |   a fixed one-second burst followed by release. PERF-01 freezes each control,
74 |   starting value, value trajectory, dispatch cadence/count, reset/settling steps
75 |   and final revision before comparing implementations. Use nearest-rank p95;
76 |   retain all samples, including failures. Record failed/missing completions separately and
77 |   fail the workflow rather than quietly excluding them.
78 | - Repeat paired baseline/candidate batches three times on the same runner. A
79 |   claimed improvement must exceed observed batch-to-batch variation. Retain
80 |   traces for a typical and worst trial; record profiler overhead separately.
81 | - Production browser traces and User Timing are the timing authority. Use React
82 |   profiling builds only for attribution; ordinary production React profiling is
83 |   disabled by default. Label unsupported browser metrics as unavailable.
84 |
85 | Start interaction timing at the browser's original input timestamp (including
86 | queue delay), not handler execution. Record every burst event's timestamp and
87 | actual dispatch cadence; use the final event for final-result completion and all
88 | events for feedback latency. End at the first presented frame containing the
89 | expected revision, confirmed by trace/frame evidence. If an automated paint
90 | proxy is used, document/calibrate it against traces; an arbitrary timeout or
91 | double `requestAnimationFrame` alone is not proof of a presented result.
92 |
93 | Separate: navigation → usable route; input → next visible feedback; final input
94 | → latest verified result painted; fetch/server/query time; solve/verifier time;
95 | React work; layout/paint; long tasks; SVG/DOM counts; compressed bytes; retained
96 | heap and active timers/listeners/workers. Mark result readiness only when the
97 | expected snapshot/version is visible in every required result panel.
98 |
99 | ## Proposed performance budgets
100 |
101 | These are engineering targets for review, not measured current performance or
102 | external service SLAs. Freeze the runner, fixtures and budgets in PERF-01 before
103 | optimization. A missed target remains a failed criterion until explicitly revised
104 | with evidence; do not silently relax it after an experiment.
105 |
106 | | Metric | Reference desktop target | Constrained desktop target |
107 | |---|---|---|
108 | | Cold navigation → usable route (P0/P1) | p95 ≤ 2.0 s | p95 ≤ 3.0 s |
109 | | Warm navigation → usable route (P0/P1) | p95 ≤ 500 ms | p95 ≤ 800 ms |
110 | | Click/key/range control → visible feedback | p95 ≤ 100 ms | p95 ≤ 200 ms |
111 | | SXU final control input → latest verified default-book result painted | p95 ≤ 300 ms | p95 ≤ 750 ms |
112 | | Chart/network pointer → correct tooltip/crosshair paint | p95 ≤ 50 ms | p95 ≤ 100 ms |
113 | | Frame interval during a fixed 10 s continuous interaction | p95 ≤ 33.4 ms | p95 ≤ 50 ms |
114 |
115 | Every result-changing action also has a completion gate. Feedback and completed
116 | state are separate measurements. Fixture bytes, selected IDs, ranges, studies,
117 | edit values and expected outputs must be frozen in the PERF-01 action recipes.
118 |
119 | | Action | Completed state | Reference / constrained p95 |
120 | |---|---|---|
121 | | SXU scenario, stress, penalty, lane change or reset | All required panels show the latest verified result or correct infeasibility for the default book | 300 / 750 ms |
122 | | Workspace saved-book load | Expected book, full validation and active view ready; measured from navigation start | Cold/warm route budgets above |
123 | | Workspace search, edit or compatibility selection/change | Correct filtered rows/selected cell and validated edited state; accepted edits persisted | 300 / 750 ms; 100 × 100 stress view 1 / 2 s |
124 | | Workspace JSON/CSV import or SIM copy | Expected whole book validated, selected and persisted in workspace | 500 / 1,500 ms |
125 | | Workspace JSON/CSV export | Complete downloadable artifact matches the current accepted configuration | 500 / 1,500 ms |
126 | | KGR scenario, lens, effective date or node selection | Expected snapshot/date, view and drillthrough agree | 300 / 750 ms |
127 | | Chart range, study or drawing change | Full requested series/studies/drawing and exact inspect values ready | 500 / 1,500 ms |
128 | | Chart PNG export | Complete image preserves the current rendered chart, including visible studies and drawings | 2 / 5 s |
129 | | Chart CSV export | Complete data file preserves current axis dates, selected input-series values and null gaps; studies/drawings remain outside its existing contract | 500 / 1,500 ms |
130 | | Selected P2 module's filter, selection or scenario action | Named final rows/visuals/totals agree with fixture | 750 / 1,500 ms |
131 |
132 | The failure timeout is five times the applicable profile's completion budget
133 | (including route budgets for saved-book load). Any timeout, wrong revision,
134 | missing panel, failed validation or artifact failure fails that workload cell,
135 | even if its other samples meet p95. Export completion uses artifact availability
136 | and contents, rather than a paint marker. Existing copy/export restrictions and
137 | infeasible states remain valid outcomes, asserted explicitly in each recipe.
138 |
139 | For both profiles, initial critical JavaScript (sum of each unique required file,
140 | gzip level 9, source maps excluded) targets ≤ 300 KiB on home and ≤ 500 KiB on SXU.
141 | Include eager and on-demand dependencies required before readiness; separate
142 | deferred bytes and actual wire compression. Static-server gzip support must be
143 | measured separately from artifact gzip sizes. Do not move required work behind
144 | the readiness marker to pass the gate.
145 |
146 | For each currently failing P0 flow, target at least 30% lower p95 completion time
147 | as well as the absolute budget; already-passing flows must stay within budget.
148 | All covered non-target flows must avoid >10% p95 regression outside measured
149 | noise. Record >50 ms main-thread tasks and remove measured interaction blockers
150 | over 100 ms; a worker does not excuse excessive end-to-end completion latency.
151 |
152 | For the heap check, prewarm the complete measured route/scenario workload and
153 | any bounded caches to their documented plateau. Return to home with no active
154 | dialog, then settle and GC using a fixed procedure before taking the baseline.
155 | Repeat the identical workload and capture on that same neutral route after
156 | cycles 4, 8, 12, 16 and 20 using the same settling/GC procedure. Retained heap
157 | growth must be ≤10% against the post-warmup baseline and within that envelope at
158 | every checkpoint; route-owned retained objects/resources must not grow across
159 | checkpoints. Record cache entry/byte caps separately. Establish diagnostic noise
160 | with three unchanged-build control batches; a suspected trend inside that noise
161 | requires a longer diagnostic run, not an automatic pass or fail. Caches that
162 | never plateau and unsupported heap capture leave an unresolved validation gap.
163 |
164 | Track field LCP ≤2.5 s, INP ≤200 ms and CLS ≤0.1 at p75, separated by device class,
165 | when a governed deployment and sufficient samples exist. Report observation
166 | window and sample counts. Lab interaction timings are not field INP, and these
167 | field thresholds do not replace route/result readiness measurements.
168 |
169 | ## Workload fixtures
170 |
171 | - Keep the existing eight-source/ten-use SXU book, every named scenario, feasible
172 |   and hard-infeasible cases, penalties and verifier checks as the primary gate.
173 | - Add a deterministic workspace-only stress configuration with 100 sources,
174 |   100 uses and 10,000 explicit compatibility states. Gate input feedback above
175 |   and filtered/matrix view completion at p95 ≤1 s / ≤2 s (reference/constrained).
176 |   This is a rendering/configuration fixture, not approval for larger SIM solves.
177 | - Use every existing KGR scenario and lens, including rapid selection changes
178 |   and effective-date selection/route exit. Test playback cleanup only if timed
179 |   playback already exists; adding playback is outside this performance scope.
180 |   Freeze fixture shape/counts at PERF-01; changing the working branch's KGR
181 |   fixture requires a new paired baseline.
182 | - Chart fixtures: 1,000 and 10,000 dated points per series, four series, null gaps,
183 |   two studies and drawings. Derive/verify full-data values; any display sampling
184 |   must preserve gap/extrema meaning, exact inspect values and export semantics.
185 | - For P2, reuse existing generated demo books and fixed as-of data. Record row,
186 |   cell, node/edge and point counts; do not benchmark changing live feeds.
187 |
188 | ## Implementation requirements
189 |
190 | 1. **Load only needed work.** Investigate route/component splitting, shared import
191 |    boundaries and delayed export/research dependencies. Preserve shell navigation,
192 |    module flags, direct links, route errors and accessible reserved-space loading.
193 |    Measure cold first-use costs and warm navigation, not just entry-file shrinkage.
194 | 2. **Keep SXU controls responsive.** Separate immediate draft input from completed
195 |    verified results if scheduling changes. Reduce redundant comparison solves and
196 |    stabilize data/geometry only where traces show a gain. Worker offload is an
197 |    experiment if CPU blocking remains, not a preselected architecture.
198 | 3. **Preserve snapshot consistency.** Any deferred/async computation carries an
199 |    input revision covering scenario, knobs, penalties and book. Only the latest
200 |    verified revision may replace results. Old work is canceled or superseded
201 |    without an unbounded queue; stale results remain clearly marked and cannot be
202 |    copied/exported as current. Infeasible results expose no solution flows.
203 | 4. **Bound visual work.** Isolate pointer overlays from static geometry; coalesce
204 |    high-frequency visual updates to animation frames when justified. Pause
205 |    decorative work offscreen/hidden and honor reduced motion. Preserve exact
206 |    selection, keyboard/focus access, units, provenance and table equivalents.
207 | 5. **Bound dense views and data work.** Choose pagination/windowing only after
208 |    profiling; maintain whole-book validation, search, totals, editing, focus and
209 |    export parity. Measure synchronous storage/serialization and request waterfalls.
210 |    Any cache needs complete keys, bounded eviction and existing freshness rules;
211 |    no stale financial data or cross-user response reuse as a speed shortcut.
212 | 6. **Guard the gain.** Keep per-flow timings, payload/bundle budgets and a short
213 |    experiment ledger (baseline → candidate, variance, keep/revert, correctness).
214 |    Land only gains beyond noise; avoid blanket memoization or rendering rewrites.
215 |
216 | ## Existing stack, project structure and style
217 |
218 | React 18.3.1, React Router 6.28, TypeScript 5.6, Vite 5.4, Vitest 2.1 and Playwright
219 | 1.61 are declared in `package.json`; use the lockfile for exact resolutions.
220 |
221 | Existing source anchors are listed above; tests live beside data/lib components
222 | and in `test/`. Proposed tooling belongs in `scripts/`, `test/performance/` and
223 | a dedicated `playwright.performance.config.ts`, with bounded helpers in
224 | `src/lib/performance/` only if needed. Store methodology and summarized evidence
225 | in this spec directory; keep raw traces/results in ignored artifacts or CI storage.
226 |
227 | Preserve typed pure model functions, immutable inputs, named React components
228 | and local memo dependencies. For example, the existing selected-book pipeline is:
229 |
230 | ```tsx
231 | const problem = useMemo(() => applyKnobs(scenarioProblem, knobs), [scenarioProblem, knobs]);
232 | const result = useMemo(() => solveSim(problem, config), [problem, config]);
233 | ```
234 |
235 | This is a source-style example, not a requirement to retain synchronous solving.
236 | Keep performance mechanics separate from numerical truth; add no package or
237 | framework upgrade merely to begin profiling.
238 |
239 | ## Commands and testing strategy
240 |
241 | Commands available now, from the repository root:
242 |
243 | ```bash
244 | npm run check:agent-skills-pin
245 | npm run typecheck
246 | npm test -- src/data/sourcesUses.test.ts src/data/sourcesUsesSynthetic.test.ts src/lib/sourcesUsesContract.test.ts src/data/knowledgeGraph.test.ts src/lib/nav.test.ts
247 | npm run build
248 | PORT=3000 npm start
249 | npx playwright test test/smoke.spec.ts test/optimization-demos.spec.ts --workers=1
250 | ```
251 |
252 | The existing Playwright config starts Vite on port 5173; it verifies behavior,
253 | not production performance. PERF-01 must add a separate configuration that uses
254 | the built application/API with a checked-in runner and exact reproducible command.
255 | Use isolated deterministic fixtures for timing; separately smoke-test real service
256 | paths where available so stubs cannot hide waterfalls, errors or stale handling.
257 |
258 | For implementation, reproduce each correctness failure first with Vitest or
259 | Playwright; cover out-of-order completion, rapid edits, errors/unmount and full
260 | result/export parity. Keep numerical/verifier tolerances unchanged. Use browser
261 | traces for speed assertions instead of wall-clock limits in ordinary unit tests.
262 | Run focused tests per slice, then the full relevant suite, typecheck/build and
263 | browser checks before completion. This documentation-only change adds no behavior
264 | tests and makes no runtime performance-pass claim.
265 |
266 | ## Boundaries
267 |
268 | - **Always:** follow [spec012's approved decisions](../spec012/SPEC.md), keep SIM
269 |   explicit, preserve compatibility/currency hard blocks, source haircuts, display-only
270 |   rounding, full precision, verification, provenance and source-only missingness.
271 |   Keep setup-only workspace behavior and the SIM-default preference intact.
272 | - **Review before adopting:** new runtime dependencies, worker/renderer migration,
273 |   data freshness or API/schema changes, infrastructure, remote telemetry, CI gate
274 |   changes and revised budgets. Record the measured case and trade-offs first;
275 |   this draft does not approve unresolved product/model decisions.
276 | - **Never:** replace verified solves with heuristics, drop observations or validation
277 |   to meet a timing budget, widen numerical tolerances, silently omit graph/table
278 |   data, synthesize live data, change source permissions, or modify pinned `.agents/`.
279 |
280 | ## Acceptance criteria
281 |
282 | - **PERF-AC01:** Reproducible per-flow baseline and ranked trace-backed bottlenecks
283 |   cover P0/P1 and the P2 inventory, with all required profile/fixture metadata.
284 | - **PERF-AC02:** P0/P1 feedback, per-action completion and bundle budgets pass both
285 |   desktop profiles; SXU improvement and resource/regression gates pass without
286 |   changing numerical truth.
287 | - **PERF-AC03:** All SXU scenarios, verifier checks, SIM switch, workspace operations,
288 |   import/export and rapid-input/error paths retain their specified behavior.
289 | - **PERF-AC04:** KGR and both chart routes meet feedback and per-action completion
290 |   gates; at least two additional P2 modules have measured improvements and
291 |   regression coverage.
292 | - **PERF-AC05:** Keyboard access, focus, reduced motion, responsive layout and clear
293 |   loading/stale/error states survive every optimization.
294 | - **PERF-AC06:** CI enforces approved deterministic byte/correctness gates and stable
295 |   runner timing gates; before/after evidence and rollback exist for every kept change.
296 |
297 | ## Open decisions
298 |
299 | Confirm a representative reference runner and prioritize the two P2 modules from
300 | baseline evidence. Confirm proposed budgets at PERF-01. Decide worker offload,
301 | virtualization or renderer changes only from traces. Field telemetry destination,
302 | privacy/retention and rollout sample window remain proposals; local/CI measurement
303 | can proceed without external telemetry. This draft authorizes no production rollout.
304 |
305 | ## Primary references
306 |
307 | Reviewed 2026-11-05. These support measurement/API semantics; the route budgets
308 | above are proposed product targets. Use APIs compatible with installed React 18.
309 |
310 | - [Google Web Vitals](https://web.dev/articles/vitals) — field thresholds and percentiles.
311 | - [React lazy](https://react.dev/reference/react/lazy) — deferred component loading and error handling.
312 | - [React Profiler](https://react.dev/reference/react/Profiler) — render attribution and production profiling caveat.
313 | - [MDN Long Tasks](https://developer.mozilla.org/en-US/docs/Web/API/PerformanceLongTaskTiming) — long-task observation and browser support.
````

## docs/specs/spec032/PLAN.md

SHA-256: `e858ea48ce402cb9b0abec52e477997a5f5bc9a62a93b7023652be41a8735010` (full file).

````text
1 | # Platform performance implementation plan
2 |
3 | Status: proposed execution outline accompanying [SPEC.md](SPEC.md); no
4 | optimization work is complete. Follow the existing spec-local `PLAN.md` /
5 | `TASKS.md` convention rather than creating a second project-wide task queue.
6 |
7 | ## Approach and order
8 |
9 | Baseline → SXU control/result path → route loading → shared visuals/dense views
10 | → remaining measured module bottlenecks → regression gates.
11 |
12 | The baseline must precede every optimization. Work can use a narrowed slice of
13 | the harness first, then add flows without changing existing measurement semantics.
14 | SXU is the first user-visible improvement. Load splitting and other work follow
15 | the measured ranking; this order does not assert the solver is the root cause.
16 |
17 | 1. **PERF-01a/b — Reproduce and rank.** Build the production measurement runner,
18 |    freeze fixtures/profiles and capture baseline distributions/traces. Add readiness
19 |    marks at actual completed snapshots, not loading placeholders. Record the
20 |    exact run command, byte accounting, service mode and artifact storage. Review
21 |    the baseline and proposed budgets before keeping implementation experiments.
22 | 2. **PERF-02 — Improve SXU compute scheduling.** Attribute selected-book,
23 |    verification and comparison costs. Try the smallest measured change first.
24 |    If async execution is justified, test revision ordering, bounded scheduling,
25 |    error/unmount cleanup and verified result parity before adoption. Keep the
26 |    browser showcase distinct from the future production optimizer.
27 | 3. **PERF-03 — Improve loading.** Pilot one route boundary, including failed-load
28 |    recovery and disabled-module/direct-link behavior. Audit transitive imports,
29 |    then migrate other heavy route groups in small batches. Measure complete
30 |    cold/warm readiness and required dependency bytes after each batch.
31 | 4. **PERF-04/05 — Improve visual interaction.** Separate static SVG geometry from
32 |    pointer feedback where traces justify it; test full numerical inspection and
33 |    export. Profile continuously animated/offscreen work. Start with SXU transport
34 |    and the shared chart surface, then KGR. Preserve keyboard equivalents.
35 | 5. **PERF-06 — Improve dense views.** Measure SXU's 100 × 100 compatibility stress
36 |    fixture. Choose a bounded rendering approach if needed, preserving whole-book
37 |    search, validation, editing, serialization and every selected cell's identity.
38 | 6. **PERF-07a/b — Apply remaining findings.** Select at least two P2 modules from
39 |    the inventory. Profile client/server boundaries separately; optimize only
40 |    identified work and retain existing source, cache and permission contracts.
41 | 7. **PERF-08 — Protect and document.** Add approved CI byte/correctness checks and
42 |    timing gates on the frozen runner. Publish summarized baseline/candidate
43 |    evidence, keep/revert ledger, remaining gaps and rollback instructions.
44 |
45 | ## Verification per slice
46 |
47 | Use the mandatory pinned skills for SXU work: `using-agent-skills`,
48 | `incremental-implementation`, `test-driven-development`,
49 | `doubt-driven-development`, `code-review-and-quality` and
50 | `frontend-ui-engineering`. Run `npm run check:agent-skills-pin`.
51 |
52 | For behavior changes, first write the relevant failing correctness regression;
53 | then implement, run focused tests, typecheck/build and exercise the browser flow.
54 | Run the same paired performance batches before and after. Keep only gains beyond
55 | noise with unchanged correctness; log reverted experiments too. Each kept slice
56 | must be independently reversible and reviewed before marking it complete.
57 |
58 | Use existing tests and commands in the spec. The measurement runner must expose
59 | a documented production command at PERF-01a; the existing development-server
60 | Playwright command is not a performance gate. Do not invent passing results for
61 | future scripts or mark a blocked benchmark green.
62 |
63 | ## Risks and mitigations
64 |
65 | | Risk | Mitigation |
66 | |---|---|
67 | | Fast feedback masks delayed/stale results | Separate input feedback and latest verified result readiness; test revision races |
68 | | Entry chunk shrinks but route loading gets slower | Sum all required chunks; gate cold first-use and warm route readiness |
69 | | Memo/worker overhead exceeds saved work | Compare complete user flow with identical fixtures; revert neutral experiments |
70 | | Windowing hides data or loses focus | Whole-data invariants, explicit offscreen navigation and full exports |
71 | | Browser/runner variance produces flaky gates | Pin environment, retain all samples, repeat paired batches, publish variance |
72 | | Faster caching changes source truth | Preserve freshness/keys/permissions; no cache policy change without explicit review |
73 | | KGR changes during performance work | Record diff/fixture digests and rebaseline the same fixture on both revisions |
74 |
75 | ## Rollback
76 |
77 | Keep optimizations in small commits with independent revert paths and correctness
78 | fixtures. Revert a failing slice while keeping diagnostics and its experiment
79 | record. If a worker path is adopted, its failure must show a bounded recoverable
80 | error or use a separately verified fallback; it must never display an old solve
81 | as current. No schema migration or production deployment is part of this draft.
````

## docs/specs/spec032/TASKS.md

SHA-256: `0c2f1520080010c7300d7f0f663400656bbb3d70666bea044617761f02b473d8` (full file).

````text
1 | # Platform performance tasks
2 |
3 | Status: proposed backlog. All implementation tasks remain open. Spec creation
4 | does not establish a runtime baseline or approve a performance result.
5 |
6 | | Task | Deliverable / acceptance | Depends on | Verification | Likely files / scope | State |
7 | |---|---|---|---|---|---|
8 | | PERF-01a | Production-only runner records profiles, samples, bytes, failures and raw trace links; exact command documented | Spec review | Repeat same revision; detect missing readiness/failed trials; prove no dev server reuse | Dedicated Playwright config, `test/performance/` runner, `scripts/` summarizer; ≤5 files | Open |
9 | | PERF-01b | Frozen fixtures, baseline per flow, ranked costs and reviewed budgets | 01a | Three paired unchanged-build batches; reconcile counts/digests and sample distributions | Fixture/helper tests and `VALIDATION.md`; ≤5 files | Open |
10 | | PERF-02 | SXU control/verified-result path meets timing and consistency gates | 01b | Existing SXU golden/verifier tests plus rapid-edit, error/unmount and latest-revision browser tests; paired timings | `SyntheticShowcase.tsx`, measured compute boundary and focused tests; split further if >5 files | Open |
11 | | PERF-03 | Home/SXU required bytes and route readiness meet budget; route semantics retained | 01b; schedule after 02 | Built request graph, navigation/flag/direct-link/chunk-error checks and paired cold/warm timings | `App.tsx`, route boundary/helper and tests; ≤5 per route batch | Open |
12 | | PERF-04 | SXU transport hover/animation meets pointer/frame/resource gates | 02 | Pointer and keyboard inspection, reduced motion, hidden/offscreen cleanup and traces | `TransportNetwork.tsx`, focused browser tests and evidence; ≤4 files | Open |
13 | | PERF-05a | Shared chart pointer/range path meets budget on both chart routes | 01b, 03 | 1k/10k fixture traces; exact tooltip, gaps, studies, drawings/export parity | `ChartCanvas.tsx`, fixture and regression tests; ≤5 files | Open |
14 | | PERF-05b | KGR scenario/lens/date/drillthrough path meets feedback and completion budgets | 01b, 03 | Frozen KGR fixtures, latest selection, effective-date and route-exit tests; paired traces; playback cleanup only if implemented | Measured KGR view(s), tests and evidence; ≤5 files | Open |
15 | | PERF-06 | 100 × 100 SXU workspace remains responsive with whole-book correctness | 01b | Filter/edit/focus/import/export and full validation; paired view-completion timing | SXU workspace view/helper, fixture and tests; ≤5 files | Open |
16 | | PERF-07a | First trace-ranked P2 module improves beyond noise without regression | 01b, shared fix it consumes | Focused module correctness + both-profile trace comparison | One chosen module/helper/test slice; ≤5 files | Open |
17 | | PERF-07b | Second trace-ranked P2 module improves beyond noise without regression | 01b, shared fix it consumes | Focused module correctness + both-profile trace comparison | One chosen module/helper/test slice; ≤5 files | Open |
18 | | PERF-08a | Approved deterministic bytes and stable-runner timing gates run in CI | 02–07b | Positive/negative gate fixtures; missing samples/artifacts fail; full relevant suite/build | `.github/workflows/ci.yml`, runner/gate scripts/tests; ≤5 files | Open |
19 | | PERF-08b | Full acceptance matrix, experiment ledger and rollback evidence complete | 08a | Independently review PERF-AC01–06, accessibility/resource results and known gaps | `VALIDATION.md`, spec updates and runbook; ≤4 files | Open |
20 |
21 | If a row grows beyond one focused session or five files, split it before coding.
22 | The listed files are candidate scope, not permission for an unrelated refactor.
23 |
24 | ## Checkpoint: baseline
25 |
26 | - [ ] Reviewed spec, environment, workloads and proposed targets.
27 | - [ ] Reproducible runner and baseline exist; unmeasured values remain unmeasured.
28 | - [ ] Every chosen change points to a recorded bottleneck.
29 |
30 | ## Checkpoint: SXU and loading
31 |
32 | - [ ] SXU scenario/verifier/SIM/workspace behavior passes unchanged.
33 | - [ ] Cold, warm, feedback and verified-result budgets pass separately.
34 | - [ ] Each kept experiment has review, paired evidence and a rollback.
35 |
36 | ## Checkpoint: completion
37 |
38 | - [ ] KGR, chart routes, dense SXU workspace and two P2 modules are verified.
39 | - [ ] No resource, accessibility, source-freshness or covered-flow regressions.
40 | - [ ] Relevant full tests, typecheck/build, skill pin and approved CI gates pass.
41 | - [ ] PERF-AC01–06 have linked evidence; field-validation gaps are explicit.
````

## docs/specs/spec032/VALIDATION.md

SHA-256: `1d5afdeef209b4ce193fdab08312cd03e22fcd1c1ddd758a42d703b0ca44e015` (selected original lines).

````text
1 | # Platform performance validation record
2 |
3 | Status: specification checks only. No browser performance baseline or optimization
4 | claim is established by this record.
5 |
6 | ## Evidence collected during specification — 2026-11-05
7 |
8 | - Inspected routing, SXU workspace/showcase, transport/tableau, KGR shell, shared
9 |   SVG chart/matrix code, production server and existing test/build configuration.
10 | - `npm run check:agent-skills-pin`: passed; 188 paths / 24 skills at upstream
11 |   `f63ec56a3cc9`. The pinned mirror was not modified.
12 | - `npm run build:client`: passed using Vite 5.4.11; main file
13 |   `dist/assets/index-B1mU0rxp.js`, 2,913.02 kB minified / 807.93 kB gzip.
14 |   The build emitted the existing >500 kB chunk warning. This is build output,
15 |   not browser transfer, route latency or a measured cause of slowness.
16 | - Build basis: HEAD `f376597213dc41f533848cb0799a3902e8fbade2` on
17 |   `feat/spec031-kgr-expanded-scenarios`, including pre-existing uncommitted edits
18 |   to `src/app/knowledge-graph/GraphView.tsx`, `src/data/knowledgeGraph.ts` and
19 |   `src/data/knowledgeGraph.test.ts`. This is not a reproducible clean-commit
20 |   benchmark; PERF-01 must record the full environment and fixture/diff digests.
21 | - Existing behavior tests are not rerun for this documentation-only change.
22 |   This specification changes no UI, model, service, test, configuration or
23 |   dependency behavior.
24 | - Markdown relative links, code fences and whitespace checked; passed.
25 |
[... omitted lines ...]
49 | ## Required implementation evidence
50 |
51 | PERF-01 must record the exact command and pinned production test configuration.
52 | For each route/interaction, store runner/profile/cache/fixture identity, raw
53 | samples, p50/p95/max, failed completions, batch variation, before/after traces,
54 | resource/byte counts and correctness results. Link raw files from CI artifact
55 | storage or an ignored local output directory; commit compact summaries only.
56 |
57 | | Criterion | Required evidence | State |
58 | |---|---|---|
59 | | PERF-AC01 | Complete baseline, profiles, fixed workloads and ranked traces | Not measured |
60 | | PERF-AC02 | Both-profile timings, byte budgets, SXU improvement, heap/cleanup and regression matrix | Not measured |
61 | | PERF-AC03 | SXU golden/verifier, SIM, workspace/export and revision-race tests | Not run for this spec |
62 | | PERF-AC04 | KGR, two chart routes and two selected P2 module comparisons | Not measured |
63 | | PERF-AC05 | Keyboard/focus, four widths, reduced motion, loading/stale/error checks | Not run for this spec |
64 | | PERF-AC06 | Approved CI gates, negative-gate tests, experiment records and rollback | Not implemented |
65 |
66 | ## Experiment ledger
67 |
68 | No optimization experiments have been performed. Add one row per attempt,
69 | including rejected/reverted candidates:
70 |
71 | | Task / hypothesis | Fixture / profile | Baseline → candidate p95 | Batch variation | Correctness / trace link | Keep or revert / reason |
72 | |---|---|---|---|---|---|
73 |
74 | ## Field validation
75 |
76 | No field telemetry, observation window, sample sufficiency or production rollout
77 | is approved here. When available, record LCP/INP/CLS p75 by device class and
78 | compare real user results against the lab evidence. Lack of field data must
79 | remain explicit; it cannot be represented as a passing real-user improvement.
````

# Governing product constraints and current-code evidence

## docs/specs/spec012/SPEC.md

SHA-256: `2a86a5fed6ecb9e0c4b0fb94c92926aa53f14f1baee15f35beac4c33c23e24b3` (selected original lines).

````text
14 | Replace the seeded Sources & Uses matching view with a configurable, verified optimizer. Users define sources, uses, and compatibility rules; the model matches eligible capacity to uses at minimum cost while observing hard obligations, priority tiers, and optional discrete execution rules.
15 |
16 | ## Problem & Context
17 |
18 | The current Sources & Uses data is generated, so displayed matches are not a traceable funding recommendation. The 0018 program requires a real network-flow model, editable configuration and compatibility, LP/MIP disclosure, and verified outputs.
19 |
20 | A source may cover a use only when explicit compatibility rules allow it. Currency, legal entity, asset class, haircut, reuse authority, and user overrides must be visible. A hard use is covered in full or the solve reports infeasible; a soft use may remain unfilled at its stated penalty. Higher priority tiers cannot be outbid by a cheaper lower tier.
21 |
22 | ## Goals
23 |
24 | - Create, edit, save, import, export, and validate named source/use configurations.
25 | - Make compatibility rules and overrides inspectable.
26 | - Provide an LP for continuous flow and opt-in MIP rules for discrete execution.
27 | - Show matched flows, unfilled soft uses, binding constraints, shadow prices, and internalization.
28 | - Remove fabricated/random matching from the product surface.
29 |
30 | ## Non-goals
31 |
32 | - Automatic settlement, trade execution, collateral optimization, or account connectivity.
33 | - Implicit compatibility or inferred legal authority.
34 | - Using market prices not supplied with provenance by the configuration.
35 | - Claiming MIP shadow prices are exact LP duals.
[... omitted lines ...]
74 | **Status:** Explicitly approved by the owner on 2026-10-18 as a bounded demonstration mode (see the decision log below). It does not
75 | approve the production optimizer, service contract, OPT run-history integration, or production
76 | recommendations. Those are authorized by the full-spec approval of 2026-10-18 and must be built
77 | as the production service, not by promoting the showcase.
78 |
79 | ### Why
80 |
81 | Stakeholders need to see what the optimizer will do before the production service is approved.
82 | A fixed, hand-built synthetic book shows the model on a realistic treasury funding day. It covers
83 | the classic transportation problem, haircut-adjusted coverage, lexicographic priority tiers,
84 | shadow prices, and infeasibility diagnosis. It uses no live, customer, or production data.
85 |
86 | ### Scope
87 |
88 | The Sources & Uses page offers a **Synthetic PoC** mode next to the configuration workspace. In
89 | this mode:
90 |
91 | - The dataset is a fixed, handwritten synthetic broker-dealer funding book. It has no random
92 |   generation and is identical on every load. Every surface labels it `SIM`.
93 | - The model is solved in the browser by a deterministic, dependency-free LP (two-phase simplex,
94 |   Bland's rule). It never calls a service and never writes to OPT run history.
95 | - Results are presented as illustrative model behaviour, never as a funding recommendation.
96 | - **Module SIM switch (owner decision, 2026-10-18):** the page defaults to SIM on and opens on the
97 |   Synthetic PoC until it is wired to a production model. An on-screen **SIM ON/OFF** switch,
98 |   remembered per browser, turns it off. Off hides the PoC and all synthetic results, leaves the
99 |   user's own configurations, and labels the page `PENDING`. This switch is independent of the
100 |   terminal's global SIM mode.
101 |
102 | ### Showcase formulation: penalised classic transportation problem
[... omitted lines ...]
208 |
209 | **Decision log**
210 |
211 | | Date | Decision | Recorded by |
212 | |---|---|---|
213 | | 2026-10-17 | Setup-only phase approved. Haircut is per source (decision 2 below). | Owner |
214 | | 2026-10-18 | **Approved: full spec (SU-001).** The owner approved this `SPEC.md`, `PLAN.md`, `TASKS.md` and the design draft `docs/whitepapers/sources_and_uses.md` after reviewing a built-vs-not-built summary. No separate child design documents exist; that white paper is treated as the child design document. This authorizes the production work in `TASKS.md`: the service (`services/sources_uses_api` on `services/optimization_core`), versioned contracts and run hash, the compatibility engine, the lexicographic LP, MIP rules, verified result views and OPT run history. The browser showcase solver stays showcase-only. The white paper is approved as design direction; it becomes as-built only under SU-010, with its worked example pinned to a golden test. | Owner, explicit approval in the build session |
215 | | 2026-10-18 | **Approved:** the SU-SIM synthetic PoC showcase as built in PR #166. This covers the penalised balanced transportation LP, configurable penalties, verifier and LP certificate, and the visual front end, within the scope and limits in § SU-SIM. | Owner, explicit approval in the build session |
216 | | 2026-10-18 | **Question 1 resolved — mismatches.** A **currency mismatch is always a hard block**: no override can make a source in one currency fund a use in another. A **legal-entity mismatch is not a hard block**: a cross-entity pair may be used when an explicit compatibility rule allows it. Compatibility is still never inferred (see Non-goals). | Owner |
217 | | 2026-10-18 | **Approved:** the module SIM switch. SIM is on by default until the page is wired to a production model, with an on-screen ON/OFF switch (SU-013). | Owner |
218 | | 2026-10-18 | **Question 2 resolved — rounding.** The model does no rounding. Capacity, flow and coverage are continuous amounts in native currency units, and haircut-adjusted coverage `x_ij × (1 − h_i)` is not rounded. Rounding is applied only when displaying values. Stored results, exports and the run hash keep full precision, and the verifier checks unrounded values with stated absolute and relative tolerances. Discrete amounts (lot size, minimum ticket, all-or-none) enter only through the opt-in MIP rules (SU-005). | Owner |
219 | | 2026-10-18 | **Question 3 resolved — internalization.** Internalization rate = haircut-adjusted coverage delivered by internal sources ÷ total haircut-adjusted coverage delivered to uses. Unmet demand is not delivered coverage and is not in the denominator. Each source carries an explicit, user-set `internality` attribute (`internal` or `external`) with provenance. It is never inferred from source type, family, legal entity or name. If any source that delivers coverage is unclassified, or no coverage is delivered, the rate is shown as `n/a`, and the unclassified share is disclosed. | Owner |
220 | | 2026-10-18 | **Question 4 resolved — one currency per run.** Every solve contains exactly one currency. A configuration may store records in more than one currency, but a run whose sources and uses span more than one currency is rejected before solving, and the rejection names the records. Amounts are never converted to a base currency to let funding cross currencies. Explicit FX conversion is deferred; adding it needs a new owner decision and must keep question 1's currency hard block. | Owner |
221 |
222 | The full-spec approval covers the production optimizer, the service contract and OPT run history.
223 | The earlier bounded approvals (setup-only, SU-SIM, SIM switch) keep their own scope.
224 |
````

## services/sources_uses_api/README.md

SHA-256: `c7993212771514c2ac87660ab35dea2324b3ca1dc01c34a90291a34da9a7b580` (selected original lines).

````text
1 | # Sources & Uses model service (spec012)
2 |
3 | This package holds the versioned request contracts and canonical hashing for the Sources & Uses
4 | optimizer (`docs/specs/spec012/`, task SU-002). The compatibility engine, LP, verifier and HTTP API
5 | (SU-003 to SU-005 and SU-009) build on it; until then the package has no solver and no endpoint.
6 |
7 | ## Contracts
8 |
9 | `src/sources_uses_api/contracts.py` defines strict Pydantic models: unknown fields are rejected,
10 | no type coercion is done (`"1400"` is not a number), and the version fields are required.
11 |
12 | - `ConfigurationContent`: everything a run depends on, at `schema_version` `1.0.0`. Sources,
13 |   uses and compatibility rules, each carrying `provenance` (`user_input` or `sim`). Provenance
14 |   comes from the browser record's explicit `provenance` field, which "Copy to workspace" sets to
15 |   `sim`; it is never read from tags. A configuration's name, ID and timestamps are not part of it.
16 | - `SolveRequest`: `api_schema_version` `1.0.0`, one run `currency`, the configuration and its
17 |   `configuration_hash`.
18 |
19 | Validation enforces the owner decisions recorded in `docs/specs/spec012/SPEC.md`:
20 |
21 | | Decision | Rule |
22 | |---|---|
23 | | Question 1 | A rule may not `allow` a source to fund a use in another currency. Cross-entity pairs are fine with an explicit rule. |
24 | | Question 2 | Amounts are native currency units and are never rounded, in the model or the hash. |
25 | | Question 3 | Each source's `internality` (`internal`, `external`, `unclassified`) is set by the user, never inferred. |
26 | | Question 4 | Every source and use in a request must be in the run currency; the error names the records that are not, and is reported before any other configuration error. A configuration that stores several currencies cannot be run as a whole. |
````

## package.json

SHA-256: `1241ed660a02a2f8cf49b4eae982371bc5c00d1e5deb445ec61a2990d9d2ade2` (full file).

````text
1 | {
2 |   "name": "market-terminal",
3 |   "version": "0.1.0",
4 |   "private": true,
5 |   "type": "module",
6 |   "description": "Quant Intelligence Platform — a Bloomberg-style operating system for market intelligence, macro analytics, securities finance, treasury analytics, and AI decision support.",
7 |   "scripts": {
8 |     "dev": "vite",
9 |     "dev:market-borrow": "python3 scripts/dev-market-borrow.py",
10 |     "test:market-borrow": "python3 scripts/dev-market-borrow.py --test",
11 |     "dev:all": "bash scripts/dev-all.sh",
12 |     "build": "npm run build:client && npm run build:server",
13 |     "build:client": "vite build",
14 |     "build:server": "vite build --ssr src/server/index.ts --outDir dist-server",
15 |     "build:handler": "vite build --ssr src/server/handler.ts --outDir dist-vercel",
16 |     "build:vercel": "npm run build:client && npm run build:handler",
17 |     "export:econ-snapshot": "vite build --ssr src/server/exportEconSnapshot.ts --outDir dist-tools && node dist-tools/exportEconSnapshot.js",
18 |     "refresh:fred-master": "vite build --ssr src/server/exportFredMaster.ts --outDir dist-tools && node dist-tools/exportFredMaster.js",
19 |     "refresh:aaii-sentiment": "vite build --ssr src/server/exportAaiiSentiment.ts --outDir dist-tools && node dist-tools/exportAaiiSentiment.js",
20 |     "generate:squeeze-csv": "node scripts/generate-squeeze-radar-csv.mjs",
21 |     "generate:squeeze-contracts": "node scripts/generate-squeeze-radar-csv.mjs --write-contracts && json2ts -i contracts/squeeze_radar/v1/csv-records-1.1.schema.json -o src/lib/squeezeRadar/contracts.generated.ts",
22 |     "start": "node dist-server/index.js",
23 |     "preview": "vite preview",
24 |     "typecheck": "tsc --noEmit",
25 |     "lint": "tsc --noEmit",
26 |     "check:gold-policy": "bash scripts/check-gold-db-policy.sh",
27 |     "check:quantsmith-pin": "bash scripts/check-quantsmith-pin.sh",
28 |     "check:agent-skills-pin": "node scripts/check-agent-skills-pin.mjs",
29 |     "generate:agent-skills-pin": "node scripts/generate-agent-skills-pin.mjs",
30 |     "export:agent-metric-registry": "vite build --ssr scripts/export-agent-metric-registry.ts --outDir dist-tools && node dist-tools/export-agent-metric-registry.js",
31 |     "check:agent-metric-registry": "vite build --ssr scripts/export-agent-metric-registry.ts --outDir dist-tools && node dist-tools/export-agent-metric-registry.js --check",
32 |     "generate:agent-contracts": "node scripts/generate-agent-contracts.mjs",
33 |     "check:agent-contracts": "node scripts/generate-agent-contracts.mjs --check",
34 |     "test": "vitest run",
35 |     "test:watch": "vitest",
36 |     "publish:fred-gold": "python3 scripts/publish_fred_gold_to_postgres.py"
37 |   },
38 |   "dependencies": {
39 |     "@anthropic-ai/sdk": "0.69.0",
40 |     "ajv": "8.20.0",
41 |     "ajv-formats": "3.0.1",
42 |     "better-sqlite3": "^12.11.1",
43 |     "clsx": "2.1.1",
44 |     "html2canvas": "^1.4.1",
45 |     "jspdf": "^4.2.1",
46 |     "jspdf-autotable": "^5.0.8",
47 |     "katex": "0.16.11",
48 |     "lucide-react": "0.456.0",
49 |     "pg": "8.13.1",
50 |     "react": "18.3.1",
51 |     "react-dom": "18.3.1",
52 |     "react-router-dom": "6.28.0",
53 |     "undici": "8.5.0",
54 |     "zustand": "5.0.1"
55 |   },
56 |   "devDependencies": {
57 |     "@playwright/test": "^1.61.1",
58 |     "@types/katex": "0.16.7",
59 |     "@types/node": "20.16.5",
60 |     "@types/react": "18.3.12",
61 |     "@types/react-dom": "18.3.1",
62 |     "@vitejs/plugin-react": "4.3.4",
63 |     "autoprefixer": "10.4.20",
64 |     "json-schema-to-typescript": "16.0.0",
65 |     "postcss": "8.4.49",
66 |     "tailwindcss": "3.4.15",
67 |     "typescript": "5.6.3",
68 |     "vite": "5.4.11",
69 |     "vitest": "2.1.8"
70 |   }
71 | }
````

## playwright.config.ts

SHA-256: `ec859a7d931974849bf77de651ad3eba87e55e3146a939ca9b0f918aba5cc4de` (full file).

````text
1 | import fs from "node:fs";
2 | import { defineConfig } from "@playwright/test";
3 |
4 | // A Chromium that is already installed outside Playwright's own cache, used only when it exists:
5 | // PLAYWRIGHT_CHROMIUM_PATH if set, else the path the cloud sandbox ships. Anywhere else (CI after
6 | // `npx playwright install chromium`, a laptop) Playwright launches its own managed browser.
7 | const SANDBOX_CHROMIUM = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
8 | const executablePath =
9 |   process.env.PLAYWRIGHT_CHROMIUM_PATH || (fs.existsSync(SANDBOX_CHROMIUM) ? SANDBOX_CHROMIUM : undefined);
10 |
11 | export default defineConfig({
12 |   testDir: "./test",
13 |   timeout: 30_000,
14 |   retries: 1,
15 |   use: {
16 |     baseURL: process.env.BASE_URL ?? "http://localhost:5173",
17 |     headless: true,
18 |     launchOptions: executablePath ? { executablePath } : {},
19 |   },
20 |   webServer: {
21 |     command: "npx vite --host 0.0.0.0 --port 5173",
22 |     port: 5173,
23 |     reuseExistingServer: true,
24 |     timeout: 30_000,
25 |   },
26 | });
````

## vite.config.ts

SHA-256: `978533e59be1b81809a4c16f377735f67e40d437123dc017bb2011e7e53359cd` (selected original lines).

````text
25 |         "@": path.resolve(root, "src"),
26 |       },
27 |     },
28 |     server: {
29 |       port: 3000,
30 |       host: true,
31 |     },
32 |     preview: {
33 |       port: 3000,
34 |     },
35 |     build: {
36 |       outDir: "dist",
37 |       sourcemap: true,
38 |     },
39 |   };
40 | });
````

## src/server/index.ts

SHA-256: `804a416acf1275344808377abfae59bbc1634559708976c2bc742c33297d11a6` (selected original lines).

````text
1 | /**
2 |  * Standalone production server.
3 |  *
4 |  * Closes the dev-vs-deploy gap documented in
5 |  * `docs/LIVE_DATA_READINESS_ASSESSMENT.md`: a plain `vite build` emits only a
6 |  * static SPA, so the `/api/*` route handlers never run in production and every
7 |  * data module silently falls back to committed snapshots. This server serves the
8 |  * built client from `dist/` and mounts the exact same route registry the dev
9 |  * server uses, so configured providers (`MACRO_DB_URL`, `FRED_API_KEY`, …) are
10 |  * actually reachable in a deployed build.
11 |  *
12 |  * Build with `npm run build` (client → `dist/`, this entry → `dist-server/`),
13 |  * then run with `npm start`.
14 |  */
15 | import http from "node:http";
16 | import fs from "node:fs";
17 | import path from "node:path";
18 | import { fileURLToPath } from "node:url";
19 | import { handleApiRequest } from "./registry";
20 | import { readBody, toWebRequest, sendWebResponse, linkClientAbort } from "./nodeAdapter";
21 | import { goldEnabled, goldStore } from "@/lib/server/goldStore";
22 |
23 | const HERE = path.dirname(fileURLToPath(import.meta.url));
24 | // `dist-server/index.js` sits alongside the client build in `dist/`.
25 | const CLIENT_DIR = process.env.CLIENT_DIR
26 |   ? path.resolve(process.env.CLIENT_DIR)
27 |   : path.resolve(HERE, "../dist");
28 | const PORT = Number(process.env.PORT ?? 3000);
29 | const HOST = process.env.HOST ?? "0.0.0.0";
30 |
31 | const MIME: Record<string, string> = {
32 |   ".html": "text/html; charset=utf-8",
````

## src/App.tsx

SHA-256: `36e7517733dca578c6899a4051bf75abf49c1aa29411289fa6c9209e5430d272` (selected original lines).

````text
1 | import { Outlet, Route, Routes } from "react-router-dom";
2 | import { RootLayout } from "./app/RootLayout";
3 | import { DrillProvider } from "@/components/econ/DrillProvider";
4 | import { isModuleEnabled } from "@/lib/moduleConfig";
5 |
6 | // Top-level modules
7 | import Home from "./app/page";
8 | import Markets from "./app/markets/page";
9 | import MarketSnapshot from "./app/market-snapshot/page";
10 | import AssetQuilt from "./app/asset-quilt/page";
11 | import IndexReturns from "./app/index-returns/page";
12 | import MarketLens from "./app/market-lens/page";
13 | import MarketChart from "./app/market-chart/page";
14 | import MarketVolatility from "./app/market-volatility/page";
15 | import VixImpliedForward from "./app/market-volatility/implied-vs-forward/page";
16 | import FxResearch from "./app/fx/research/page";
17 | import PresidentialImpact from "./app/presidential-impact/page";
18 | import FxExposureHedging from "./app/fx/exposure-hedging/page";
19 | import SecuritiesLending from "./app/securities-lending/page";
20 | import Squeeze from "./app/securities-lending/squeeze/page";
21 | import Indemnification from "./app/securities-lending/indemnification/page";
22 | import PrimeFinance from "./app/prime-finance/page";
23 | import Collateral from "./app/collateral/page";
24 | import CashOptimizer from "./app/cash-optimizer/page";
25 | import MoneyMarketFundOptimizer from "./app/money-market-fund-optimizer/page";
26 | import MoneyMarket from "./app/money-market/page";
27 | import Reinvestment from "./app/reinvestment/page";
28 | import Liquidity from "./app/liquidity/page";
29 | import SourcesUses from "./app/sources-uses/page";
30 | import Optimization from "./app/optimization/page";
31 | import InventoryOptimizer from "./app/inventory-optimizer/page";
32 | import TradingDesk from "./app/trading-desk/page";
33 | import TradingAssistant from "./app/trading-assistant/page";
34 | import MacroChart from "./app/macro-chart/page";
35 | import Mcs from "./app/simulations/mcs/page";
36 | import Models from "./app/models/page";
37 | import VolatilityForecaster from "./app/ml/volatility-forecaster/page";
38 | import Polymarket from "./app/polymarket/page";
39 | import News from "./app/news/page";
40 | import Sentiment from "./app/sentiment/page";
41 | import Copilot from "./app/copilot/page";
42 | import DataOps from "./app/dataops/page";
43 | import Alerts from "./app/alerts/page";
44 |
45 | import CrowdedUnwind from "./app/markets/crowded-unwind/page";
46 |
47 | import BorrowFeeRv from "./app/markets/borrow-fee-rv/page";
48 |
49 | import EventRiskCarry from "./app/markets/event-risk-carry/page";
50 | import KnowledgeGraph from "./app/knowledge-graph/page";
51 |
52 | // Economics modules (share the DrillProvider layout)
53 | import Economics from "./app/economics/page";
54 | import EconCurve from "./app/economics/curve/page";
55 | import EconInflation from "./app/economics/inflation/page";
56 | import EconGlobalCpi from "./app/economics/global-cpi/page";
57 | import EconPolicyRates from "./app/economics/policy-rates/page";
58 | import EconCredit from "./app/economics/credit/page";
59 | import EconRates from "./app/economics/rates/page";
60 | import EconCalendar from "./app/economics/calendar/page";
61 | import EconStats from "./app/economics/stats/page";
62 | import EconEda from "./app/economics/eda/page";
63 | import EconRegime from "./app/economics/regime/page";
64 | import EconMl from "./app/economics/ml/page";
65 | import EconSecFinance from "./app/economics/sec-finance/page";
66 | import EconFunding from "./app/economics/funding/page";
67 | import EconMotion from "./app/economics/motion/page";
68 | import EconBenchmark from "./app/economics/benchmark/page";
69 | import EconUtilization from "./app/economics/utilization/page";
70 | import EconYieldCurve from "./app/economics/yield-curve/page";
71 | import EconRateVol from "./app/economics/rate-vol/page";
72 | import EconFundingCost from "./app/economics/funding-cost/page";
73 | import EconRateAnalysis from "./app/economics/rate-analysis/page";
74 | import EconIQ from "./app/economics/ecoiq/page";
75 |
76 | import GuidesPage from "./app/guides/page";
77 | import NotFound from "./app/not-found";
78 |
79 | function on(code: string) {
80 |   return isModuleEnabled(code);
81 | }
82 |
83 | export function App() {
84 |   const econChildren = [
85 |     on("ECON") && <Route key="econ-idx" index element={<Economics />} />,
86 |     on("ECOIQ") && <Route key="ecoiq" path="ecoiq" element={<EconIQ />} />,
87 |     on("CURV") && <Route key="curv" path="curve" element={<EconCurve />} />,
88 |     on("INFL") && <Route key="infl" path="inflation" element={<EconInflation />} />,
[... omitted lines ...]
148 |         {on("VOLF") && <Route path="ml/volatility-forecaster" element={<VolatilityForecaster />} />}
149 |         {on("POLY") && <Route path="polymarket" element={<Polymarket />} />}
150 |         {on("NEWS") && <Route path="news" element={<News />} />}
151 |         {on("SENT") && <Route path="sentiment" element={<Sentiment />} />}
152 |         {on("AI") && <Route path="copilot" element={<Copilot />} />}
153 |         {on("DATAOPS") && <Route path="dataops" element={<DataOps />} />}
154 |         {on("ALRT") && <Route path="alerts" element={<Alerts />} />}
155 |
156 |         {showEcon && (
157 |           <Route
158 |             path="economics"
159 |             element={
160 |               <DrillProvider>
161 |                 <EconomicsOutlet />
162 |               </DrillProvider>
````

## src/app/sources-uses/synthetic/SyntheticShowcase.tsx

SHA-256: `03a560a92145736097db0552506e281f73801da4c77c62ea6469115010664957` (selected original lines).

````text
1 | import { useMemo, useState, type ReactNode } from "react";
2 | import { CircleAlert, Copy, MousePointerClick, RotateCcw, ShieldCheck, Sigma } from "lucide-react";
3 | import { Panel } from "@/components/ui/Panel";
4 | import {
5 |   DEFAULT_PENALTIES, FAMILY_META, NEUTRAL_KNOBS, SCENARIOS, applyKnobs, laneKey, solveSim, verifySim,
6 |   type PenaltyConfig, type SimProblem, type SolveStats, type SourceFamily, type StressKnobs,
7 | } from "@/data/sourcesUsesSynthetic";
8 | import { bps, mm, num, pct, signed } from "./format";
9 | import { CostBreakdownChart, LaneInspector, PenaltyControls } from "./PenaltyControls";
10 | import { FamilyMix, ScenarioComparison, SourceUtilization, TierLadder, UseCoverage, VerificationList } from "./ShowcaseCharts";
11 | import { TransportNetwork } from "./TransportNetwork";
12 | import { TransportTableau } from "./TransportTableau";
13 |
14 | export function SyntheticShowcase({ onCopyToWorkspace }: { onCopyToWorkspace: (problem: SimProblem, scenarioTitle: string, config: PenaltyConfig) => void }) {
15 |   const [scenarioId, setScenarioId] = useState(SCENARIOS[0].id);
16 |   const [knobs, setKnobs] = useState<StressKnobs>(NEUTRAL_KNOBS);
17 |   const [config, setConfig] = useState<PenaltyConfig>(DEFAULT_PENALTIES);
18 |   const [selectedLane, setSelectedLane] = useState<string | null>(null);
19 |   const scenario = SCENARIOS.find((s) => s.id === scenarioId)!;
20 |
21 |   const scenarioProblem = useMemo(() => scenario.build(), [scenario]);
22 |   const problem = useMemo(() => applyKnobs(scenarioProblem, knobs), [scenarioProblem, knobs]);
23 |   const result = useMemo(() => solveSim(problem, config), [problem, config]);
24 |   const checks = useMemo(() => (result.status === "optimal" ? verifySim(result) : []), [result]);
25 |   const certified = result.status === "optimal" && checks.every((c) => c.passed);
26 |
27 |   const scenarioResults = useMemo(() => Object.fromEntries(SCENARIOS.map((s) => [s.id, solveSim(s.build(), config)])), [config]);
28 |   const baseline = scenarioResults[SCENARIOS[0].id];
29 |   const knobsActive = JSON.stringify(knobs) !== JSON.stringify(NEUTRAL_KNOBS);
30 |
31 |   const selectScenario = (id: string) => { setScenarioId(id); setKnobs(NEUTRAL_KNOBS); setSelectedLane(null); };
32 |   const toggleLane = (key: string) => setKnobs((k) => ({
33 |     ...k, deniedLanes: k.deniedLanes.includes(key) ? k.deniedLanes.filter((x) => x !== key) : [...k.deniedLanes, key],
34 |   }));
35 |   const setLanePenalty = (key: string, bp: number | null) => setConfig((c) => {
36 |     const lanePenaltyOverrides = { ...c.lanePenaltyOverrides };
37 |     if (bp === null) delete lanePenaltyOverrides[key]; else lanePenaltyOverrides[key] = bp;
38 |     return { ...c, lanePenaltyOverrides };
39 |   });
40 |   const selectedBaseLane = selectedLane ? scenarioProblem.lanes.find((l) => laneKey(l.sourceId, l.useId) === selectedLane) ?? null : null;
41 |
42 |   const baseCost = baseline.status === "optimal" ? baseline.totals.totalCostMm : 0;
43 |
[... omitted lines ...]
212 |     </div>
213 |   );
214 | }
215 |
216 | function Slider({ id, label, min, max, step, value, format, onChange, swatch }: {
217 |   id: string; label: string; min: number; max: number; step: number; value: number;
218 |   format: (v: number) => string; onChange: (v: number) => void; swatch?: string;
219 | }) {
220 |   return (
221 |     <div>
222 |       <div className="mb-1 flex items-center justify-between text-[10px]">
223 |         <label htmlFor={`sxu-${id}`} className="flex items-center gap-1.5 text-term-text-dim">
224 |           {swatch && <span className="h-2 w-2 rounded-sm" style={{ background: swatch }} aria-hidden />}{label}
225 |         </label>
226 |         <span className="font-mono text-term-text">{format(value)}</span>
227 |       </div>
228 |       <input id={`sxu-${id}`} type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))}
229 |         className="h-1 w-full cursor-pointer appearance-none rounded-full bg-term-panel-3 accent-term-amber" />
230 |     </div>
231 |   );
232 | }
````

## src/app/sources-uses/page.tsx

SHA-256: `5a2fa01c217fa3bd611331c1d5c3b6280fc08e2ac4d1990e3800c4ef916cb4a1` (selected original lines).

````text
25 | function readSimPreference(): boolean {
26 |   try { return window.localStorage.getItem(SIM_PREFERENCE_KEY) !== "0"; } catch { return true; }
27 | }
28 |
29 | function initialMode(simOn: boolean): PageMode {
30 |   const hash = typeof window !== "undefined" ? window.location.hash : "";
31 |   if (hash === "#workspace" || !simOn) return "workspace";
32 |   return "synthetic";
33 | }
34 | type EditTarget = { kind: "source"; value: ConfigurableSource } | { kind: "use"; value: ConfigurableUse } | null;
35 | const tabs: { id: WorkspaceTab; label: string }[] = [
36 |   { id: "sources", label: "Sources" }, { id: "uses", label: "Uses" }, { id: "compatibility", label: "Compatibility" },
37 | ];
38 |
39 | export default function SourcesUses() {
40 |   const [configurations, setConfigurations] = useState<SourcesUsesConfiguration[]>([]);
41 |   const [activeId, setActiveId] = useState("");
42 |   const [hydrated, setHydrated] = useState(false);
43 |   const [tab, setTab] = useState<WorkspaceTab>("sources");
44 |   const [editTarget, setEditTarget] = useState<EditTarget>(null);
45 |   const [search, setSearch] = useState("");
46 |   const [selectedPair, setSelectedPair] = useState<{ sourceId: string; useId: string } | null>(null);
47 |   const [notice, setNotice] = useState<{ kind: "success" | "error"; message: string } | null>(null);
48 |   const importRef = useRef<HTMLInputElement>(null);
49 |   // Module SIM switch: on by default until the page is wired to a production model. Off hides
50 |   // all synthetic data and leaves only the user's own configurations.
51 |   const [simOn, setSimOn] = useState<boolean>(readSimPreference);
52 |   const [mode, setMode] = useState<PageMode>(() => initialMode(simOn));
53 |   const configuration = configurations.find((item) => item.id === activeId) ?? null;
54 |   const issues = useMemo(() => configuration ? validateConfiguration(configuration) : [], [configuration]);
55 |   const filteredSources = useMemo(() => configuration?.sources.filter((source) => matchesSearch(source, search)) ?? [], [configuration, search]);
56 |   const filteredUses = useMemo(() => configuration?.uses.filter((use) => matchesSearch(use, search)) ?? [], [configuration, search]);
57 |
58 |   useEffect(() => {
59 |     try {
60 |       const raw = window.localStorage.getItem(CONFIGURATION_STORAGE_KEY);
61 |       if (raw) {
62 |         const parsed: unknown = JSON.parse(raw);
63 |         if (Array.isArray(parsed)) {
64 |           const valid = parsed.filter((item) => validateConfiguration(item).length === 0) as SourcesUsesConfiguration[];
65 |           setConfigurations(valid);
66 |           setActiveId(valid[0]?.id ?? "");
67 |         }
68 |       }
69 |     } catch {
70 |       setNotice({ kind: "error", message: "Saved configurations could not be read. You can still import a file." });
71 |     }
72 |     setHydrated(true);
73 |   }, []);
74 |
75 |   useEffect(() => {
76 |     if (!hydrated) return;
77 |     try { window.localStorage.setItem(CONFIGURATION_STORAGE_KEY, JSON.stringify(configurations)); }
78 |     catch { setNotice({ kind: "error", message: "Browser storage is full. Export this configuration to keep a copy." }); }
79 |   }, [configurations, hydrated]);
80 |
81 |   function updateActive(mutator: (current: SourcesUsesConfiguration) => SourcesUsesConfiguration) {
82 |     if (!configuration) return;
83 |     setConfigurations((items) => items.map((item) => item.id === configuration.id ? touch(mutator(item)) : item));
84 |   }
85 |
86 |   function createConfiguration() {
87 |     const item = createEmptyConfiguration(`Configuration ${configurations.length + 1}`);
88 |     setConfigurations((current) => [item, ...current]);
89 |     setActiveId(item.id);
90 |     setTab("sources");
91 |     setNotice({ kind: "success", message: "New configuration created." });
[... omitted lines ...]
110 |   }
111 |
112 |   function copySyntheticToWorkspace(problem: SimProblem, scenarioTitle: string, config: PenaltyConfig) {
113 |     const item = toWorkspaceConfiguration(problem, `SIM · ${scenarioTitle}`, newId("cfg"), config);
114 |     setConfigurations((current) => [item, ...current]);
115 |     setActiveId(item.id);
116 |     setTab("sources");
117 |     switchMode("workspace");
118 |     setNotice({ kind: "success", message: `Copied “${item.name}” into the workspace as an editable configuration. It is tagged SIM.` });
119 |   }
120 |
121 |   function deleteConfiguration() {
122 |     if (!configuration || !window.confirm(`Delete “${configuration.name}”? This only removes the browser-saved copy.`)) return;
123 |     const remaining = configurations.filter((item) => item.id !== configuration.id);
124 |     setConfigurations(remaining);
[... omitted lines ...]
171 |   }
172 |
173 |   function download(filename: string, content: string, mime: string) {
174 |     if (!configuration) return;
175 |     const url = URL.createObjectURL(new Blob([content], { type: mime }));
176 |     const anchor = document.createElement("a");
177 |     anchor.href = url; anchor.download = filename; anchor.click(); URL.revokeObjectURL(url);
178 |     setNotice({ kind: "success", message: `${filename} exported.` });
179 |   }
180 |
181 |   async function importFile(event: ChangeEvent<HTMLInputElement>) {
182 |     const file = event.target.files?.[0];
183 |     if (!file) return;
184 |     try {
185 |       const text = await file.text();
186 |       const imported = file.name.toLowerCase().endsWith(".csv") ? parseConfigurationCsv(text) : parseConfigurationJson(text);
187 |       const item = { ...imported, id: newId("cfg"), name: imported.name || file.name.replace(/\.(json|csv)$/i, "") };
188 |       setConfigurations((current) => [item, ...current]);
189 |       setActiveId(item.id);
190 |       setTab("sources");
191 |       setNotice({ kind: "success", message: `Imported ${item.name} with ${item.sources.length} sources and ${item.uses.length} uses.` });
192 |     } catch (error) {
193 |       setNotice({ kind: "error", message: error instanceof Error ? error.message.split("\n")[0] : "Could not import that file." });
194 |     } finally { event.target.value = ""; }
````

## src/app/sources-uses/synthetic/TransportNetwork.tsx

SHA-256: `074b88599418d9e696e32ada307be2708736158736cee3cf7a27bad78cc9260c` (selected original lines).

````text
135 |
136 |   const shortIds = new Set(result.status === "infeasible" ? result.shortUses.map((u) => u.useId) : []);
137 |   const exhausted = new Set(result.status === "infeasible" ? result.exhaustedSources : []);
138 |
139 |   const related = (from: string, to: string) => {
140 |     if (!hover) return true;
141 |     if (hover.kind === "lane") return hover.key === `${from}>${to}`;
142 |     return hover.kind === "source" ? hover.id === from : hover.id === to;
143 |   };
144 |
145 |   const showTip = (event: React.MouseEvent | React.FocusEvent, lines: string[]) => {
146 |     const host = (event.currentTarget as Element).closest("[data-network-host]")?.getBoundingClientRect();
147 |     const rect = (event.currentTarget as Element).getBoundingClientRect();
148 |     const x = "clientX" in event ? event.clientX : rect.left + rect.width / 2;
149 |     const y = "clientY" in event ? event.clientY : rect.top;
150 |     if (host) setTip({ x: x - host.left, y: y - host.top, flip: x - host.left > host.width * 0.6, lines });
151 |   };
152 |   const clear = () => { setHover(null); setTip(null); };
153 |
154 |   const x1 = SRC_X + NODE_W;
155 |   const x2 = USE_X;
156 |   const mx = (x1 + x2) / 2;
157 |   const ribbonPath = (r: { s0: number; s1: number; u0: number; u1: number }) =>
158 |     `M${x1},${r.s0} C${mx},${r.s0} ${mx},${r.u0} ${x2},${r.u0} L${x2},${r.u1} C${mx},${r.u1} ${mx},${r.s1} ${x1},${r.s1} Z`;
159 |   const centreLine = (a: number, b: number) => `M${x1},${a} C${mx},${a} ${mx},${b} ${x2},${b}`;
160 |
161 |   const nodeEvents = (kind: "source" | "use", id: string, lines: string[]) => ({
162 |     tabIndex: 0, role: "button" as const, "aria-label": lines.join(". "), className: "cursor-pointer outline-none",
163 |     onMouseEnter: (e: React.MouseEvent) => { setHover({ kind, id }); showTip(e, lines); },
164 |     onFocus: (e: React.FocusEvent) => { setHover({ kind, id }); showTip(e, lines); },
165 |     onBlur: clear,
166 |   });
167 |
168 |   return (
169 |     <div className="relative" data-network-host onMouseLeave={clear}>
170 |       <style>{`
171 |         @keyframes sxu-flow { to { stroke-dashoffset: -28; } }
172 |         .sxu-pulse { animation: sxu-flow 1.4s linear infinite; }
173 |         @media (prefers-reduced-motion: reduce) { .sxu-pulse { animation: none; } }
174 |       `}</style>
175 |       <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Balanced transportation network of synthetic sources to uses, with dummy shortfall and idle nodes. The transportation tableau is the table equivalent.">
176 |         <defs>
177 |           <pattern id="sxu-short" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
178 |             <rect width="6" height="6" fill="#FF3B3B" opacity="0.18" />
[... omitted lines ...]
207 |           const fill = r.kind === "short" ? "url(#sxu-short)" : r.kind === "idle" ? "url(#sxu-idle)" : r.color;
208 |           return (
209 |             <g key={r.key} opacity={on ? 1 : 0.1} style={{ transition: "opacity 160ms" }}>
210 |               <path d={ribbonPath(r)} fill={fill} opacity={r.kind === "flow" ? (hover && on ? 0.62 : 0.38) : 0.9}
211 |                 onMouseEnter={(e) => { setHover({ kind: "lane", key: r.key }); showTip(e, r.lines); }}
212 |                 onMouseMove={(e) => showTip(e, r.lines)} />
213 |               {r.kind === "flow" && <path d={centreLine((r.s0 + r.s1) / 2, (r.u0 + r.u1) / 2)} fill="none" stroke={r.color} strokeWidth={Math.min(2, Math.max(1, (r.s1 - r.s0) / 6))} strokeDasharray="4 10" className="sxu-pulse pointer-events-none" opacity={0.9} />}
214 |             </g>
215 |           );
216 |         })}
````

## src/components/charting/ChartCanvas.tsx

SHA-256: `fc35146b6aaba0d0d7abee171bd1edb0aa13857a29c9ddd33efd2ef664d211d8` (selected original lines).

````text
31 |
32 | function pathWithGaps(values: (number | null)[], x: (i: number) => number, y: (v: number) => number): string {
33 |   let d = "";
34 |   let pen = false;
35 |   values.forEach((v, i) => {
36 |     if (v == null || !Number.isFinite(v)) { pen = false; return; }
37 |     d += `${pen ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)} `;
38 |     pen = true;
39 |   });
40 |   return d.trim();
41 | }
42 |
43 | function extent(arrs: (number | null)[][]): [number, number] {
44 |   const flat = arrs.flat().filter((v): v is number => v != null && Number.isFinite(v));
45 |   if (!flat.length) return [0, 1];
46 |   const lo = Math.min(...flat), hi = Math.max(...flat);
47 |   return lo === hi ? [lo - 1, hi + 1] : [lo, hi];
48 | }
49 |
50 | export const ChartCanvas = forwardRef<ChartCanvasHandle, ChartCanvasProps>(function ChartCanvas({ axis, series, candles, overlays = [], oscPanes = [], height = 300, yFmt, recessions, drawings = [], drawMode = "none", onDrawingAdd, className }, ref) {
51 |   const wrapRef = useRef<HTMLDivElement>(null);
52 |   const svgRef = useRef<SVGSVGElement>(null);
53 |   const [hover, setHover] = useState<number | null>(null);
54 |   const [drawStart, setDrawStart] = useState<{ idx: number; val: number } | null>(null);
55 |
56 |   useImperativeHandle(ref, () => ({ getSvgElement: () => svgRef.current }));
57 |
58 |   const n = axis.length;
59 |   const mainTop = 10;
60 |   const mainBot = mainTop + height;
61 |
62 |   // stack oscillator panes below the main pane
63 |   let cursor = mainBot;
64 |   const oscLayout = oscPanes.map((p) => {
65 |     const h = p.height ?? 80;
66 |     const top = cursor + 6 + 14; // gap + label row
67 |     const bot = top + h;
68 |     cursor = bot;
69 |     return { top, bot };
70 |   });
71 |   const totalH = cursor + 18; // x-axis labels
72 |
73 |   const candleVals: (number | null)[][] = candles ? [candles.map((c) => c.h), candles.map((c) => c.l)] : [];
74 |   const [min, max] = extent([...series.map((s) => s.values), ...overlays.map((s) => s.values), ...candleVals]);
75 |   const range = max - min || 1;
76 |   const hasData = n > 0 && (series.some((s) => s.values.some((v) => v != null)) || (candles?.some((c) => c.c != null) ?? false));
77 |
78 |   const x = (i: number) => padL + (i / Math.max(1, n - 1)) * (W - padL - padR);
79 |   const yMain = (v: number) => mainTop + (1 - (v - min) / range) * (mainBot - mainTop);
80 |   const yIn = (v: number, top: number, bot: number, dmin: number, dmax: number) => top + (1 - (v - dmin) / (dmax - dmin || 1)) * (bot - top);
81 |
82 |   const fmt = yFmt ?? ((v: number) => v.toFixed(2));
83 |   const gridVals = Array.from({ length: 5 }, (_, i) => min + (range * i) / 4);
84 |
85 |   // recession bands
86 |   const tAxis = axis.map((d) => Date.parse(`${d}T00:00:00Z`));
87 |   const dateToX = (iso: string): number => {
88 |     const t = Date.parse(`${iso}T00:00:00Z`);
89 |     if (!tAxis.length) return padL;
90 |     if (t <= tAxis[0]) return x(0);
91 |     if (t >= tAxis[n - 1]) return x(n - 1);
92 |     for (let i = 1; i < n; i++) if (t <= tAxis[i]) return x(i - 1 + (t - tAxis[i - 1]) / (tAxis[i] - tAxis[i - 1] || 1));
93 |     return x(n - 1);
94 |   };
95 |   const recBands = hasData && recessions ? recessions.filter((r) => Date.parse(`${r.end}T00:00:00Z`) >= tAxis[0] && Date.parse(`${r.start}T00:00:00Z`) <= tAxis[n - 1]) : [];
96 |
97 |   const cw = Math.min(9, Math.max(1, ((W - padL - padR) / Math.max(1, n)) * 0.6));
98 |   const xLabelEvery = Math.max(1, Math.ceil(n / 7));
99 |
100 |   const posFromEvent = (e: React.MouseEvent): { idx: number; val: number } | null => {
101 |     const el = wrapRef.current;
102 |     if (!el || n < 2) return null;
103 |     const rect = el.getBoundingClientRect();
104 |     const plotFrac = ((e.clientX - rect.left) / rect.width * W - padL) / (W - padL - padR);
105 |     const idx = Math.round(Math.min(1, Math.max(0, plotFrac)) * (n - 1));
106 |     const yFrac = ((e.clientY - rect.top) / rect.height * totalH - mainTop) / (mainBot - mainTop);
107 |     const val = max - yFrac * range;
108 |     return { idx, val };
109 |   };
110 |
111 |   const onMove = (e: React.MouseEvent) => {
112 |     const pos = posFromEvent(e);
113 |     if (pos) setHover(pos.idx);
114 |   };
115 |
116 |   const onClick = (e: React.MouseEvent) => {
[... omitted lines ...]
134 |   };
135 |
136 |   return (
137 |     <div ref={wrapRef} className={clsx("relative", drawMode !== "none" && "cursor-crosshair", className)} onMouseMove={onMove} onMouseLeave={() => setHover(null)} onClick={onClick}>
138 |       <svg ref={svgRef} viewBox={`0 0 ${W} ${totalH}`} preserveAspectRatio="none" style={{ width: "100%", height: totalH }}>
139 |         {/* recession shading across all panes */}
140 |         {recBands.map((r, i) => {
141 |           const x0 = dateToX(r.start), x1 = dateToX(r.end);
142 |           return <rect key={`rec-${i}`} x={x0} y={mainTop} width={Math.max(1, x1 - x0)} height={cursor - mainTop} fill="#3B9DFF" opacity={0.1} />;
143 |         })}
144 |
````

## src/components/charting/ChartStudio.tsx

SHA-256: `838518e5253df87e96f1647aad6cfca88382d236a5cb3cf6fe20c82b4f4975c0` (selected original lines).

````text
184 |   // Export PNG
185 |   const exportPNG = useCallback(() => {
186 |     const svg = canvasRef.current?.getSvgElement();
187 |     if (!svg) return;
188 |     const clone = svg.cloneNode(true) as SVGSVGElement;
189 |     clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
190 |     // set background
191 |     const bg = document.createElementNS("http://www.w3.org/2000/svg", "rect");
192 |     bg.setAttribute("width", "100%");
193 |     bg.setAttribute("height", "100%");
194 |     bg.setAttribute("fill", "#0A0A0C");
195 |     clone.insertBefore(bg, clone.firstChild);
196 |     const data = new XMLSerializer().serializeToString(clone);
197 |     const blob = new Blob([data], { type: "image/svg+xml" });
198 |     const url = URL.createObjectURL(blob);
199 |     const img = new window.Image();
200 |     img.onload = () => {
201 |       const canvas = document.createElement("canvas");
202 |       canvas.width = img.naturalWidth * 2;
203 |       canvas.height = img.naturalHeight * 2;
204 |       const ctx = canvas.getContext("2d")!;
205 |       ctx.scale(2, 2);
206 |       ctx.drawImage(img, 0, 0);
207 |       URL.revokeObjectURL(url);
208 |       canvas.toBlob((b) => {
209 |         if (!b) return;
210 |         const a = document.createElement("a");
211 |         a.href = URL.createObjectURL(b);
212 |         a.download = `${code}-chart-${new Date().toISOString().slice(0, 10)}.png`;
213 |         a.click();
214 |         URL.revokeObjectURL(a.href);
215 |       }, "image/png");
216 |     };
217 |     img.src = url;
218 |   }, [code]);
219 |
220 |   // Export CSV
221 |   const exportCSV = useCallback(() => {
222 |     if (!axis.length || !series.length) return;
223 |     const header = ["Date", ...series.map((s) => byId.get(s.ref.id)?.label ?? s.ref.id)].join(",");
224 |     const rows = axis.map((d, i) =>
225 |       [d, ...series.map((s) => s.values[i] == null ? "" : String(s.values[i]))].join(",")
226 |     );
227 |     const csv = [header, ...rows].join("\n");
228 |     const blob = new Blob([csv], { type: "text/csv" });
229 |     const a = document.createElement("a");
230 |     a.href = URL.createObjectURL(blob);
231 |     a.download = `${code}-data-${new Date().toISOString().slice(0, 10)}.csv`;
232 |     a.click();
233 |     URL.revokeObjectURL(a.href);
234 |   }, [axis, series, code, byId]);
235 |
````

## src/components/charts/Matrix.tsx

SHA-256: `cf41820deedf394db296baec45badffc7d878af8cf32e5531e7f83b34a65f260` (selected original lines).

````text
39 |             textAnchor="start"
40 |             fontSize={cell * 0.34}
41 |             fill="#9A9AA3"
42 |             fontFamily="var(--font-mono)"
43 |             transform={`rotate(-45,${cx},${cell})`}
44 |           >
45 |             {l}
46 |           </text>
47 |         );
48 |       })}
49 |       {values.map((row, i) =>
50 |         row.map((v, j) => (
51 |           <g key={`${i}-${j}`}>
52 |             <rect x={cell * 1.4 + cell * j} y={cell * 1.4 + cell * i} width={cell - 1} height={cell - 1} fill={color(v)} />
53 |             {cell > 18 && v !== null && (
54 |               <text x={cell * 1.4 + cell * j + cell / 2} y={cell * 1.4 + cell * i + cell / 2 + 3} textAnchor="middle" fontSize={cell * 0.3} fill="#E6E6E6" fontFamily="var(--font-mono)">
55 |                 {v.toFixed(2)}
56 |               </text>
57 |             )}
58 |           </g>
59 |         ))
60 |       )}
61 |     </svg>
62 |   );
63 | }
64 |
65 | /** Generic value heat grid with row/column labels. */
66 | export function HeatGrid({
[... omitted lines ...]
72 |   className,
73 | }: {
74 |   rows: string[];
75 |   cols: string[];
76 |   values: number[][];
77 |   fmt?: (n: number) => string;
78 |   height?: number;
79 |   className?: string;
80 | }) {
81 |   const max = Math.max(...values.flat().map(Math.abs), 1e-9);
82 |   return (
83 |     <div className={className} style={{ maxHeight: height, overflow: "auto" }}>
84 |       <table className="w-full border-collapse">
85 |         <thead>
86 |           <tr>
87 |             <th className="sticky left-0 z-10 bg-term-panel-2 px-2 py-1 text-left text-2xs text-term-text-mute" />
88 |             {cols.map((c) => (
89 |               <th key={c} className="px-1 py-1 text-center text-3xs font-semibold text-term-text-mute">
90 |                 {c}
91 |               </th>
92 |             ))}
93 |           </tr>
94 |         </thead>
95 |         <tbody className="tnum">
96 |           {rows.map((r, i) => (
97 |             <tr key={r}>
98 |               <td className="sticky left-0 z-10 bg-term-panel px-2 py-1 text-left text-2xs text-term-text-dim">{r}</td>
99 |               {cols.map((c, j) => {
100 |                 const v = values[i]?.[j] ?? 0;
101 |                 const t = Math.abs(v) / max;
102 |                 return (
103 |                   <td key={c} className="px-1 py-1 text-center text-3xs" style={{ background: `rgba(255,140,0,${(t * 0.6).toFixed(3)})` }}>
104 |                     {fmt ? fmt(v) : v.toFixed(0)}
105 |                   </td>
106 |                 );
107 |               })}
108 |             </tr>
109 |           ))}
110 |         </tbody>
111 |       </table>
112 |     </div>
113 |   );
114 | }
````

## src/app/knowledge-graph/TemporalView.tsx

SHA-256: `65bbb8b87c806001b5b60eff2808ff3aa2c74219e87b199cc93ed2ee24b4d596` (selected original lines).

````text
24 | export function TemporalView({ snapshot, asOf, onAsOfChange, selectedNodeId, onNodeSelect }: { snapshot: KnowledgeGraphSnapshot; asOf: KnowledgeTimepoint; onAsOfChange: (asOf: KnowledgeTimepoint) => void; selectedNodeId?: string | null; onNodeSelect?: (nodeId: string) => void }) {
25 |   const temporal = useMemo(() => buildTemporalState(snapshot, asOf), [snapshot, asOf]);
26 |   const nodes: GraphNode[] = snapshot.nodes.map((node) => ({ id: node.id, label: node.label, group: groupFor(node), size: node.kind === "AGREEMENT" ? 22 : undefined }));
27 |   const edges: GraphEdge[] = temporal.edges.filter((edge) => edge.valueUsd > 0).map((edge) => ({ source: edge.source, target: edge.target, value: edge.valueUsd }));
28 |   const activeEdges = temporal.edges.filter((edge) => edge.stressDeltaUsd !== 0);
29 |
30 |   return <div className="space-y-2">
31 |     <Panel title="Temporal graph mode" code="TEMPORAL" subtitle="effective dates / active deltas / pending clauses" resizable={false}>
32 |       <div className="space-y-3 p-3">
33 |         <div className="flex flex-wrap items-center justify-between gap-3 border border-term-amber/40 bg-term-panel-2 p-3">
34 |           <div><div className="text-xs font-semibold text-term-text">Replay the synthetic graph by effective date</div><p className="mt-1 text-2xs text-term-text-dim">The graph stays on one immutable scenario snapshot; only schedule rows and their declared edge deltas activate as their dates arrive.</p></div>
35 |           <div className="flex flex-wrap gap-1" role="group" aria-label="Temporal graph effective date"><span className="self-center px-1 text-2xs text-term-text-mute">As of</span>{KNOWLEDGE_TIMEPOINTS.map((timepoint) => <button key={timepoint} type="button" aria-pressed={asOf === timepoint} onClick={() => onAsOfChange(timepoint)} className={"border px-2 py-1 text-2xs focus:outline focus:outline-2 focus:outline-term-amber " + (asOf === timepoint ? "border-term-amber text-term-amber" : "border-term-border text-term-text-dim hover:border-term-text-mute")}>{timepoint}</button>)}</div>
36 |         </div>
37 |         <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
38 |           <Stat label="As of" value={temporal.asOf} sub="synthetic state" />
39 |           <Stat label="Visible schedules" value={temporal.metrics.visibleScheduleCount} sub="effective or unchanged" />
40 |           <Stat label="Active changes" value={temporal.metrics.activeScheduleCount} sub="changed rows" tone={temporal.metrics.activeScheduleCount ? "amber" : "neutral"} />
41 |           <Stat label="Pending changes" value={temporal.metrics.pendingScheduleCount} sub="future rows" tone={temporal.metrics.pendingScheduleCount ? "amber" : "neutral"} />
42 |           <Stat label="Paths with active components" value={temporal.metrics.activePathCount} sub={`declared ${money(temporal.metrics.declaredPathDeltaUsd)}`} tone={temporal.metrics.activePathCount ? "down" : "neutral"} />
````

## src/data/sourcesUsesSynthetic.test.ts

SHA-256: `936436a381e57b85edd278eb1238f6da00dc53c98d36ac3778a9790e131a2a1d` (selected original lines).

````text
44 | describe("SU-SIM synthetic dataset", () => {
45 |   test("is deterministic and contains no random source (SIM-AC-001)", () => {
46 |     expect(baseProblem()).toEqual(baseProblem());
47 |     const text = readFileSync(fileURLToPath(new URL("./sourcesUsesSynthetic.ts", import.meta.url)), "utf8");
48 |     expect(text).not.toMatch(/Math\.random|crypto\.|randomUUID/);
49 |   });
50 |
51 |   test("has eight sources, ten uses, three families, four tiers, single currency", () => {
52 |     const p = baseProblem();
53 |     expect(p.sources).toHaveLength(8);
54 |     expect(p.uses).toHaveLength(10);
55 |     expect(new Set(p.sources.map((s) => s.family)).size).toBe(3);
56 |     expect(new Set(p.uses.map((u) => u.tier))).toEqual(new Set([1, 2, 3, 4]));
57 |   });
58 | });
59 |
60 | describe("classic transportation core (SIM-AC-002)", () => {
61 |   test("prefers the cheap source and credits haircut-adjusted coverage", () => {
62 |     const r = feasible(tiny());
63 |     expect(flow(r, "A", "X")).toBeCloseTo(80, 6);
64 |     expect(r.idle.A).toBeCloseTo(20, 6);
65 |     expect(r.totals.totalCostMm).toBeCloseTo((80 * 10) / 10_000, 9);
66 |   });
67 |
68 |   test("a haircut forces extra nominal: 100 of B at 20% covers only 80", () => {
````

END OF ARTIFACT. Return findings in the requested format.
