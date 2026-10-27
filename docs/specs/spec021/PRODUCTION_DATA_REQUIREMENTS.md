# Squeeze Radar production data requirements

- **Status:** future-live requirements only; no live ingestion is enabled
- **Current executable contract:** CSV v1, `data_mode=SIM` only
- **Purpose:** define the data a real-feed adapter must supply before a LIVE contract can be proposed and approved
- **Field-level source of truth for the current normalized shape:** [`contracts/squeeze_radar/v1/csv-records-1.0.schema.json`](../../../contracts/squeeze_radar/v1/csv-records-1.0.schema.json)

This document is a procurement, adapter-design, and production-readiness checklist. It does not authorize Yahoo Finance, a securities-finance vendor, an internal book, or any other live source. The current loader rejects non-SIM data by design. A future live release requires a new versioned contract, rights approval, entitlements, source-specific validation, and an isolated LIVE configuration.

## Type notation

| Type | Required representation |
|---|---|
| `string` | Non-empty UTF-8 text unless explicitly optional |
| `integer` | Base-10 whole number without separators |
| `number` | Base-10 integer or decimal using `.` |
| `boolean` | `true` or `false` |
| `date` | ISO calendar date, `YYYY-MM-DD` |
| `timestamp` | UTC ISO-8601 timestamp ending in `Z` |
| `enum<A\|B>` | One of the named case-sensitive values |
| `field?` | Optional in the normalized record; blank is not equivalent to zero |

Share and contract quantities are integers. Percentages use the human 0–100 scale. Fees and spreads use annualized basis points. Currency fields use ISO 4217 codes. Exchange identifiers must use an approved MIC or documented equivalent.

## Feed capability required by signal product

| Normalized feed | Borrow Stress | Squeeze Risk | Re-rate Opportunity | Production expectation |
|---|---:|---:|---:|---|
| Security master and corporate actions | required | required | required | Stable IDs, effective dating, float and share history |
| Market borrow benchmark | required | required | required | Lendable, on-loan, availability, utilization, fees and methodology |
| Short interest | optional | required | optional | Official publications kept distinct from estimates |
| Equity market daily | optional | required | required | Point-in-time OHLCV, adjustments, liquidity and volatility |
| Internal inventory | optional | optional | required | Owner/book-level eligible supply and restrictions |
| Internal loan book | optional | optional | required | Position, economics, collateral, term and lifecycle state |
| Internal locate/borrow events | context | context | context | Demand and fill pressure; never silently fabricated |
| Listed options analytics | context | context | context | Optional; absence degrades context rather than blocking core scores |
| ETF structure and flows | context | context | context | Required only for ETF-specific context |
| Security and issuer events | context | context | context | Published catalysts with effective and knowable clocks |
| Short-sale volume | context only | context only | not required | Never substitutes for short interest |
| Synthetic truth ledger | prohibited | prohibited | prohibited | Evaluation-only; no production counterpart |

`required` means the signal is `UNAVAILABLE` when the feed is missing or stale beyond an approved budget. `optional` and `context` do not permit zero filling; the output must carry explicit missingness and degradation state.

## Required production envelope

Every real source record must be wrapped in a versioned ingestion envelope before normalization. These fields are required for production even where the current SIM CSV stores only a subset:

| Field | Type | Requirement |
|---|---|---|
| `contract_version` | `string` | Version of the LIVE observation contract |
| `publication_id` | `string` | Immutable identifier for the normalized publication/run |
| `source_id` | `string` | Approved adapter/source identifier |
| `source_dataset_id` | `string` | Exact vendor product, file or internal system dataset |
| `source_record_id` | `string` | Stable source-native record identifier |
| `source_native_security_id` | `string` | Source identifier used before security-master mapping |
| `security_id` | `string` | Durable platform identifier; ticker is never the join key |
| `observed_at` | `timestamp` | Time the adapter observed the exact value |
| `published_at?` | `timestamp` | Time the source first distributed the value, when applicable |
| `ingested_at` | `timestamp` | Time the platform persisted this exact revision |
| `first_knowable_at` | `timestamp` | Earliest time the revision was both available and permitted for model use |
| `effective_from` | `timestamp` | Start of the value's economic validity |
| `effective_to?` | `timestamp` | Exclusive end; absent for the current value |
| `revision` | `integer` | Monotonic source-record revision beginning at 1 |
| `record_action` | `enum<UPSERT\|DELETE>` | Explicit correction/tombstone behavior |
| `quality_state` | `enum<VALID\|DEGRADED\|QUARANTINED>` | Publication eligibility determined by validation |
| `methodology_version` | `string` | Source or adapter calculation methodology |
| `license_policy_id` | `string` | Approved retention/display/derived-use/export policy |
| `entitlement_scope_id` | `string` | Audience and permitted-purpose policy evaluated at read time |
| `raw_payload_ref` | `string` | Access-controlled lineage reference, not an embedded vendor payload |
| `data_mode` | `enum<LIVE>` | LIVE records must remain isolated from SIM records end to end |

