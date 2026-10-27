# Spec021: Production Squeeze Radar

- **ID:** spec021-production-squeeze-radar
- **Module:** SQZ (`/securities-lending/squeeze`)
- **Status:** Phase 1 synthetic scope approved 2026-10-23; live-data production scope deferred and not approved
- **Author:** Joshua Lutkemuller, CFA
- **Approver:** Owner (Phase 1 synthetic scope only)
- **Last updated:** 2026-10-24

> This document defines WHAT and WHY. Architecture and model choices are in [PLAN.md](PLAN.md); delivery slices are in [TASKS.md](TASKS.md). No threshold, weight, vendor, or alert policy in this draft is approved merely because it is described.

## Summary

Turn the current deterministic Squeeze Radar demonstration into a governed securities-finance research and decision-workflow prototype using realistic synthetic data. Phase 1 will separate borrow stress, equity squeeze risk, and re-rate opportunity; preserve point-in-time provenance; expose uncertainty and data gaps; and support reviewed, auditable simulated action. It must never imply that synthetic results demonstrate live performance, manipulation, or a guaranteed price move.

## Problem and current state

The current page is a useful interface prototype, but `src/data/squeeze.ts` synthesizes every field from a seeded generator and the browser derives its rankings directly from those values. There is no production data contract, historical point-in-time store, server-side scoring service, entitlement model, case workflow, calibration evidence, or reconciliation to the stock-loan book. The live-data readiness assessment accordingly records SQZ as 0% live and blocked by securities-finance and short-interest feeds.

The existing feature note in `docs/features/SQUEEZE_RADAR_SPEC.md` also conflates daily short-sale volume with short interest, defines utilization incorrectly, assumes source capabilities that have not been contracted, and treats one composite score as several distinct decisions. It is retained as prototype history, not as the production contract.

## Product principles

1. **Three questions, three signals.** Borrow stress, equity squeeze risk, and re-rate opportunity have different inputs, outcomes, users, and failure costs. They are not aliases for one “heat” score.
2. **A radar, not an oracle.** Outputs are ranked, probabilistic decision support. The product must not state or imply manipulation, “naked shorting,” a certain squeeze, or a guaranteed revenue opportunity.
3. **Missing is not neutral.** Required stale, missing, unmapped, or unlicensed inputs suppress the affected signal; they are never zero-filled or silently replaced with SIM data.
4. **Point-in-time or it did not happen.** Every observation records when it first became knowable to the platform, plus effective, published, observed, and ingested time as applicable. Backtests may use only the exact revision whose `firstKnowableAt` is no later than the decision timestamp.
5. **Evidence before action.** Every rank and alert opens to inputs, transformations, source age, model version, and material limitations.
6. **Human-controlled workflow.** V1 may suggest review or re-rate consideration, but it does not execute loans, recalls, locates, trades, or fee changes.
7. **No automatic data egress.** Ingestion begins when the first byte or record is accepted by any Market Terminal-controlled adapter or process, before parsing, validation, quarantine, diagnostics, or persistence. From that instant, raw observations and all SQZ-derived data remain inside the defined Market Terminal trust boundary. The only permitted outward transfer is an authorized user's explicit download or export through the platform's governed export flow.

## Users and decisions

| User | Decision supported | Data boundary |
|---|---|---|
| Securities-finance trader | Which names need supply review, recall attention, or re-rate review? | Internal positions and approved market benchmarks |
| Desk manager | Where are revenue leakage, concentration, and service risks building? | Aggregated desk and beneficial-owner views |
| Risk / compliance | Which alerts were reviewed, on what evidence, and by whom? | Read-only cases and immutable audit history |
| Research user | Which names exhibit calibrated squeeze-risk conditions? | Market-level data only unless separately entitled |
| Data operations | Which sources, mappings, and calculations are late or broken? | Operational metadata; confidential economics redacted |

## Scope

### Approved Phase 1: realistic synthetic system

