# BMRK / BRA production readiness — session brief

Date: 2026-11-10. Branch: `feat/bmrk-bra-production-readiness`.
Status: source qualification and the historical explorer are implemented. See [SOURCE_INVENTORY.md](SOURCE_INVENTORY.md) for the dated source audit and [HISTORICAL_ANALYSIS.md](HISTORICAL_ANALYSIS.md) for the delivered scope and remaining work. See [GOLD_REFRESH_REHEARSAL.md](GOLD_REFRESH_REHEARSAL.md) for the isolated refresh and current as-of controls and [DEPLOYMENT_READINESS_2026-11-11.md](DEPLOYMENT_READINESS_2026-11-11.md) for the latest read-only assessment and controlled refresh plan. See [FULL_WAREHOUSE_REHEARSAL.md](FULL_WAREHOUSE_REHEARSAL.md) for the repeatable, non-promotable full-writer rehearsal and its storage limits. See [PROVIDER_LATEST.md](PROVIDER_LATEST.md) for the separate on-demand SOFR and DGS10 FRED date check.

## Objective and scope

Make Benchmark Rates (BMRK) and Rate Analysis Hub (BRA) dependable for observed
rate levels, historical changes and descriptive regime analysis. Data integrity
and per-series dates come first; lightweight classification is optional and later.
Keep this as the session's working brief and the durable handoff for future work.

Current anchors: `src/app/economics/benchmark/page.tsx`,
`src/app/economics/rate-analysis/page.tsx`, `src/lib/useEcon.ts`,
`src/app/api/econ/benchmark/route.ts`, and `src/data/benchmarkRates.ts`.
Before this slice, both pages seeded generated histories through `buildFallbackWithAnchors`
and overwrote only available observed series. BRA also consumed fictional
inventory and assumed funding inputs. The qualified endpoint and shared page
hook now enforce the source boundary described below.

## 1. Qualify sources and dates first

- Maintain a per-series register: provider/distributor, identifier, source link,
  native/display units and conversion, frequency/calendar, first/last retained
  observation, latest provider observation when checked, and discontinued status.
- Distinguish observation/effective date, actual provider publication timestamp,
  ingestion timestamp, provider-check timestamp/status and response retrieval time.
  A date-only observation stays date-only; unavailable timestamps remain null.
  For example, `observationDate: "2026-11-09", publishedAt: null` does not imply
  publication at midnight. Use named typed fields and pure analytics functions.
- Label latest retained data separately from latest published/provider data.
  A successful database read does not prove upstream freshness. Show each series'
  date and cadence-aware freshness; disclose mixed dates and partial coverage.
- Accept observed inputs with traceable ingestion or audited repair-capture
  evidence. Do not reject a valid repair merely because it used a different
  retention path; verify its original capture and ledger. Never infer authenticity
  from a `DB` label alone. Record provenance gaps explicitly.
- BMRK/BRA must not consume SIM, mock, generated, interpolated, anchored-synthetic
  or fictional-book inputs, even when the global SIM switch is on. Do not silently
  replace unavailable series with another provider, snapshot, zero or an anchor.
  Calculated spreads/statistics are allowed when their observed inputs qualify.
- Missing, stale, discontinued, insufficient-history and connection-error states
  must be explicit per series. Keep valid independent series usable. Clear failed
  current analytics; do not promote cached history to current data after failure.
  BRA cards needing fictional inventory or unavailable actual funding inputs show
  unavailable; do not manufacture a benign composite score from default values.
- Validate dates/order/duplicates and finite values while preserving genuine zero
  and negative rates. Reconcile board values/dates with history and verify units,
  especially percent versus basis points. Document source-cadence thresholds.

## 2. Expand historical analysis

Add usable date ranges and available full-history access with bounded queries.
Show levels, calendar-lookback changes (1D/1W/1M/3M/YTD/1Y), rolling changes and
volatility, ranges, percentiles, z-scores and selected spreads/correlations.
Expose actual comparison dates, units, sample counts and coverage. Never treat
520 weekly/monthly observations as 520 trading days. Preserve gaps; use matched
dates or an explicitly disclosed bounded as-of policy for comparisons. Missing
required inputs suppress only dependent outputs. Charts, tables and exports must
agree and carry provenance. Latest-revised history is not a point-in-time archive.

## 3. Optional classification experiment

After slices 1–2 pass, define useful regime labels and a transparent rules baseline.
Evaluate one small regularized logistic classifier or shallow decision tree for
current regime/pressure classification. Forecasting is outside this branch's scope.
Use qualified observed history, chronological holdouts and training-only feature
scaling; report class balance, confusion matrix, baseline comparison and stability.
Declare model version, features, training cutoff and score time. Abstain on missing
or inadequate data; call scores model outputs, never observed rates or calibrated
probabilities without validation. Defer ML if labels or incremental value are weak.
No new service, heavy runtime dependency or production activation is preselected.

## Delivery and acceptance

Ship small slices: source inventory/contract and no-synthetic boundary → dated UI
and historical tools → optional classifier. Each slice has focused Vitest tests
beside its contract/analytics and Playwright coverage under `test/`.

Acceptance: per-series dates/latest-available status are inspectable; partial and
failed loads cannot expose generated values; mixed real/SIM responses, SIM-on mode,
missing metadata, sparse cadence, unit conversions, failed refreshes and exports
are covered; valid audited repairs remain usable; BMRK and BRA share the same
qualified inputs; optional ML cannot block access to observed history.

Implementation checks: `npm run typecheck`; `npm run build`;
`npm test -- --maxWorkers=1 --minWorkers=1`; add targeted browser cases for both
routes. See [VALIDATION.md](VALIDATION.md) for the first-slice checks and deployment limits.
Keep other modules and source data unchanged. Decide cadence thresholds, provider
latest-check mechanics and any model/dependency adoption from the source inventory.
