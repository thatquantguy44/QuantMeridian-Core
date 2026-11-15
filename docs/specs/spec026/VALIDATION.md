# Spec026 validation

## Catalog evidence in research snapshots — 2026-11-13

Version 2 capture reads bare-ticker records from the local EcoMedallion
`meta.fred_series` table and their `meta.fred_series_manifest_map` mappings
inside the same read-only repeatable-read transaction as the retained market
observations. The observed SPY, AGG, ACWI and BIL records map to
`equity_tiingo` and carry `USD` as a local unit label. Their local update times
are captured separately for the series and mapping. These are configuration
labels, not independent provider verification, stable identifiers, trading
currency or publication timestamps. The source carries no verified stable IDs
or trading currency for these assets; both fields remain null.

Catalog evidence is included in the version 2 content hash and the per-asset
qualification report. Missing records, unsuccessful catalog reads, ambiguous
rows, invalid timestamps and source conflicts have explicit statuses; no data
or labels are synthesized or substituted. Version 1 files continue to import
without catalog evidence. Imported metadata and its source are not rechecked,
and an unkeyed digest cannot authenticate them. Current-vintage, source-rights,
calendar, point-in-time and model-binding limitations remain; model admission
is blocked. Test fixtures are fictional and do not constitute source evidence.

The production build was exercised against the local read-only warehouse for
all four assets: each catalog record and manifest mapping was reported, the
snapshot retained 253 sessions, and an offline import replayed 1,008 returns
without another snapshot request. Type checking, Gold policy checks, the full
Vitest suite (1,929 passed, one integration test skipped) and eight PORA browser
tests passed. The verification does not authenticate upstream origin or
independently verify the catalog labels.


## Source-inspection preview — 2026-11-12

The PORA terminal page starts empty and can explicitly inspect the existing VIXR
source check for SPY observed closes or its Tiingo-input-derived total-return index.
It verifies the source identity, date ordering, cutoff, coverage and ingestion/check
timestamps, shows current-vintage limitations, and exports the inspected rows and
source evidence. VIXR reconciles retained Gold values to source-labelled records
and receipt presence; the inspection is not an independent live provider check. A failed refresh or basis change clears old results. Synthetic and
unverified responses are rejected. This is source inspection only: no snapshot is
admitted to a numerical model, and no point-in-time history is claimed.

The source boundary tests cover simulated/malformed responses, future dates,
inconsistent evidence and safe CSV text. Browser tests cover explicit selection,
source evidence, export, failed refresh, simulation-on and changing basis during a
request. A read-only browser check against the local retained warehouse displayed
8,504 observations for each of the close and derived total-return bases from 1993-01-29 to 2026-11-10, source-checked
2026-11-12; no warehouse writes or fictional substitutions were used. Its VIXR
source check also requires the retained VIX evidence and fails closed if missing.

## Local calendar refresh and PORA verification — 2026-11-12