- A configurable universe of fictional US-style equities and ETFs with stable synthetic identities, sectors, floats, liquidity profiles, ticker history, and corporate actions.
- Deterministic, seeded histories for inventory, loans, availability, demand, returns, recalls, buy-ins, fee changes, restrictions, and simulated revenue outcomes.
- Synthetic market-wide lendable, on-loan, utilization, availability, fee, contributor-coverage, and flow observations with source-specific mock methodologies.
- Separate simulated official-style reported short interest, vendor-style estimated short interest, and daily short-sale volume with realistic publication lags and revisions.
- Coherent synthetic prices, volume, volatility, float, options surfaces, ETF structure/flows, events, threshold status, and fails-to-deliver context.
- Named regimes and injected scenarios with a hidden truth ledger for validation: ordinary tightening, specials transitions, supply withdrawals, recall waves, crowded shorts, squeeze-like price/volume events, false positives, re-rate opportunities, stale feeds, identifier breaks, and revisions.
- Point-in-time signal snapshots, alert/review cases, model cards, validation results, data-health controls, and SIM exports behind the intended production contracts.
- Every datum, score, chart, case, and export visibly marked `SIM`; no synthetic value may be mixed with or presented as live data.

### Deferred live-production scope

- Vendor selection, licensing, credentials, ingestion, live caches, and market-data redistribution.
- Connections to real inventory, loans, recalls, demand, fee changes, clients, counterparties, or revenue outcomes.
- Production entitlements for confidential book data. External notifications carrying SQZ data are prohibited by the approved egress policy rather than deferred.
- Any claim that Phase 1 model accuracy, alert precision, revenue, latency, or availability represents real-world performance.

### Non-goals for V1

- Automated fee changes, recalls, locates, borrow execution, equity/options trading, or portfolio construction.
- Surveillance findings, legal conclusions, or accusations of abusive/manipulative activity.
- A vendor-selection decision or assumption that any source permits storage, derived redistribution, or export.
- Global market coverage, fixed income, swaps, or synthetic prime-broker positions.
- Treating attention, social-media activity, threshold-list presence, or fails-to-deliver as proof of short positioning.
- An opaque machine-learning ranker without a baseline, calibration, reason codes, and a rollback path.
- Using real issuer, client, beneficial-owner, borrower, or counterparty names in synthetic scenarios.
- Sending raw or derived SQZ data to email, chat, webhook, external telemetry/analytics, external APIs, or any model service outside the attested platform boundary. Third-party model software may run inside that boundary only when prompts, features, outputs, telemetry, and diagnostics cannot leave it. Authorized user-initiated platform downloads and exports are the sole exception.

## Signal products

| Product | Question | Primary drivers | Outcome used for validation |
|---|---|---|---|
| **Borrow Stress** | Is borrow becoming scarce or operationally fragile? | On-loan/lendable utilization, fee level and change, availability, supply/loan flows, recalls, demand | Transition to special/HTB, fee shock, availability shock, or recall event |
| **Squeeze Risk** | Are conditions consistent with an elevated risk of a sharp covering-related move? | Lagged reported/estimated short positioning, days to cover, borrow stress, price/volume/volatility, options and catalysts | Forward abnormal return and volume/volatility event at declared 1/5/10-day horizons |
| **Re-rate Opportunity** | Is an entitled internal loan priced below a comparable executable market level? | Internal loan rate/terms, source-specific external benchmark, demand, available capacity, constraints | Subsequent realizable fee improvement and incremental revenue, net of lost balances |

Each product has its own score or probability, reason codes, coverage state, calibration report, and version. A combined decision board may display the three side by side but must not collapse them into a single authoritative number.

## Required data

Phase 1 generates every domain below from one versioned scenario manifest and labels its observations `SIM`. The table defines the future-compatible semantics, not a requirement to connect a live source now.

