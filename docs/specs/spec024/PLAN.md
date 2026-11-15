# Presidential Impact implementation plan

One terminal module provides a local data → calculation → visual/export workflow.
Its internal steps are implementation slices, not new backend platforms.

## Baseline and preservation

Inspection found active FX/provenance work in the target checkout. The isolated
worktree starts from `3c9b1423` (the current target HEAD when created). Preserve
all pre-existing modifications and untracked files, including FX research,
provenance and node adapter changes. Before applying, compare shared-file baselines
or use a context-aware patch; never overwrite an unrelated change.

No credentials, private `.data` contents or local environment files are copied.
Use existing installed dependencies, with isolated Vite/Vitest caches. No provider
or research-data connection is required or called.

## Build order

1. **Contract and independent numerical tests:** define explicit input/return units,
   rejection cases and period/availability semantics before implementation.
2. **Pure local engine:** validation, returns, decision-state classification,
   inherited joins, group statistics and consistent sensitivities.
3. **First end-to-end UI:** empty state → explicit example/import → ledger and
   full-sample comparison. Register module flag, appended nav and gated route.
4. **Research visuals:** signed category chart, two inherited-condition scatters,
   timeline, methods/source panels, separate sensitivity and author-opinion field.
5. **Research exports:** CSV, stable replay manifest, captioned SVG and PNG; tie
   display/export identity to the same analytical configuration.
6. **Review and verification:** numerical/scientific and engineering checks,
   typecheck, focused tests, app builds, browser exercise and visual inspection.
7. **Apply to target checkout:** new module/spec/guide files plus minimal shared
   route/navigation edits, preserving all unrelated work. Recheck applied contents.

The engine and UI can proceed in parallel against the explicit shared contract.
No actor may silently change units or weaken unavailable-data rules.

## Reuse decisions

- Actual React/Vite routing is authoritative; do not implement a Next.js-only page.
- Pure TypeScript is sufficient; do not start the dormant Python Market Lens service.
- Reuse terminal UI patterns; create module-specific research figures rather than
  a generic bar chart that loses negative-return sign.
- Adapt full-precision CSV and content-hash patterns without importing FX permissions
  or mutable source/provider implementations.
- Browser-local JSON intake is an explicit MVP choice. Live feeds, CSV import,
  conditional inference and prediction are follow-up work, not hidden fallbacks.

## Verification

See [acceptance criteria](SPEC.md#acceptance-criteria) and [validation record](VALIDATION.md).
Run focused tests first, then typecheck and client/server builds. Use an isolated
browser-server port so an existing user server cannot masquerade as the new build.
Inspect downloaded figure/data/manifest contents, not merely button visibility.

This implementation is research tooling. It does not validate the seed article,
establish an empirical political effect, or resume the paused AI-hype project.
