# Plan: Production Squeeze Radar

- **Spec:** [spec021-production-squeeze-radar](SPEC.md)
- **Status:** Phase 1 synthetic architecture approved in principle; generator parameters and remaining workflow/model decisions are open
- **Last updated:** 2026-10-24

## Approach

Build SQZ contract-first and synthetic-first. Phase 1 replaces the current collection of independently sampled fields with one deterministic scenario engine that generates coherent, point-in-time histories and hidden truth labels across every domain. A versioned scoring job consumes only published SIM observations and exposes signal snapshots through same-origin routes. The contracts intentionally match the future production boundary, but no vendor, live cache, or real internal book is connected in Phase 1.

```text
             Versioned synthetic scenario manifest + seed
                                |
          latent regimes, events, identities and truth ledger
                                |
       deterministic domain generators + publication schedules
                                |
             schema validation, lineage and quality faults
                                |
                  append-only SIM observations
                                      |
                    identity + normalization + quality gates
                                      |
                  point-in-time SIM histories
                                      |
                versioned features, baselines, model registry
                                      |
                        published signal snapshots
                                      |
             same-origin API + server-side policy enforcement
                                      |
       Decision Board / detail / alerts / model card / data health
```

## Phase 1 synthetic-data policy

- Use fictional issuers, securities, ETFs, clients, owners, borrowers and counterparties. Names must not be lightly disguised real firms.
- One scenario manifest owns the seed, simulated calendar, universe configuration, regimes, event schedule, source clocks, faults, and generator version.
- Domain generators share latent market, sector, issuer, borrow-demand, supply and event factors so relationships are economically coherent without being scripted to guarantee the desired score.
- The generator writes the same observation envelopes and logical datasets expected from future adapters. `sourceId` identifies a named mock source, while `dataMode` and every downstream artifact remain `SIM`.
- The truth ledger is test-only/service-side metadata. It records injected regimes, causal events and intended outcome windows, but is never exposed as a model feature.
- Random streams are named and independent by domain. Adding an optional field must not alter existing outputs for the same manifest and seed.
- Small golden fixtures support hand calculations; larger configurable universes support UI, ranking, calibration and performance tests.
- The generator must include mundane names and negative controls. A carnival where every fifth ticker squeezes is realistic only if the market is run by a screenplay writer.

### Realism and coherence requirements

| Domain | Synthetic behavior and invariants |
|---|---|
| Identity | Effective-dated fictional issuer/security/share-class/listing IDs, symbol changes, splits, mergers, spin-offs, ADR conversions and delistings |
| Equity market | Correlated market/sector/idiosyncratic returns, volume and volatility regimes, halts, float and adjustment-consistent corporate actions |
| Securities finance | `available = eligible lendable - on loan - reserved` within declared rules; utilization follows provider methodology; fees respond nonlinearly to scarcity, demand and term |
| Internal book | Loans, inventory, demand, fills/rejects, returns, recalls and rate changes reconcile by book and business time; restrictions constrain eligible quantity |
| Short positioning | Official-style reports follow settlement/publication lags; estimates may update more often with modeled error; short-sale volume remains a separate flow |
| Options and ETF | Arbitrage-consistent-enough surfaces and OI/volume, ETF holdings/weights and flow shocks tied to underlying securities without claiming executable pricing |
| Events | Earnings, offerings, index changes, expiries, recalls and regulatory-context events have publication clocks and plausible conditional effects |
| Faults | Late files, backfills, revisions, duplicates, unit inversions, stale feeds, identifier ambiguity and coverage loss are deliberately injectable |
| Outcomes | Borrow-stress transitions, squeeze-like price/volume events and re-rate outcomes include positives, near misses, false positives and censored/unactioned cases |

Realism is assessed through invariants, distributions, temporal behavior and blinded scenario review—not resemblance to a particular real security.

## Boundaries and ownership