The executable Phase 1 field-level boundary, exact CSV headers, units, clock rules, fixture layout, and adapter checklist are defined in [DATA_CONTRACT.md](DATA_CONTRACT.md). Generator manifests, regimes, named random streams, fault composition and truth isolation are defined in [SCENARIO_MANIFEST.md](SCENARIO_MANIFEST.md); access boundaries and abuse cases are defined in [THREAT_MODEL.md](THREAT_MODEL.md). The reusable field types, required real-feed capabilities, production envelope and known gaps for a separately versioned future LIVE contract are documented in [PRODUCTION_DATA_REQUIREMENTS.md](PRODUCTION_DATA_REQUIREMENTS.md). The generated machine-readable SIM companion is `data/synthetic/squeeze_radar/v1/data_dictionary.csv`; the entire raw synthetic tree is intentionally excluded from Git.

| Domain | Minimum fields | Cadence / time semantics | Required for |
|---|---|---|---|
| Security master | Stable security and issuer IDs; ticker history; listing; asset type; sector; currency; FIGI/CUSIP/ISIN where licensed | Effective-dated; corporate-action aware | All products |
| Internal inventory | Settled and projected lendable, reserved/restricted quantity, beneficial owner, custody location | Intraday snapshots plus business-date close | Internal Borrow Stress projection, re-rate |
| Internal loans | Quantity, rate/rebate, currency, collateral/terms, counterparty class, open/term, trade and settlement timestamps | Event plus end-of-day snapshot | Re-rate, concentration |
| Internal demand and lifecycle | Locate/borrow requests, fills/rejects, returns, recalls, buy-ins, rate-change requests | Event time and business date | Borrow stress, alerts |
| External securities finance | Lendable, on loan, utilization, availability, current/new-loan fee, supply/demand flows, contributor coverage and methodology | Licensed intraday or daily snapshots | Market Borrow Stress and Squeeze Risk; re-rate benchmark |
| Reported short interest | Position, shares outstanding/float basis, settlement date, due/publication date, revision status | Official twice-monthly publications | Squeeze risk |
| Estimated short interest | Estimate, methodology/version, confidence/coverage | Vendor timestamp; never labeled official | Optional squeeze-risk feature |
| Daily short-sale volume | Short, short-exempt, and total reported volume; venue/coverage | Trade date and publication time | Context only; never a short-interest substitute |
| Cash equity | Adjusted/unadjusted OHLCV, NBBO or approved last price, ADV, market cap, float, halts, realized volatility | Intraday and daily, point-in-time | Squeeze risk, capacity |
| Options | Contract reference, volume, open interest, IV surface/skew/term structure; licensed derived exposures if used | Intraday/daily with vendor timestamp | Optional squeeze-risk context |
| ETF structure | Holdings and weights, creations/redemptions or approved flow proxy, baskets, AUM | Effective date and publication time | ETF/network view |
| Events | Earnings, corporate actions, expiries, index events, offerings, lockups, halts | Event time plus source publication time | Explanations, validation |
| Regulatory context | SRO threshold lists and SEC published fails-to-deliver | Preserve publication lag and limitations | Context and alerts only |
| Entitlements and policy | User/role, desk/book scope, field restrictions, export permission, retention | Effective-dated | Every request and export |

### Required semantic distinctions

- `utilization = on_loan / lendable` under the named provider's methodology. “Available shares / lendable” is not utilization.
- Official reported short interest is a lagged position observation. A vendor estimate is a separate field. Daily short-sale volume is transaction flow and must not update or backfill either position series.
- Days to cover records the numerator observation date and the ADV window used for the denominator.
- Internal rates and market benchmarks retain currency, rate convention, collateral assumptions, term, settlement status, and source cohort. They are not compared until normalization is valid.
- V1 re-rate comparisons are same-currency only. Cross-currency opportunities remain unavailable until point-in-time FX, reference-rate, quote-direction, and hedge-policy contracts are approved.
- A threshold-list flag or fail-to-deliver observation is contextual evidence only; neither establishes abusive short selling nor identifies the cause of a fail.

## Functional requirements