The future LIVE manifest must also record source cutoffs, calendar/session, adapter versions, contract versions, row counts, validation results, quarantine counts, and the exact model publication using the data. The SIM-only `scenario_id`, `seed`, `generator_version`, and `truth_path` fields are not a production run identity and must not be copied into a LIVE contract as camouflage.

## Normalized domain fields

The lists below are the exact reusable field shapes in CSV v1. Common production-envelope fields above must be added or mapped by a future LIVE contract. A question mark denotes a v1-optional field.

### Security master — `securities`

One row per effective-dated security identity.

| Type | Fields |
|---|---|
| `string` | `scenario_id`, `security_id`, `issuer_id?`, `listing_id?`, `ticker`, `security_name`, `sector`, `currency`, `primary_exchange`, `source_id` |
| `enum` | `asset_type` (`EQUITY\|ETF`), `quality_state` (`VALID\|DEGRADED\|QUARANTINED`), `data_mode` (`SIM` in v1) |
| `integer` | `shares_outstanding`, `float_shares`, `revision` |
| `date` | `effective_from`, `effective_to?` |
| `boolean` | `is_active` |
| `timestamp` | `published_at`, `observed_at`, `ingested_at`, `first_knowable_at` |

Production security-master coverage must include symbol changes/reuse, listings, share classes, mergers, splits, spin-offs, ADR conversions, dual listings, ETFs, delistings, float changes and mapping quarantine.

### Internal inventory — `inventory_snapshots`

One row per security × book × owner × business date.

| Type | Fields |
|---|---|
| `string` | `scenario_id`, `observation_id`, `security_id`, `book_id`, `owner_id`, `source_id` |
| `date` | `business_date` |
| `timestamp` | `observed_at`, `ingested_at`, `first_knowable_at` |
| `integer` | `gross_inventory_qty`, `restricted_qty`, `eligible_lendable_qty`, `reserved_qty`, `on_loan_qty`, `available_qty`, `revision` |
| `enum` | `quality_state` (`VALID\|DEGRADED\|QUARANTINED`), `data_mode` (`SIM` in v1) |

Required reconciliation: `eligible_lendable_qty = gross_inventory_qty - restricted_qty`; `available_qty = eligible_lendable_qty - reserved_qty - on_loan_qty`.

### Internal loan book — `loan_snapshots`

One row per loan × business date.

| Type | Fields |
|---|---|
| `string` | `scenario_id`, `observation_id`, `loan_id`, `security_id`, `book_id`, `owner_id`, `counterparty_id`, `rate_currency`, `collateral_currency`, `source_id` |
| `date` | `business_date`, `maturity_date?`, `trade_date`, `settlement_date` |
| `timestamp` | `observed_at`, `ingested_at`, `first_knowable_at` |
| `integer` | `quantity`, `revision` |
| `number` | `fee_bps` |
| `enum` | `rate_convention` (`FEE\|REBATE`), `collateral_type` (`CASH\|NON_CASH`), `term_type` (`OPEN\|TERM`), `status` (`PENDING\|SETTLED\|RETURNED\|RECALLED`), `quality_state` (`VALID\|DEGRADED\|QUARANTINED`), `data_mode` (`SIM` in v1) |

Production comparison requires compatible currency, collateral, term, rate convention, settlement state and source cohort. A fee number without these dimensions is not a comparable rate.

### Locate and borrow activity — `borrow_events`

One row per lifecycle event.

| Type | Fields |
|---|---|
| `string` | `scenario_id`, `event_id`, `security_id`, `book_id`, `event_type`, `reason_code`, `source_id` |
| `timestamp` | `event_time`, `observed_at`, `ingested_at`, `first_knowable_at` |
| `integer` | `requested_qty`, `filled_qty`, `revision` |
| `number` | `fee_bps` |
| `enum` | `quality_state` (`VALID\|DEGRADED\|QUARANTINED`), `data_mode` (`SIM` in v1) |

The LIVE contract must close `event_type` and `reason_code` vocabularies and define lifecycle correlation, cancellation and retry semantics before this feed influences a score.