| Component | Owns | Does not own |
|---|---|---|
| Synthetic scenario engine (Phase 1) | Manifest, seed, latent regimes, domain observations, clocks, faults and truth ledger | Scoring or UI rankings |
| Live source adapters (deferred) | Authentication, source schemas, timestamps, payload hash, retry/quarantine | Phase 1 delivery or cross-source business definitions |
| Data platform / Gold publisher | Identity, normalization, bitemporal history, quality and reconciliation | UI ranking or alert workflow |
| SQZ signal engine | Feature transforms, three signal products, reason codes, coverage, versioning | Vendor retrieval on user request |
| SQZ API | Query, pagination, authorized field projection, exports, stable errors | Scoring in the browser |
| SQZ UI | Decision workflow, visualization, evidence and limitations | Secrets, hidden joins, execution |
| Alert/case service | In-platform state transitions, assignment and audit | Recalculating historical trigger evidence or emitting external notifications |
| SLAB / upstream books | Authoritative loans, inventory, recalls, restrictions, realized rate changes | External market benchmark methodology |

Phase 1 may publish the synthetic snapshots through a local service/store, but the contract boundary must stay compatible with the intended Gold-backed architecture. If upstream Gold schemas live in another repository or service, this repository owns versioned input/output contracts and fixtures rather than writing directly to that database. No external database is required for the synthetic release.

The initial executable boundary is the normalized CSV v1 fixture pack documented in [DATA_CONTRACT.md](DATA_CONTRACT.md). The versioned generator configuration, named-stream rules, fault composition, and truth isolation are documented in [SCENARIO_MANIFEST.md](SCENARIO_MANIFEST.md); security boundaries and abuse cases are documented in [THREAT_MODEL.md](THREAT_MODEL.md). Future source adapters replace file producers, not model-facing semantics. The pack covers source inputs and truth isolation; API, feature, signal, workflow, policy, and export schemas remain follow-on contracts.

The CSV boundary is implemented by a generated JSON Schema and matching generated TypeScript record types. A server-only loader validates the manifest first, rejects non-SIM or malformed records, enforces cross-file identity and clock controls, and excludes `_truth/` from its return type and read path. The point-in-time projection selects only revisions with `first_knowable_at <= decision_at`.

## Data architecture

### Observation envelope

Every synthetic source record is wrapped before normalization. The same envelope is reserved for future live adapters:

```typescript
interface ObservationEnvelope<T> {
  observationId: string;
  sourceId: string;
  sourceRecordId?: string;
  licenseClass: string; // "SIM_UNRESTRICTED" in Phase 1
  methodologyVersion?: string;
  securityId?: string;
  effectiveAt?: string;
  publishedAt?: string;
  observedAt: string;
  ingestedAt: string;
  firstKnowableAt: string;
  businessDate?: string;
  revision: number;
  payloadHash: string;
  qualityState: "VALID" | "DEGRADED" | "QUARANTINED";
  value: T;
}
```

The clocks have different meanings and are not interchangeable. `firstKnowableAt` is mandatory and is the earliest time that exact record revision was available to this platform for the authorized purpose. It is derived per source as the latest applicable constraint among publication, receipt/ingestion, entitlement activation, and revision availability. A late file remains late, a historical backfill is not teleported into the past, and a correction creates a new revision with a new `firstKnowableAt`. Public short interest, for example, has a settlement/effective date and a later publication date. Every production feature and backtest joins on `firstKnowableAt <= decisionAt` and selects only the latest eligible revision. Sources without a publication clock derive it from their observed/received/ingested contract.

### Logical datasets

Names below are contracts, not an approval to create a particular database schema.