| ID | Requirement | Priority |
|---|---|---|
| SQZ-001 | Replace the ad hoc browser generator with versioned server contracts and a deterministic synthetic scenario engine; reject any non-SIM input in Phase 1. | must |
| SQZ-002 | Resolve every observation to a stable security/issuer identity and effective ticker, with corporate-action and duplicate mapping controls. | must |
| SQZ-003 | Preserve source, license class, units, methodology, effective/published/observed/ingested timestamps, quality state, and raw-record lineage for every material input. | must |
| SQZ-004 | Calculate Borrow Stress, Squeeze Risk, and Re-rate Opportunity independently, with reason codes and declared unavailable/degraded states. | must |
| SQZ-005 | Never substitute daily short-sale volume for reported or estimated short interest; show the settlement and publication lag of each short-interest observation. | must |
| SQZ-006 | Gate each signal on configurable freshness, mapping, coverage, and reconciliation checks; fail closed rather than zero-fill or silently use SIM. | must |
| SQZ-007 | Provide a filterable, sortable, paginated Decision Board with saved views and side-by-side signals, freshness, and confidence/coverage. | must |
| SQZ-008 | Provide Borrow Stress/Specials, Squeeze Risk, Re-rate, Supply & Recall, Sector/ETF Network, Events, and Alerts/Case views. | must |
| SQZ-009 | Provide a name detail timeline showing raw inputs, normalized features, score history, events, source age, explanations, and model version at each selected as-of time. | must |
| SQZ-010 | Implement stateful alerts with crossing/hysteresis, deduplication, cooldown, assignment, acknowledgement, snooze, resolution, and an immutable evidence manifest whose values obey licensed retention. | must |
| SQZ-011 | Enforce row/field/action/export entitlements on the server; redact confidential counterparty, borrower, and beneficial-owner data from unauthorized users and logs. | must |
| SQZ-012 | Version signal definitions, thresholds, universe rules, feature transforms, source mappings, and model cards; support rapid rollback. | must |
| SQZ-013 | Backtest with point-in-time inputs, delistings and corporate actions, walk-forward splits, overlap purging/embargo, regime/sector slices, and declared outcome labels. | must |
| SQZ-014 | Report precision/recall, calibration, coverage, lift over simple baselines, stability, false-alert workload, and re-rate revenue realization separately by signal product. | must |
| SQZ-015 | Expose data-health, source-latency, mapping/reconciliation, signal-coverage, in-platform alert-lifecycle, API-latency, and model-drift metrics with owner and runbook links. | must |
| SQZ-016 | Integrate read-only context with SLAB, ALERTS, DATAOPS, NEWS, and Market Lens only when they operate inside the Market Terminal trust boundary, without duplicating their systems of record. | should |
| SQZ-017 | Permit an authorized user to explicitly download or export the licensed visible result set with as-of time, source class, model version, filters, and disclosure text. This governed user action is the only approved external egress path. | should |
| SQZ-018 | Meet approved availability and latency SLOs under the licensed source cadence and show last-good snapshot age during upstream incidents. | must |
| SQZ-019 | Record every configuration promotion, alert action, export, and re-rate-review disposition in an immutable audit stream. | must |
| SQZ-020 | Keep all production vendor credentials and restricted payloads server-side; the browser communicates only with authenticated same-origin routes. | must |
| SQZ-021 | From the first byte or record accepted by a Market Terminal-controlled adapter or process, deny outbound transmission of raw, rejected, quarantined, normalized, diagnostic, or derived SQZ data to external services or destinations, including notifications, webhooks, external APIs, out-of-boundary model services, and payload-bearing telemetry. Third-party model software is permitted only when it runs entirely inside the attested boundary with external transmission disabled. Permit only authorized user-initiated downloads/exports through SQZ-017. | must |

For the approved synthetic phase, SQZ-001–015 and SQZ-017–021 apply using SIM contracts and local objectives, except the vendor-credential portion of SQZ-020. Live cross-module adapters under SQZ-016 and vendor/license acceptance under AC-014 are deferred. Deferral does not permit hard-coding synthetic shortcuts into the contracts.

## Views and submodules

