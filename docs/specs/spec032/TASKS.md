# Platform performance tasks

Status: proposed backlog. All implementation tasks remain open. Spec creation
does not establish a runtime baseline or approve a performance result.

| Task | Deliverable / acceptance | Depends on | Verification | Likely files / scope | State |
|---|---|---|---|---|---|
| PERF-01a | Production-only runner records profiles, samples, bytes, failures and raw trace links; exact command documented | Spec review | Repeat same revision; detect missing readiness/failed trials; prove no dev server reuse | Dedicated Playwright config, `test/performance/` runner, `scripts/` summarizer; ≤5 files | Open |
| PERF-01b | Frozen fixtures, baseline per flow, ranked costs and reviewed budgets | 01a | Three paired unchanged-build batches; reconcile counts/digests and sample distributions | Fixture/helper tests and `VALIDATION.md`; ≤5 files | Open |
| PERF-02 | SXU control/verified-result path meets timing and consistency gates | 01b | Existing SXU golden/verifier tests plus rapid-edit, error/unmount and latest-revision browser tests; paired timings | `SyntheticShowcase.tsx`, measured compute boundary and focused tests; split further if >5 files | Open |
| PERF-03 | Home/SXU required bytes and route readiness meet budget; route semantics retained | 01b; schedule after 02 | Built request graph, navigation/flag/direct-link/chunk-error checks and paired cold/warm timings | `App.tsx`, route boundary/helper and tests; ≤5 per route batch | Open |
| PERF-04 | SXU transport hover/animation meets pointer/frame/resource gates | 02 | Pointer and keyboard inspection, reduced motion, hidden/offscreen cleanup and traces | `TransportNetwork.tsx`, focused browser tests and evidence; ≤4 files | Open |
| PERF-05a | Shared chart pointer/range path meets budget on both chart routes | 01b, 03 | 1k/10k fixture traces; exact tooltip, gaps, studies, drawings/export parity | `ChartCanvas.tsx`, fixture and regression tests; ≤5 files | Open |
| PERF-05b | KGR scenario/lens/date/drillthrough path meets feedback and completion budgets | 01b, 03 | Frozen KGR fixtures, latest selection, effective-date and route-exit tests; paired traces; playback cleanup only if implemented | Measured KGR view(s), tests and evidence; ≤5 files | Open |
| PERF-06 | 100 × 100 SXU workspace remains responsive with whole-book correctness | 01b | Filter/edit/focus/import/export and full validation; paired view-completion timing | SXU workspace view/helper, fixture and tests; ≤5 files | Open |
| PERF-07a | First trace-ranked P2 module improves beyond noise without regression | 01b, shared fix it consumes | Focused module correctness + both-profile trace comparison | One chosen module/helper/test slice; ≤5 files | Open |
| PERF-07b | Second trace-ranked P2 module improves beyond noise without regression | 01b, shared fix it consumes | Focused module correctness + both-profile trace comparison | One chosen module/helper/test slice; ≤5 files | Open |
| PERF-08a | Approved deterministic bytes and stable-runner timing gates run in CI | 02–07b | Positive/negative gate fixtures; missing samples/artifacts fail; full relevant suite/build | `.github/workflows/ci.yml`, runner/gate scripts/tests; ≤5 files | Open |
| PERF-08b | Full acceptance matrix, experiment ledger and rollback evidence complete | 08a | Independently review PERF-AC01–06, accessibility/resource results and known gaps | `VALIDATION.md`, spec updates and runbook; ≤4 files | Open |

If a row grows beyond one focused session or five files, split it before coding.
The listed files are candidate scope, not permission for an unrelated refactor.

## Checkpoint: baseline

- [ ] Reviewed spec, environment, workloads and proposed targets.
- [ ] Reproducible runner and baseline exist; unmeasured values remain unmeasured.
- [ ] Every chosen change points to a recorded bottleneck.

## Checkpoint: SXU and loading

- [ ] SXU scenario/verifier/SIM/workspace behavior passes unchanged.
- [ ] Cold, warm, feedback and verified-result budgets pass separately.
- [ ] Each kept experiment has review, paired evidence and a rollback.

## Checkpoint: completion

- [ ] KGR, chart routes, dense SXU workspace and two P2 modules are verified.
- [ ] No resource, accessibility, source-freshness or covered-flow regressions.
- [ ] Relevant full tests, typecheck/build, skill pin and approved CI gates pass.
- [ ] PERF-AC01–06 have linked evidence; field-validation gaps are explicit.