| Dataset | Grain | Key controls |
|---|---|---|
| `issuer_identity_history` | issuer × effective interval | Stable issuer identity and successor/predecessor lineage |
| `security_identity_history` | security/share class/listing × effective interval | Distinct stable IDs, ticker history, listing and conversion edges |
| `secfin_inventory_snapshot` | time × security × owner/book | Lendable, restricted, reserved, available; access policy |
| `secfin_loan_snapshot` | time × loan/security/book | Quantity, economics, terms, settlement state; restricted fields |
| `secfin_demand_event` | event × security × book | Request/fill/reject/return/recall/buy-in semantics |
| `secfin_market_snapshot` | time × security × provider | Provider-native supply, on-loan, utilization, fee and coverage |
| `short_interest_report` | report ID × security × source × kind × basis × methodology version × revision | Official or estimated kind, settlement/publication/knowable times and float basis; kinds cannot overwrite or fall back to one another |
| `short_sale_volume` | trade date × security × venue/source | Context-only classification and venue coverage |
| `equity_market_snapshot` | time × security | Prices, volume, float, ADV, halt state and adjustment policy |
| `options_surface_snapshot` | time × underlying × expiry/tenor | IV, skew, OI/volume and license constraints |
| `market_event` | event time × security/issuer | Type, source, publication time and revision |
| `sqz_feature_snapshot` | decision time × security × feature version | Normalized features, missingness and lineage pointers |
| `sqz_signal_snapshot` | decision time × security × product/version | Value/band, rank, reason codes, coverage and active config |
| `sqz_alert_case_projection` | authoritative case × state transition | Projection from the Phase 0-selected workflow owner; trigger evidence, actor, event/version and audit ID |
| `sqz_rerate_review` | review × candidate snapshot | Eligible loan set, proposed normalized economics, constraints, owner and aggregate version |
| `sqz_rerate_review_event` | review × event sequence | Create/disposition/outcome events, idempotency key, actor, effective rate change, retained balance and downstream correlation |
| `sqz_model_registry` | product × version | Definition, training/evaluation ranges, metrics, approval, rollback |
| `sqz_quality_issue` | issue × source/security | Rule, severity, first/last seen, quarantine and resolution |

### Reconciliation and quality gates

Publication stops per affected security/product when a hard rule fails. Rules include:

- security mapping is missing, ambiguous, outside its effective interval, or duplicates economic exposure;
- quantity, currency, rate convention, corporate-action adjustment, or unit is absent or invalid;
- utilization is outside the provider's valid bounds or cannot reconcile to on-loan/lendable within tolerance;
- internal available exceeds eligible lendable or loan/inventory totals break approved reconciliations;
- required observation exceeds its source-specific freshness budget;
- an unexpected distribution, sign flip, unit inversion, flatline, or coverage collapse breaches a gate;
- an input is present technically but use is not authorized for the current purpose or user.

Soft failures degrade coverage and attach a reason. Hard failures suppress the product. Provider values remain separate unless an approved methodology defines a comparable cohort; naive cross-provider averaging is prohibited.

### Product dependency and projection states

Phase 1 turns this matrix into versioned scenario policy. “Missing,” “fault-injected,” and “unentitled” are treated like unavailable, never like zero.

| Product / projection | Hard feature blocks | Soft / optional blocks | Missing-block result |
|---|---|---|---|
| Market Borrow Stress | External supply/on-loan or provider utilization **and** comparable fee/availability | Public SI, cash equity, events | Any hard block missing: `UNAVAILABLE`; optional block missing: available with lower named coverage |
| Internal Borrow Stress | Eligible internal lendable/on-loan/available **and** internal demand/lifecycle | External benchmark, owner concentration | Internal hard block missing: `UNAVAILABLE`; external block missing: `DEGRADED`, never market-ranked |
| Market Squeeze Risk | Cash-equity block, approved short-position block and available Market Borrow Stress | Options, ETF, events, threshold/FTD context | Any hard block missing: `UNAVAILABLE`; optional block missing: available with explicit coverage |
| Re-rate Opportunity | Entitled eligible internal loans/inventory **and** same-currency comparable external benchmark | Demand persistence, relationship constraints | Any hard block missing or currency mismatch: `UNAVAILABLE`; soft constraint missing: `DEGRADED` and no gross dollar estimate |

The synthetic research board serves market projections first. Synthetic internal projections appear only after the generated book reconciles and the policy projection is present.

## Signal design

### 1. Borrow Stress baseline

Start with a transparent monotonic rules model, calculated within comparable universe cohorts. Candidate features:

- provider-native utilization and its 1/5/20-day change;
- current/new-loan fee level, curve, percentile, velocity and acceleration;
- lendable, on-loan and available supply changes;
- borrow requests, fill rate, rejects, returns, recalls and buy-ins;
- contributor count/coverage and internal-versus-market concentration.

The baseline publishes a 0–100 rank plus `NORMAL`, `TIGHTENING`, `SPECIAL`, or `SEVERE` policy band. Bands are configurations, not universal truths. The score is unavailable if the minimum supply/fee block is absent; attention and equity price cannot rescue it.

### 2. Squeeze Risk baseline and challenger

