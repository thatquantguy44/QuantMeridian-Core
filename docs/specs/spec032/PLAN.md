# Platform performance implementation plan

Status: proposed execution outline accompanying [SPEC.md](SPEC.md); no
optimization work is complete. Follow the existing spec-local `PLAN.md` /
`TASKS.md` convention rather than creating a second project-wide task queue.

## Approach and order

Baseline → SXU control/result path → route loading → shared visuals/dense views
→ remaining measured module bottlenecks → regression gates.

The baseline must precede every optimization. Work can use a narrowed slice of
the harness first, then add flows without changing existing measurement semantics.
SXU is the first user-visible improvement. Load splitting and other work follow
the measured ranking; this order does not assert the solver is the root cause.

1. **PERF-01a/b — Reproduce and rank.** Build the production measurement runner,
   freeze fixtures/profiles and capture baseline distributions/traces. Add readiness
   marks at actual completed snapshots, not loading placeholders. Record the
   exact run command, byte accounting, service mode and artifact storage. Review
   the baseline and proposed budgets before keeping implementation experiments.
2. **PERF-02 — Improve SXU compute scheduling.** Attribute selected-book,
   verification and comparison costs. Try the smallest measured change first.
   If async execution is justified, test revision ordering, bounded scheduling,
   error/unmount cleanup and verified result parity before adoption. Keep the
   browser showcase distinct from the future production optimizer.
3. **PERF-03 — Improve loading.** Pilot one route boundary, including failed-load
   recovery and disabled-module/direct-link behavior. Audit transitive imports,
   then migrate other heavy route groups in small batches. Measure complete
   cold/warm readiness and required dependency bytes after each batch.
4. **PERF-04/05 — Improve visual interaction.** Separate static SVG geometry from
   pointer feedback where traces justify it; test full numerical inspection and
   export. Profile continuously animated/offscreen work. Start with SXU transport
   and the shared chart surface, then KGR. Preserve keyboard equivalents.
5. **PERF-06 — Improve dense views.** Measure SXU's 100 × 100 compatibility stress
   fixture. Choose a bounded rendering approach if needed, preserving whole-book
   search, validation, editing, serialization and every selected cell's identity.
6. **PERF-07a/b — Apply remaining findings.** Select at least two P2 modules from
   the inventory. Profile client/server boundaries separately; optimize only
   identified work and retain existing source, cache and permission contracts.
7. **PERF-08 — Protect and document.** Add approved CI byte/correctness checks and
   timing gates on the frozen runner. Publish summarized baseline/candidate
   evidence, keep/revert ledger, remaining gaps and rollback instructions.

## Verification per slice

Use the mandatory pinned skills for SXU work: `using-agent-skills`,
`incremental-implementation`, `test-driven-development`,
`doubt-driven-development`, `code-review-and-quality` and
`frontend-ui-engineering`. Run `npm run check:agent-skills-pin`.

For behavior changes, first write the relevant failing correctness regression;
then implement, run focused tests, typecheck/build and exercise the browser flow.
Run the same paired performance batches before and after. Keep only gains beyond
noise with unchanged correctness; log reverted experiments too. Each kept slice
must be independently reversible and reviewed before marking it complete.

Use existing tests and commands in the spec. The measurement runner must expose
a documented production command at PERF-01a; the existing development-server
Playwright command is not a performance gate. Do not invent passing results for
future scripts or mark a blocked benchmark green.

## Risks and mitigations

| Risk | Mitigation |
|---|---|
| Fast feedback masks delayed/stale results | Separate input feedback and latest verified result readiness; test revision races |
| Entry chunk shrinks but route loading gets slower | Sum all required chunks; gate cold first-use and warm route readiness |
| Memo/worker overhead exceeds saved work | Compare complete user flow with identical fixtures; revert neutral experiments |
| Windowing hides data or loses focus | Whole-data invariants, explicit offscreen navigation and full exports |
| Browser/runner variance produces flaky gates | Pin environment, retain all samples, repeat paired batches, publish variance |
| Faster caching changes source truth | Preserve freshness/keys/permissions; no cache policy change without explicit review |
| KGR changes during performance work | Record diff/fixture digests and rebaseline the same fixture on both revisions |

## Rollback

Keep optimizations in small commits with independent revert paths and correctness
fixtures. Revert a failing slice while keeping diagnostics and its experiment
record. If a worker path is adopted, its failure must show a bounded recoverable
error or use a separately verified fallback; it must never display an old solve
as current. No schema migration or production deployment is part of this draft.