1. **Decision Board** — compact triage table with the three signal products, rank change, coverage, source age, and saved filters.
2. **Borrow Stress & Specials** — scarcity, fee curve, availability, supply/loan flows, classification lifecycle, and transitions.
3. **Squeeze Risk** — calibrated risk bands, positioning age, days to cover, price/options/event context, and outcome definition.
4. **Re-rate Opportunity** — internal-versus-comparable market economics, quantity eligible, constraints, estimated annualized gross opportunity, and review status.
5. **Supply & Recall** — lendable/on-loan/available waterfall, owner concentration, recall queue, and projected settlement gaps.
6. **Name Detail** — synchronized timeline, evidence drawer, feature contributions, related ETFs/issuers, cases, and audit history.
7. **Sector / Issuer / ETF Network** — aggregation and propagation paths without implying causal certainty.
8. **Events & Catalysts** — dated corporate, options, index, and regulatory context overlaid on signal history.
9. **Alerts & Cases** — owned workflow with evidence frozen at trigger time and links to current state.
10. **Model & Backtest** — model card, definitions, versions, calibration, cohort performance, known limitations, and change log.
11. **Data Health** — source clocks, mappings, reconciliations, coverage, quarantines, and incident/runbook links.

These are tabs or child routes of SQZ in V1, not eleven top-level navigation modules.

## Acceptance criteria

- **AC-001:** With production mode selected, disconnecting a required source makes affected signals `UNAVAILABLE` or `DEGRADED`; no row receives SIM or zero-filled replacements.
- **AC-002:** Fixtures resolve stable issuer, security, share-class, and listing identities separately. A ticker change or split preserves the security lineage; mergers, spin-offs, ADR conversions, and share-class changes create the event-specific successor/conversion edges without double counting.
- **AC-003:** Official short interest, estimated short interest, and daily short-sale volume remain separate through ingestion, API, UI, export, and backtest.
- **AC-004:** Every displayed signal can be reconstructed from its versioned input snapshot within documented numeric tolerance and names its top reason codes.
- **AC-005:** A user lacking book entitlement cannot retrieve restricted fields through list, detail, filter, sort, export, logs, or error text.
- **AC-006:** Alert replay over the same event stream produces the same in-platform state transitions, does not duplicate cases/events, rejects stale concurrent transitions, carries or supersedes open episodes deterministically across rule versions, and preserves the permitted trigger-time evidence after source revisions.
- **AC-007:** Backtests exclude observations and revisions whose `firstKnowableAt` is after the decision time, including late ingestion and historical backfills, and report results by time period, sector, liquidity bucket, and regime with delisted names retained.
- **AC-008:** The Squeeze Risk model reports calibration and simple-baseline comparison; failure of a promotion gate keeps the last approved version or an interpretable baseline live.
- **AC-009:** A re-rate candidate reports comparable-rate normalization, eligible quantity, constraints, and gross estimate; it cannot be marked “realized” without an entitled reviewed outcome.
- **AC-010:** Data Health detects a stale feed, identifier break, unit inversion, impossible utilization, and internal loan/inventory reconciliation break before publication.
- **AC-011:** Board and detail APIs satisfy the approved SLO at the agreed universe size, enforce bounded pagination, and degrade with an explicit last-good as-of timestamp.
- **AC-012:** A model/config rollback changes the active version without rewriting prior snapshots, cases, exports, or audit history.
- **AC-013:** Product copy and alerts never characterize a security or actor as manipulative and state the signal limitations where decisions are made.
- **AC-014:** Licensed-data retention, expiry/tombstoning, license revocation, field display, derived-data use, and export behavior pass vendor-contract and compliance review before production enablement; immutable audit metadata never implies indefinite retention of licensed payload values.
- **AC-015:** The same scenario manifest, seed and generator version reproduce identical observations, signals and cases; adding an optional domain does not perturb existing named random streams.
- **AC-016:** Synthetic inventory, loans, availability, utilization, fee conventions, security identities, publication clocks and re-rate outcomes satisfy declared cross-domain invariants or enter quarantine.
- **AC-017:** Training/scoring code cannot access the truth ledger; held-out manifests include negative controls, near misses and false positives, and performance is labeled synthetic.
- **AC-018:** Phase 1 rejects non-SIM observations, uses no real firm identities, and marks every API response, page, chart, alert, case and export `SIM` with manifest, seed and generator version.
- **AC-019:** Egress-denial tests prove that SQZ cannot transmit raw, rejected, quarantined, normalized, diagnostic, derived, case, evidence, or prompt data to an external destination from the moment a controlled adapter or process accepts it. Authorized same-origin use and registered internal platform integrations remain available; an entitled, audited user download/export is the sole explicit exception. SQZ provides no screenshot-generation or external-share feature.