The first implementation is an interpretable baseline, such as monotonic logistic regression or a declared points model. Inputs may include:

- reported short interest and its age; separately identified vendor estimate if approved;
- days to cover with a declared ADV window;
- current and changing Borrow Stress;
- abnormal price/volume, realized/implied volatility, skew and open interest;
- float/liquidity, event proximity, threshold/FTD context and ETF transmission.

The output is a calibrated probability or risk band for a precisely declared price/volume event over a fixed horizon, not “probability that shorts will be forced to cover.” A more complex challenger may be evaluated offline but cannot be promoted unless it improves calibration and decision utility across out-of-time cohorts without unacceptable instability.

### 3. Re-rate Opportunity baseline

For each eligible internal loan or normalized book/security cohort:

```text
normalized market rate
- normalized internal effective rate
= indicated gross rate gap

eligible settled quantity × price × positive gap × day-count fraction
= indicated gross opportunity for the selected period

eligible settled quantity × price × positive annualized gap
= indicated annualized gross run-rate shown in V1
```

Normalization must account for rate/rebate convention, collateral, open/term status, settlement, benchmark cohort and contributor quality. V1 compares only identical currencies; a mismatch is unavailable, not FX-converted. The displayed dollar value is an **annualized gross run-rate** on current eligible settled quantity using the approved rate day-count convention—not a forecast of realized revenue. Capacity, relationship/contract restrictions, minimum spreads, owner guidelines, recall risk, and demand sustainability are shown alongside it. “Indicated” becomes “realized” only when append-only review/outcome events correlate an approved downstream effective rate change and retained balances. Rejected and unactioned candidates remain in the evaluation population to avoid selection bias.

### Coverage and explanations

Each signal includes:

- status: `AVAILABLE`, `DEGRADED`, `STALE`, `UNAVAILABLE`, or `QUARANTINED`;
- observed/decision/as-of times and oldest material input age;
- feature coverage and provider coverage separately;
- top positive and negative reason codes in user language;
- configuration, feature, and model versions;
- last-approved version when a candidate fails promotion.

“Confidence” must not be a decorative blend of missingness, model certainty, and vendor coverage. Those dimensions remain separately labeled.

## Validation design

### Outcome labels

The owner must approve exact definitions before code. The proposed framework is:

- **Borrow Stress:** entry into an approved special/HTB band, fee increase beyond a cohort-relative threshold, availability drawdown, or recall shock within 1/5 business days.
- **Squeeze Risk:** forward 1/5/10-day market- or sector-adjusted return plus abnormal volume/realized-volatility conditions. Report continuous outcomes as well as event labels.
- **Re-rate Opportunity:** approved market/internal rate improvement multiplied by retained eligible balance, plus false-opportunity and balance-loss measures.

### Evaluation protocol

- Reconstruct each decision using only the exact revisions whose `firstKnowableAt` is no later than the decision time and whose entitlements were valid for that purpose.
- Use expanding or rolling walk-forward training and validation; purge overlapping label windows and embargo adjacent observations.
- Keep delisted names, symbol changes and corporate actions; avoid survivorship and revised-data leakage.
- Freeze transformations and cohorts within each fold.
- Compare against simple baselines: last state, utilization/fee threshold, reported-SI threshold, and internal-market rate gap.
- Report calibration curves/Brier score where probabilistic, precision-recall at workload-constrained thresholds, lift, stability, turnover, alert volume, acknowledgement time, and economic outcomes with uncertainty.
- Slice by period, volatility regime, sector, market cap, liquidity, borrow class, data coverage and event proximity.
- Do not select thresholds on the same sample used for the final result.

### Promotion policy

A candidate is promoted only when it passes reproducibility, point-in-time leakage, calibration, stability, workload, fairness/coverage, security, and owner-utility gates. The registry records reviewer, evidence, activation time and rollback version. When monitoring fails, freeze new alerts and serve the last approved snapshot/model if it remains within its freshness budget; otherwise show unavailable.

## API contract

All routes are authenticated, same-origin, versioned, bounded, and policy-aware.