### Market borrow benchmark — `market_borrow_snapshots`

One row per security × provider cohort × business date.

| Type | Fields |
|---|---|
| `string` | `scenario_id`, `observation_id`, `security_id`, `methodology_version`, `source_id` |
| `date` | `business_date` |
| `timestamp` | `observed_at`, `ingested_at`, `first_knowable_at` |
| `integer` | `lendable_qty`, `on_loan_qty`, `available_qty`, `demand_qty`, `supply_change_1d_qty`, `loan_change_1d_qty`, `contributor_count`, `revision` |
| `number` | `utilization_pct`, `current_fee_bps`, `new_loan_fee_bps` |
| `enum` | `quality_state` (`VALID\|DEGRADED\|QUARANTINED`), `data_mode` (`SIM` in v1) |

Required reconciliation: `available_qty = lendable_qty - on_loan_qty`; `utilization_pct = 100 × on_loan_qty / lendable_qty`. Provider aggregation level, contributor population, currency, fee convention and methodology must be known.

### Short interest — `short_interest`

One row per security × report × kind × revision.

| Type | Fields |
|---|---|
| `string` | `scenario_id`, `report_id`, `security_id`, `methodology_version`, `source_id` |
| `enum` | `short_interest_kind` (`OFFICIAL\|ESTIMATED`), `basis` (`FLOAT\|SHARES_OUTSTANDING`), `data_mode` (`SIM` in v1) |
| `integer` | `position_qty`, `float_shares`, `revision` |
| `number` | `short_interest_pct` |
| `date` | `settlement_date` |
| `timestamp` | `published_at`, `observed_at`, `ingested_at`, `first_knowable_at` |

Official publications, vendor estimates and daily short-sale volume must remain different datasets. Production must preserve settlement and publication lags and must never backfill a corrected report into an earlier decision time.

### Daily short-sale volume — `short_sale_volume`

One row per security × trade date × venue scope.

| Type | Fields |
|---|---|
| `string` | `scenario_id`, `observation_id`, `security_id`, `venue_scope`, `source_id` |
| `date` | `trade_date` |
| `timestamp` | `published_at`, `observed_at`, `ingested_at`, `first_knowable_at` |
| `integer` | `short_volume_qty`, `short_exempt_volume_qty`, `total_reported_volume_qty`, `revision` |
| `enum` | `data_mode` (`SIM` in v1) |

Venue coverage and reporting exclusions must be recorded. This feed is contextual transaction volume, not a short-position measure.

### Equity market daily — `equity_market_daily`

One row per security × trading date.

| Type | Fields |
|---|---|
| `string` | `scenario_id`, `observation_id`, `security_id`, `source_id` |
| `date` | `trade_date` |
| `timestamp` | `published_at`, `observed_at`, `ingested_at`, `first_knowable_at` |
| `number` | `open_price`, `high_price`, `low_price`, `close_price`, `adjusted_close_price`, `realized_vol_20d_pct`, `market_cap_usd` |
| `integer` | `volume_qty`, `adv20_qty`, `float_shares`, `revision` |
| `enum` | `halt_status` (`OPEN\|HALTED`), `quality_state` (`VALID\|DEGRADED\|QUARANTINED`), `data_mode` (`SIM` in v1) |

The provider must identify adjustment methodology, corporate-action version, trading calendar, currency, consolidated/venue coverage and correction policy. Yahoo-style best-effort prices are insufficient for a production claim unless separately approved and clearly limited to research use.

### Options analytics — `options_snapshots`

One row per underlying security × business date.

| Type | Fields |
|---|---|
| `string` | `scenario_id`, `observation_id`, `security_id`, `source_id` |
| `date` | `business_date` |
| `timestamp` | `observed_at`, `ingested_at`, `first_knowable_at` |
| `integer` | `put_volume_qty`, `call_volume_qty`, `total_open_interest_qty`, `revision` |
| `number` | `put_call_ratio`, `open_interest_change_5d_pct`, `iv30_pct`, `iv_rank_1y_pct`, `skew_25d_vol_points` |
| `enum` | `quality_state` (`VALID\|DEGRADED\|QUARANTINED`), `data_mode` (`SIM` in v1) |

Production methodology must define contract universe, adjusted contracts, expiration filtering, delta convention, interpolation, snapshot time and stale-market handling.

### ETF structure and flow — `etf_snapshots`

One row per ETF × business date.