After an isolated rollback rehearsal, the authorized local PostgreSQL refresh
updated only the 62 NYSE rows and fields affected by the two catalogued closures,
including their monthly counts and adjacent-day arithmetic. A post-commit read
matched all 62 generated rows, with zero conflicting fields; an out-of-repository
backup retains the prior rows. Neither prices nor other market calendars were
updated. The EcoMedallion fix was subsequently merged in
[PR #101](https://github.com/thatquantguy44/EcoMedallion/pull/101); the
local runtime checkout was updated to merge commit `4f962c6`.

NYSE closure notices and independent Nasdaq trading notices support the two
closures and neighboring dates. A read-only PORA evidence check reconciled the
actual prior/next-day Gold observations, Silver inputs and retained Tiingo
receipts for SPY, AGG, ACWI and BIL around each closure. The production-server
browser then captured the current four-asset window, exported its snapshot,
imported it without a source request and replayed 1,008 returns. The historical
check exercised PORA's evidence verifier directly, not a historical-window UI.
The catalog remains partial; this does not independently qualify the full
calendar or admit the snapshot to a model. The local NYSE `t2_settle_date` is
mechanical calendar arithmetic, not verified settlement evidence.

## Merged local runtime verification — 2026-11-12

The existing local EcoMedallion runtime now loads from its `main` checkout at
merge commit `4f962c6`. Its 150 targeted calendar, terminal-view and local-store
tests passed. Two isolated SQLite Gold rebuilds used retained Tiingo Silver
observations read from local PostgreSQL: 24 rows for SPY, AGG, ACWI and BIL
around each closure. Both rebuilt calendars marked the closure closed and the
adjacent sessions open. The PostgreSQL backend shares the local Gold
orchestration, but **a full PostgreSQL Gold rebuild was not run** in this
verification. A separate read-only PORA check confirmed the two existing
PostgreSQL calendar closures and reconciled the surrounding retained source
records and receipts for all four ETFs. No fabricated observations were used
in these live-data checks. The catalog remains partial and model admission is
still blocked.

## Local source-evidence investigation — 2026-11-12

A dated [read-only investigation](SOURCE_EVIDENCE_2026-11-12.md) records the
local manifest's USD labels, absent matched `gold.dim_series` rows, unpopulated
Silver currency columns, retained receipt shape and provisional Tiingo rights
register. It identifies two historical exchange closures marked as business days
in the reviewed local calendar. The report surfaces these findings as historical
context, explicitly not as evidence attached to a snapshot or a live recheck.
Model admission, currency and rights remain unresolved. The current snapshot
window starts after both documented closure examples. No upstream calendar or
warehouse was changed during that original investigation; see the subsequent
local refresh above.

## Snapshot qualification report — 2026-11-12

A successfully captured or imported snapshot produces a session-only report tied to
its snapshot ID, with JSON export. Per-asset findings show the internally checked
aligned observations, return calculations and source references, plus unresolved
ticker identity, currency, rights and point-in-time membership evidence. The report
blocks model admission; source-use policy, model binding and numerical models remain
open. It also states that the warehouse calendar is not independently verified and
current-vintage data is not proof of point-in-time availability. A captured artifact
records that retained receipts were checked; an import explicitly does not recheck
origin or receipt contents. A content hash does not authenticate either artifact.
The report is explanatory, not a new admission authority or warehouse record.

Unit tests cover captured and imported reports; browser tests cover the rendered
per-asset findings, JSON export, offline import and clearing a tampered artifact.
A read-only production-server browser check captured four ETFs from the local
warehouse, confirmed the blocked report and export, then verified the imported
origin warning. Fictional observations are confined to automated test fixtures.

## Session-only research snapshot — 2026-11-12

An explicit capture rechecks the selected ETF inputs in one read-only repeatable-read
transaction and replaces the displayed comparison with the same capture. It freezes
253 session dates, asset order, close/dividend/split inputs, retained total-return
indices, per-field raw values and source row/run metadata, and SHA-256 fingerprints
of the referenced Tiingo receipt payloads. Raw receipt payloads are not exported.
The manifest records the New York as-of date, capture start/end, return formula,
warehouse calendar, current-vintage status, ticker-only identity, unknown currency
and source rights, and `NOT_ADMITTED` model status. It is held only in browser state
until the user exports JSON; no warehouse or server snapshot is written.

The snapshot ID is SHA-256 over canonical JSON v1: object keys sorted, arrays in
order and JavaScript JSON scalar encoding. Capture times are part of the content,
so separate captures have different IDs even if observations match. Local import
checks the hash, strict schema, source references and return calculations, then can
export replayed returns. A matching hash is not a signature or proof of provider
authenticity; imported files are labeled as origin and receipt contents not
rechecked, and remain unadmitted to models. An adversary can alter and rehash a
self-consistent file. The replay does not contact the warehouse or verify omitted
receipt payloads, source rights, ticker identity, currency or point-in-time status.

A read-only live browser check captured SPY, AGG, ACWI and BIL across 253 sessions
from 2025-11-07 through 2026-11-10, exported approximately 757 KB of JSON without
raw receipt payloads, imported it without a source request, and exported 1,008
replayed return rows with the imported-origin label. Tests cover tampering,
recomputed inconsistent hashes, malformed/oversized input, source mismatch and
cancellation during capture. Fictional fixtures are used only in tests.

## Multi-asset source comparison — 2026-11-12

The PORA preview accepts an explicit selection of two to four candidates from SPY,
AGG, ACWI and BIL. A bounded PostgreSQL repeatable-read, read-only transaction
selects 253 warehouse NYSE sessions ending at the earliest selected latest Gold
date on or before the New York as-of cutoff. Every selected asset must have each
session; off-calendar Gold or Tiingo records in the window fail the check. Each
Gold close, dividend and split is reconciled to the corresponding source value,
raw value, run and retained Tiingo receipt payload. Consecutive derived index
ratios are also reconciled to those inputs. The result has 252 aligned decimal
returns per asset, with per-asset latest date, future-Gold exclusion count and
latest ingestion time. No missing values, alternate source or synthetic data are
substituted. The client validates the envelope and compounded sample changes, and
selection changes or failed retries clear the comparison. The CSV carries full
return precision and source/check details.

A read-only end-to-end browser check selected all four ETFs against the local
warehouse: each produced 252 aligned returns across 253 retained NYSE sessions,
2025-11-07 through 2026-11-10, with as-of cutoff 2026-11-12. No warehouse writes
were made. Unit and browser fixtures are invented and test missing/tampered
receipts, mismatched values, dates, client contracts and stale-selection handling.
This is a current-vintage source comparison, not an admitted PORA model
snapshot, a point-in-time record, a source-rights determination, an independently
verified exchange calendar or a portfolio allocation. The approved input universe,
identity/membership policy and model binding remain open.

## Accepted package boundary and scaffold — 2026-11-01

The owner directed implementing the recommendation to keep an independently
installable Python model in this repository with a separate API service. D02
placement and the narrow Python 3.12+/FastAPI packaging/health portion of D05 are
accepted. Numerical dependencies, methods, data admission, execution policy,
production locks and first attested model binding remain open. T02 is partial.

Delivered roots: `models/portfolio_regime/` (`portfolio-regime-models`, import
`portfolio_regime_models`) and `services/portfolio_regime_api/`
(`portfolio-regime-api`, import `portfolio_regime_api`). Both use independent
setuptools/src-layout wheel projects. The model has no runtime dependencies;
the service consumes its exact distribution version and exposes health only.
The source layout does not imply approval of any numerical implementation.

Verification:

- RED: extraction/build failed before the model pyproject existed; service tests
  failed before the service package was installed.
- GREEN: the model portability unittest passed. It copies only the standalone
  project, builds offline without dependency resolution, installs the wheel in a
  fresh venv, removes copied source and imports with `python -I` from outside the
  checkout. FastAPI/service imports are unavailable in that clean environment.
- Both model/service wheels built from copied standalone projects. Copied sources
  were removed; installed model/service module paths were verified under a
  temporary service venv while running outside the checkout. Two API tests passed:
  HTTP 503 unconfigured health/no methods, and no run/capability/docs endpoints.
- Service verification reused existing framework/test dependencies via system/user
  site packages; it does not establish a fresh production dependency lock.
  Python 3.12.0, setuptools 82.0.1, wheel 0.47.0, FastAPI 0.137.2, Pydantic 2.13.4,
  httpx 0.28.1 were the observed verification environment, not newly pinned choices.
  Existing Starlette warns about httpx TestClient deprecation; tests pass.

The installed model/service versions are metadata only. No manifest digest,
model readiness, terminal route, data connector, provider call or deployment is
claimed. Native runtime schemas/resources must ship inside the model package;
transport contracts and the independent verifier remain in QuantMeridian.
Initial bindings will record the QuantMeridian commit and package subdirectory
plus reviewed source/wheel/lock/installed-content digests. Later extraction changes
artifact origin without a required Python import or HTTP-boundary rewrite.

The independent boundary review identified a D05 scope ambiguity; its blanket
unapproved-runtime language was corrected to distinguish the accepted scaffold
from numerical/production decisions. Final independent code/packaging/document
review reported no material findings and independently reproduced the extraction
test. The final model portability test and two service tests passed after rebuilding
both wheels. Ruff lint/format, spec links/TOML checks, whitespace, immutable
Agent-Skills pin and Gold policy checks passed. No terminal code changed, so
terminal builds/browser suites were not rerun for this package-only slice.

The owner selected preparation of a manual external-review prompt. The
[self-contained review packet](reviews/SCAFFOLD_EXTERNAL_REVIEW.md) includes the
approved contract, ten source/readme files with byte fingerprints, test evidence
and its limitations, and an adversarial findings format. It was prepared only;
no external review, sharing action or CLI invocation was performed. Packaging/framework choices were checked against official
[setuptools metadata](https://setuptools.pypa.io/en/latest/userguide/pyproject_config.html),
[pip wheel](https://pip.pypa.io/en/stable/cli/pip_wheel/) and
[FastAPI testing](https://fastapi.tiangolo.com/tutorial/testing/) documentation.

## Original documentation checkpoint — 2026-11-01

**Scope:** documentation only, 2026-11-01. No PORA application, schema generator,
model repository, service, dependency installation, source connection, provider
call, deployment, or approved policy was created. All implementation tasks remain
unchecked. No financial performance or point-in-time data availability is claimed.

## Evidence recorded

| Check | Result / limits |
| --- | --- |
| Next available sequence | Existing spec directories end at `spec025`; new suite uses `spec026`, leaving historical gaps alone. |
| Archive inspection | Read all twelve source cells across four notebooks directly from ZIP JSON; ignored macOS sidecars; no notebook execution or output-based conclusions. Byte fingerprints in REFERENCE_MODELS.md. |
| Repository conventions | Inspected actual package/routes, `docs/services.md`, specs015/016/024/025, collateral adapter and LP core, agent contracts/settings/worker and terminal roadmaps. Proposed module uses current React/Vite and separate model/service conventions. |
| QuantSmith inspection | Read local PM/construction/data-quality/backtest/model-risk instructions and reference numerical helpers. File fingerprints record inspection, not trust approval. No source edits or imports executed. |
| Agent-Skills integrity | `npm run check:agent-skills-pin` passed: 188 paths, 24 skills, commit prefix `f63ec56a3cc9`. Mirror unchanged. |
| QuantSmith trust check | `npm run check:quantsmith-pin` exited successfully for pin-record consistency, but explicitly reported code **and** asset drift. Strict local readiness remains blocked; no re-pin performed. |
| Official technical sources | Opened official PyPortfolioOpt, hmmlearn, scikit-learn, CVXPY, SciPy and FastAPI documentation. Direct references and limited capability summaries in REFERENCE_MODELS.md; exact package locks remain proposals. |
| Documentation structure | Passed: 15 suite documents, 68 local links/anchors, balanced fences, unique headings and 28 unique unchecked implementation task IDs. Archive/four notebook hashes match; independent diagonal unequal-budget arithmetic matches the corrected oracle. Proposed future source/test paths are text, not falsely required existing files. |
| Whitespace and scope | `git diff --check` plus new-file whitespace checks; final scope inspection preserves pre-existing `.gitignore`, MCS engine/test, `.dagster/` and `zips/` changes. |
| Application/model tests | Not run: no runtime code changed. Future test commands and acceptance criteria are documented, not counted as passing tests. |

## Independent technical review and reconciliation

Claim under review: the proposed app/model/service and research boundaries can
support the requested module without silently assuming operational or scientific
readiness. A fresh-context reviewer received the isolated architecture proposal
and repository/user contract, with an adversarial issues-only prompt.

| Finding | Classification / action |
| --- | --- |
| Stateless cancellation was underspecified. | Valid/actionable: synchronous request/child mapping, deadline/disconnect propagation, terminal-state arbitration, PID reaping, memory/thread/work caps and restart limits specified in DATA_CONTRACT/PLAN/T09. No async cancel/poll promise. |
| Causal HMM filtering alone does not eliminate leakage. | Valid/actionable: train-only scaling/features/selection/labels, dated folds, current-fit prefix initialization and future-mutation/permutation tests in regime/evaluation specs and T18/T21. |
| Economic data semantics were missing. | Valid/actionable: price/return/action/calendar/membership/cash/availability and current-vintage limitations added to data/evaluation contracts. |
| Wheel pin alone was weaker than the cited binding standard. | Valid/actionable: source/wheel/lock/installed bytes, native schemas, config/seeds/runtime hashes and tamper checks added. |
| Independent verification needed authority and tolerances. | Valid/actionable: adapter recomputation, analytic fixtures, proposed per-unit tolerances, solver/feasibility/research/deployment axes and local-solution qualification specified. Numeric policy remains open D04. |
| Existing agent worker cannot claim PORA jobs. | Valid/actionable: code inspected; ECOIQ-only claim filter documented. Explicit new dispatch/schema/module-policy and regression task T25 precedes assistance. |
| Session-only results weaken spec015 durable run expectations. | Valid/actionable: deliberate local research exception recorded as proposed D07, requiring owner acceptance; no OPT operational registration until shared contract is met. |

Two independent final reviewers examined architecture/task consistency and the
scientific contracts respectively. Their required findings were corrected:

| Final finding | Correction |
| --- | --- |
| Inverse-volatility oracle omitted equal-budget assumption. | Both reviewers identified it. PORT-AC01 now distinguishes equal budgets from `sqrt(b_i)/sigma_i` for unequal budgets, scaled to explicit risky capital. T15 includes both oracles. |
| ID tie breaks could violate state-permutation invariance. | REG-04/REG-AC02 now make tied economic labels and dependent gates unavailable; IDs order display only. |
| Later model changes could leave first binding stale. | TASKS completion bar requires repeating the reviewed revision/wheel/lock/manifest/installed-file gate, native-service conformance, tamper tests and rollback preservation before exposing every changed model capability. |

Optional cross-model review was offered per the pinned skill. No external CLI
was invoked. The scientific reviewer reported no other material findings. Any
accepted policy limitations remain explicit proposals and owner decision gates.
The focused final architecture review reported no unresolved material findings
in the three corrections.

## Review standard and handoff

Review correctness against notebook source and contracts; clarity of proposal
versus approval; architecture against actual app/service code; security of future
input/provider boundaries; performance through explicit bounded work proposals.
Documentation checks establish a coherent proposal only. Owner acceptance of
the map/decisions is still required before implementation and model deployment.

Start at [SPEC.md](SPEC.md), review [DECISIONS.md](DECISIONS.md), then use
[TASKS.md](TASKS.md). Do not start a service, create a sibling model repository,
download data or alter trust pins merely because this suite names a target path.