| Method and route | Purpose |
|---|---|
| `GET /api/securities-lending/squeeze/v1/summary` | Authorized KPIs, product coverage, source age, alert counts |
| `GET /api/securities-lending/squeeze/v1/board` | Cursor-paginated projections for one view with allow-listed filters/sorts |
| `GET /api/securities-lending/squeeze/v1/names/{securityId}` | Evidence-rich point-in-time detail and timeline |
| `GET /api/securities-lending/squeeze/v1/alerts` | Authorized projection of the Phase 0-selected workflow system |
| `POST /api/securities-lending/squeeze/v1/alerts/{id}/transitions` | Conditional adapter to the selected workflow owner; absent when SQZ is read-only |
| `POST /api/securities-lending/squeeze/v1/rerate-reviews` | Idempotent creation from a versioned candidate manifest subject to licensed value retention |
| `GET /api/securities-lending/squeeze/v1/rerate-reviews/{id}` | Authorized review, event sequence and downstream outcome correlation |
| `POST /api/securities-lending/squeeze/v1/rerate-reviews/{id}/transitions` | Idempotent, version-checked disposition/outcome event |
| `GET /api/securities-lending/squeeze/v1/model-cards/{product}` | Active and historical approved definitions and evidence |
| `GET /api/securities-lending/squeeze/v1/data-health` | Redacted source/mapping/coverage health |
| `POST /api/securities-lending/squeeze/v1/exports` | Asynchronous, licensed export of current authorized projection |
| `GET /api/securities-lending/squeeze/v1/exports/{id}` | Policy-revalidated job status, expiry and authorized download metadata |
| `POST /api/securities-lending/squeeze/v1/exports/{id}/cancel` | Cancel a pending export without revealing restricted job data |
| `GET/POST/PATCH/DELETE /api/securities-lending/squeeze/v1/saved-views` | Owner-scoped saved-view CRUD with schema versioning and policy revalidation |

List routes accept an `asOf` bounded by retention, a `view`, cursor, page size, allow-listed filters, and an allow-listed stable sort with security ID as tie-breaker. A cursor is bound to immutable snapshot ID/decision time, signal/config versions, policy-projection version, entitlement-context hash, and filter/sort hash; mismatch or expiry returns a typed restart error instead of mixing pages. Responses include `dataMode`, `decisionAt`, `publishedAt`, `sourceAges`, `signalVersions`, `coverage`, and `policyProjection`. Errors use stable codes such as `SOURCE_STALE`, `SIGNAL_UNAVAILABLE`, `NOT_ENTITLED`, `AS_OF_OUT_OF_RANGE`, `CURSOR_EXPIRED`, `VERSION_CONFLICT`, and `EXPORT_NOT_LICENSED`; they never reveal restricted field existence. These same-origin routes and internal service calls stay inside the platform boundary. No route may proxy SQZ data to an external destination.

## UI information architecture

Reuse the existing SQZ route and visual language, but replace derived demo arrays with API contracts. Desktop uses a dense virtualized table plus a resizable evidence drawer. Small screens prioritize saved queues and name detail rather than attempting to compress every column.

Cross-view rules:

- source mode, decision time, oldest required input, coverage and active model version remain visible;
- cells distinguish zero, not applicable, unavailable, stale and redacted;
- score color is never the only carrier of meaning;
- every alert/rank opens to reason codes and the trigger-time evidence;
- axes, units, benchmark cohorts and time zones are explicit;
- deep links preserve only non-sensitive view, as-of and selected security state. Restricted book filters/IDs live in owner-scoped saved views and are reauthorized on load, never serialized into URLs or unprotected local storage;
- exports mirror the authorized visible projection and carry disclosures.

## Alerts and cases

Signals create candidate events inside the platform; Phase 0 selects exactly one authoritative workflow owner. If the in-platform ALERTS service owns cases, SQZ exposes a least-privilege internal projection and delegates transitions through an internal adapter. If SQZ owns cases, ALERTS consumes its internal projection. The unchosen persistence and mutation routes do not exist. Each alert rule defines entry threshold, exit threshold/hysteresis, persistence, cooldown, severity and eligible universe; it has no external notification route. Its episode identity remains stable across rule promotions; a version-promotion event explicitly carries forward, supersedes, or closes each open episode so two cases cannot represent the same continuing condition.