## Production release gates

These gates apply before any future live-data release. Phase 1 instead uses the synthetic release gates below.

- Owner approves scope, users, universe, and action boundaries.
- Data governance approves each source's storage, derived-use, display, export, and retention rights.
- Security approves authentication, server-side entitlements, secret handling, redaction, and audit controls.
- Data Ops signs off on point-in-time history, mappings, freshness thresholds, reconciliations, and incident runbooks.
- Model Risk or the designated reviewer approves labels, evaluation design, baselines, calibration, limits, and promotion/rollback policy.
- Desk UAT demonstrates that alerts are understandable and the false-alert workload fits the agreed operating model.
- Performance, resilience, accessibility, and disaster-recovery tests pass the approved SLOs.
- SIM/demo and production configurations are visibly and technically separated.

## Phase 1 synthetic release gates

- Every identity is fictional and every value, score, alert, export, and outcome is labeled `SIM`.
- A scenario manifest, seed, generator version, observation clocks, and truth ledger reproduce each run exactly.
- Cross-domain invariants reconcile: inventory/loans/availability, utilization, fee conventions, short-interest publication lags, price/volume adjustments, and re-rate outcomes.
- The suite includes ordinary regimes, stress events, false positives, stale/missing data, revisions, corporate actions, and identifier failures rather than only clean “interesting” cases.
- The three signal products pass hand-computable cases, point-in-time leakage tests, baseline comparisons, calibration against synthetic truth where applicable, and deterministic replay.
- UI, API, alerts, exports, model cards, and Data Health expose SIM provenance and cannot imply real-world efficacy.
- Existing utilization, PDF, and sentiment consumers retain their current behavior or migrate through tested compatibility contracts.

## Decisions required before implementation

1. **Users and authority:** Is V1 for agency-lending traders only, or also prime brokerage, risk, compliance, and research? Which roles may view client/counterparty economics or disposition a case?
2. **Universe parameters:** Approve the configurable synthetic universe sizes and distributions for price, ADV, float, sector, borrow class, ETF exposure, and history length. Live-universe selection is deferred.
3. **Sources and licenses — deferred for live phase:** Which vendors and rights apply when live work begins? Phase 1 uses no vendor data.
4. **Cadence and SLOs:** Approve simulated clock speeds, batch/intraday schedules, freshness budgets, and local performance objectives. Live SLOs remain deferred.
5. **Internal contracts — deferred for live phase:** Which real systems will eventually own inventory, loans, recalls, demand, fee changes, restrictions, and outcomes? Phase 1 uses synthetic contracts only.
6. **Signal policy:** Are V1 signal definitions rules-based baselines only, or may a challenger statistical model be promoted after validation? Who owns thresholds?
7. **Outcome policy:** Approve event labels, horizons, abnormal-return benchmark, re-rate realization definition, exact metric thresholds/sample windows, named approvers, evidence locations, and promotion gates.
8. **Workflow:** Choose one authoritative in-platform system for alerts and re-rate reviews—SQZ or ALERTS—and define adapters, acknowledgements, escalation times, concurrency, and retention. No second system of record or external notification destination may be implemented.
9. **Architecture — partially resolved:** Gold-backed historical publication and a bounded internal cache remain proposed. Browser-to-vendor fan-out and all post-ingestion external service/model transmission are prohibited; authorized user downloads/exports remain allowed.
10. **Compliance language:** Approve product name, disclosures, retention, surveillance boundary, and restrictions on FTD/threshold/social interpretations.