| Type | Fields |
|---|---|
| `string` | `scenario_id`, `observation_id`, `security_id`, `source_id` |
| `date` | `business_date` |
| `timestamp` | `observed_at`, `ingested_at`, `first_knowable_at` |
| `number` | `aum_usd`, `net_flow_1d_usd`, `net_flow_5d_usd`, `flow_pct_aum`, `estimated_discount_bps` |
| `integer` | `holdings_count`, `revision` |
| `enum` | `quality_state` (`VALID\|DEGRADED\|QUARANTINED`), `data_mode` (`SIM` in v1) |

The provider must define creation/redemption estimation, NAV timing, holdings effective date, currency conversion and whether a value is reported or inferred.

### Security and issuer events — `security_events`

One row per published event.

| Type | Fields |
|---|---|
| `string` | `scenario_id`, `event_id`, `security_id`, `issuer_id?`, `event_type`, `description`, `source_id` |
| `timestamp` | `event_time`, `published_at`, `observed_at`, `ingested_at`, `first_knowable_at` |
| `integer` | `revision` |
| `enum` | `event_importance` (`LOW\|MEDIUM\|HIGH`), `data_mode` (`SIM` in v1) |

The LIVE contract must close the event taxonomy, distinguish announcement from effective time, link superseded/cancelled events and preserve source language separately from platform summaries.

## Production blockers not represented completely in CSV v1

The following capabilities require an approved LIVE contract revision; they must not be hidden in free-text fields:

| Gap | Required production addition |
|---|---|
| Corporate actions | Event-specific split, merger, spin-off, symbol change, delisting, share-class and identifier lineage |
| Corrections and deletions | `record_action`, superseded-record reference, tombstone reason and source revision |
| Rights and entitlements | License policy, permitted purposes, retention, display, derived-use and governed user-download/export controls; no external service transmission or platform screenshot/share feature |
| Source lineage | Source-native dataset/record/security IDs and access-controlled raw payload reference |
| Feed health | Expected cadence, freshness budget, watermark, last-success time, coverage and quarantine counts |
| Trading calendars | Venue calendar, session, timezone and unexpected-closure handling |
| Intraday data | Event-time bars/quotes and sequence semantics if intraday scoring is approved |
| Fails-to-deliver and threshold status | Separate contextual dataset with settlement/publication clocks and compliance-safe interpretation |
| Recall lifecycle | Stable recall ID, owner, quantity, notice/effective/due times, status and revisions |
| Model publication lineage | Feature, signal, model and policy versions tied to exact eligible observation revisions |

## Adapter acceptance gates

A real-feed adapter is not production-ready until all of these are demonstrated with fixtures and replay evidence:

1. Exact type, unit, grain and enumeration mapping into an approved LIVE schema.
2. Stable security identity mapping without ticker joins, including corporate-action history.
3. Correct publication, observation, ingestion and first-knowable clocks under delays and corrections.
4. Revision, deletion and late/backfill behavior that cannot rewrite historical model decisions.
5. Reconciliation of quantities, utilization, availability, rates, currencies and collateral conventions.
6. Explicit missing, stale, degraded and quarantined behavior with no zero filling or cross-source substitution.
7. Legal approval for ingestion, retention, derived analytics, in-platform model use, display and governed user download/export. Approval cannot enable automated external transmission after first-byte/record acceptance. SQZ does not provide screenshot-generation or external-share features; any required restriction on OS/browser capture depends on endpoint/DLP policy outside the application.
8. Entitlement checks at storage, API, cache, UI, internal-workflow and export boundaries; external notification, webhook, external API/out-of-boundary model and payload-bearing telemetry boundaries remain prohibited. Third-party model software is permitted only when its complete runtime stays inside the attested boundary and has no external prompt, output, telemetry, diagnostic, or callback path.
9. Point-in-time reconstruction of every feature and score without access to synthetic truth data.
10. Physical and logical isolation between SIM and LIVE runs, responses, cases and exports.

Until those gates pass, Squeeze Radar remains synthetic-only regardless of whether a public endpoint can technically return a price or short-interest-looking number.

Ingestion begins when the first byte or record is accepted by a Market Terminal-controlled adapter or process, before parsing, validation, quarantine, diagnostics, or persistence. From that instant, the source's raw payload, rejected/quarantined records, normalized observations and all derived SQZ artifacts remain within the registered Market Terminal trust boundary. External hosted models, APIs, analytics, notifications and webhooks cannot receive them. The only approved outward transfer is an authorized user's explicit, audited download/export of the policy-projected result set, subject to the source's license rights; export generation and staging stay inside the boundary until download.