Allowed transitions are append-only: `OPEN -> ACKNOWLEDGED -> IN_REVIEW -> RESOLVED`, plus `SNOOZED` with expiry and controlled reopen. Every command carries an idempotency key and expected aggregate version; accepted events receive a unique ID and monotonic sequence, while stale concurrent commands return `VERSION_CONFLICT`. The trigger evidence projection never changes when upstream data is revised; current evidence is shown separately. Alert delivery is an in-platform UI/work-queue concern; email, chat, webhook and other external notification delivery do not exist for SQZ.

## Security, privacy, and licensing

- Authenticate every request; authorize at universe, row, field, action and export layers on the server.
- Separate market-only research projections from internal desk/book projections.
- Treat borrower, counterparty, beneficial owner, positions, rates and revenue as confidential; use surrogate IDs in telemetry.
- Store vendor credentials only in managed server secrets; rotate and audit access.
- Validate request bodies and allow-list filter/sort fields; cap pages, timelines and export size.
- Encrypt restricted data in transit and at rest; define retention and deletion by source contract and policy. Immutable audit applies to metadata, hashes, decisions and tombstones—not an unconditional right to retain licensed payload values. Evidence snapshots are license-aware projections and survive expiry/revocation as permitted hashes and reason metadata, without claiming full reconstruction after value deletion.
- Record policy decision, actor, purpose, fields, query hash and export artifact hash without logging restricted values.
- Complete vendor review for caching, history, derived signals, display, governed exports and model training before ingestion is enabled. Do not implement platform screenshot-generation or external-share features; OS/browser capture is outside application control and requires endpoint/DLP policy if it must be prohibited.
- Define ingestion as the first byte or record accepted by a Market Terminal-controlled adapter or process, before parsing, validation, quarantine, diagnostics, or persistence. Enforce deny-by-default outbound network policy from that instant. Raw payloads, rejected/quarantined records, normalized observations, features, scores, cases, evidence and prompts cannot be sent to external APIs, out-of-boundary models, webhooks, notification services, analytics or telemetry. Generic operational counters may leave only if they contain no SQZ values, identifiers, dimensions or reconstructable derivatives.
- Maintain a finite, attested registry of in-boundary SQZ components and destinations. Each must use platform-controlled identity, private deny-by-default networking, governed storage/audit/retention, and no external relay; managed services and third-party model software are not implicitly internal. A third-party model runtime is allowed only when fully deployed inside the boundary with provider telemetry, callbacks, prompt logging, diagnostics, and external inference disabled.
- Treat an authenticated user's explicit platform export/download as the sole egress exception: generate and stage it inside the registered boundary, reauthorize at creation and download, project only visible fields, attach provenance/disclosures, expire the artifact and audit both operations.

## Reliability and observability

The service exposes per-source ingest delay, last success, last-good age, rejected rows, coverage and quarantine counts; mapping and reconciliation breaks; feature/signal coverage; distribution and calibration drift; in-platform alerts created/deduplicated; API latency/error/cache age; export counts; egress-denial counts; and entitlement denials. Record-level values, identifiers, economics and derived SQZ dimensions never enter external observability systems. Each production alert links to an in-platform owner and runbook.

The exact SLOs are owner decisions. The design supports separate source-cadence objectives, snapshot publication objectives, and API objectives rather than calling delayed official short interest “stale” because it is not real time.

## Rollout

1. **Generator contract:** golden manifests, clocks, invariants, fault injection and truth-ledger isolation.
2. **Synthetic research board:** market projections, point-in-time history, model cards and Data Health.
3. **Synthetic desk workflow:** reconciled internal book, re-rate candidates and reviewed outcomes, with no real action endpoints.
4. **Synthetic alerts UAT:** replayable episodes, measured workload and license-compatible evidence behavior using SIM values.
5. **Phase 1 release:** full fictional universe, disclosures, API/UI/export provenance, validation report and rollback complete.
6. **Future live readiness:** source/vendor/internal integration begins only after a separate owner approval and the production release gates in SPEC.md.
7. **Challengers:** options/ETF/network or statistical models only after additive validation; never required to keep the baseline available.

Feature flags independently control each signal product, synthetic internal fields, cases and exports. Phase 1 rejects non-SIM inputs. Future live mode requires a separate configuration and cannot mix observations with SIM in one response, case or export.

## Testing strategy