## Decision log

| Date | Decision | By |
|---|---|---|
| 2026-10-23 | **Phase 1 is entirely synthetic.** Build realistic, deterministic, cross-domain SIM histories and the complete research/workflow experience behind future-compatible contracts. Do not connect vendors or real internal books, do not use real firm identities, and do not claim live performance. Vendor, licensing, confidential-data entitlement, and live SLO decisions are deferred. | Owner |
| 2026-10-24 | **SQZ data cannot be automatically emitted outside the platform once a controlled adapter or process accepts its first byte or record.** This applies before parsing, validation, quarantine, diagnostics, or persistence and covers raw, rejected, normalized, derived, evidence, case, and model-prompt content. Same-origin UI/API use and registered internal Market Terminal services are permitted. Third-party model software may run inside the attested boundary only when prompts, features, outputs, telemetry, and diagnostics cannot leave it. Authorized user-initiated downloads and exports are the only approved external transfer and must be entitlement-checked and audited. External notifications, webhooks, external APIs/out-of-boundary model services, payload-bearing external telemetry, platform screenshot generation, and external-share features are prohibited. OS/browser capture cannot be reliably prevented by the application and requires endpoint/DLP policy if production policy must prohibit it. | Owner |
| 2026-10-24 | **Synthetic freshness grace periods are configurable and schedule-aware.** Daily inventory, loan, market-borrow, equity, options, and ETF snapshots remain current through the next scheduled weekday publication plus 30 minutes. Short-sale volume remains current through its next scheduled weekday publication plus two hours. These values live in versioned SIM policy rather than evaluator constants and do not approve a future LIVE calendar or vendor SLA. | Owner |
| 2026-10-24 | **Synthetic coverage is measured at an explicit dataset-specific grain.** Securities use security/listing; inventory uses book/security; loans use book/security plus source heartbeat; borrow events use book/source heartbeat; market borrow uses provider/security; short interest uses source/security; short-sale volume uses venue-scope/security; equity daily uses listing/security; options use provider/underlying; ETFs use ETF security; and security events use source heartbeat. Coverage strictly below 75% is systemic collapse; exactly 75% is not. Missing units remain missing and are never zero-filled. Expected cohort construction and atomic-versus-unaffected publication remain open. | Owner |

## References and evidence

- Current implementation: `src/data/squeeze.ts` and `src/app/securities-lending/squeeze/page.tsx`
- Internal readiness: `docs/validation/LIVE_DATA_READINESS_ASSESSMENT.md`
- Connectivity map: `docs/data/PLATFORM_DATA_CONNECTIVITY.md`
- Product roadmap: `docs/roadmaps/FUTURE_FEATURE_ROADMAP.md`
- [FINRA Short Interest Reporting](https://www.finra.org/filing-reporting/regulatory-filing-systems/short-interest) — firms report aggregate equity short positions twice monthly; the schedule distinguishes settlement, due, and publication dates.
- [FINRA Information Notice 5/10/19](https://www.finra.org/sites/default/files/2019-07/information-notice-051019.pdf) — daily short-sale volume is incomplete, unconsolidated with exchange data, and is not intended to equal short-interest position information.
- [SEC Regulation SHO overview](https://www.sec.gov/investor/pubs/regsho.htm) — threshold securities and fails-to-deliver have multiple possible causes and do not by themselves establish abusive short selling.
- [OPRA document library](https://www.opraplan.com/document-library) — authoritative plan and data-feed documentation for consolidated listed-options market data.
- [S&P Global Securities Finance](https://www.spglobal.com/market-intelligence/en/solutions/products/securities-finance) — example of a commercial source advertising supply, demand, fee, market-share, history, and intraday transaction datasets; inclusion is capability evidence, not vendor approval.