- **Contract:** JSON-schema/TypeScript parity, additive compatibility, golden point-in-time fixtures and provider methodology fixtures.
- **Generator:** fixed-seed golden manifests, named-stream independence, cross-domain accounting invariants, distribution/regime checks, fault injection, negative controls and truth-ledger non-leakage.
- **Data:** issuer/security/share-class/listing identity cases, `firstKnowableAt` joins, late ingestion, backfills, post-decision revisions, stale/out-of-order records, units, reconciliation and quarantine.
- **Signal:** hand-computable examples, monotonic expectations, missing-block gates, deterministic replay, version/rollback and mutation tests.
- **Backtest:** deliberate leakage traps, survivorship fixtures, overlap purge, baseline comparison and calibration calculations.
- **Policy/security:** row/field/action/export matrices, enumeration resistance, cache partitioning, log redaction and secret scanning.
- **API:** filter/sort allow-list, snapshot-bound cursors, saved-view policy revalidation, export lifecycle, caps, rate limits, last-good behavior and typed errors.
- **Alerts:** threshold crossing, hysteresis, persistence, dedupe, cooldown, idempotency, optimistic concurrency, rule-version carry-forward, transition authorization and license-aware evidence immutability.
- **UI:** loading/empty/stale/unavailable/redacted/error states, accessibility, keyboard table flow, responsive detail and visual regression.
- **Resilience/performance:** full approved universe, source outage, late batch, cache loss, replay, rollback, export load and recovery drill.

## Migration from the prototype

- Freeze the current SIM row as a fixture; do not evolve it into the production contract.
- Inventory every consumer of `src/data/squeeze.ts` before moving formulae. At minimum this includes the Squeeze page, utilization page/analytics, utilization PDF and sentiment/crowding data; choose and test either a frozen SIM compatibility module or an explicit contract migration for each.
- Introduce versioned production contracts and an adapter that maps SIM fixtures only in demo mode.
- Move formulae from `src/data/squeeze.ts` into tested server-side baseline packages/jobs.
- Replace direct page imports with same-origin API clients after contract fixtures exist.
- Preserve useful board/quad/sector interaction patterns, but rename ambiguous labels and add source-age/coverage states.
- Remove the old page's “production” claim only after this spec is approved; retain a supersession note for history.

## Risks and mitigations

| Risk | Mitigation |
|---|---|
| Synthetic values look plausible but are internally incoherent | One manifest, shared latent factors, reconciliation invariants and blinded scenario review |
| Models merely rediscover generator rules | Hide truth, use negative controls, vary generator families/parameters and evaluate on held-out manifests/seeds |
| Vendor fields later look comparable but use different panels/methodologies | Preserve provider-native fields; normalize only through approved cohorts and expose methodology in the future live phase |
| Backtest leakage from delayed/revised sources | Mandatory first-knowable clock, revision-aware joins and late-ingest/backfill/correction leakage fixtures |
| Attractive composite hides missing inputs | Independent products, hard feature blocks, explicit coverage and unavailable states |
| Signal creates manipulation claims | Neutral risk language, contextual disclosures, compliance review and no causal claims |
| Re-rate estimate harms balances/relationships | Human review, constraints, gross/indicated label and realized-outcome tracking |
| Confidential economics leak through filters/cache/export | Server projection, policy-partitioned cache, non-enumerating errors and export gates |
| Raw, rejected, diagnostic or derived SQZ data leaves through notifications, external APIs/models or telemetry | First-byte/record acceptance boundary, finite destination registry, deny-by-default outbound network policy, no external notification/share route, egress canary tests and user-initiated governed export as the only exception |
| Intraday promises exceed vendor/data reality | Source-specific cadences and SLOs; last-good age; no request-time fan-out |
| Alert fatigue | Persistence, hysteresis, dedupe, capacity-based thresholds and workload metrics |
| Model drift or unstable ranks | Baselines, cohort monitoring, challenger gates, version registry and rollback |

## Definition of done

Phase 1 is done only when its synthetic release gates, applicable must requirements and acceptance criteria have evidence; open generator/workflow/model decisions are resolved; the active baselines pass point-in-time and held-out-manifest validation; security and operational checks pass; users complete UAT; rollback/recovery are exercised; and every artifact remains visibly SIM. This is not approval for live production use.
