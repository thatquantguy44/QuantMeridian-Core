# Squeeze Radar methodology dictionary

- **Task:** SQZ-T04
- **Semantics version:** `sqz-semantics-1.0.0`
- **Phase:** synthetic-only (`SIM`)
- **Executable vectors:** [`contracts/squeeze_radar/v1/semantic-test-vectors-1.0.json`](../../../contracts/squeeze_radar/v1/semantic-test-vectors-1.0.json)
- **Evaluator:** [`src/lib/squeezeRadar/semantics.ts`](../../../src/lib/squeezeRadar/semantics.ts)
- **Approval:** technical contract implemented; data/product-owner approval remains open

This dictionary fixes the meaning of the normalized measures before any Squeeze Radar score is implemented. It is deliberately dull. A model that cannot survive hand arithmetic should not be rescued by a gradient booster and a confident tooltip.

## Result states

| State | Meaning | Downstream behavior |
|---|---|---|
| `VALID` | Inputs are present, comparable and semantically consistent | The value may enter an approved feature |
| `UNAVAILABLE` | A required input, denominator, freshness condition or policy is absent | Publish missingness; never substitute zero |
| `INVALID` | Inputs contradict an invariant, mix incompatible conventions or misuse a measure | Quarantine the record or calculation |

No missing input is converted to zero. Zero is accepted only when it is an observed and semantically valid value.

## Synthetic source-methodology map

These are fictional Phase 1 sources, not claims about vendor coverage. `source_id` identifies the generating cohort; an explicit `methodology_version` identifies a calculation method where CSV v1 carries one.

| Dataset | SIM source | Methodology identity | Scope and allowed use |
|---|---|---|---|
| `market_borrow_snapshots.csv` | `SIM_BORROW` | Row-level `SIM_PROVIDER_V1` | Synthetic provider cohort; market utilization, availability and fee context |
| `inventory_snapshots.csv`, `loan_snapshots.csv`, `borrow_events.csv` | `SIM_INTERNAL` | Generator version plus scenario manifest; loan rows have no explicit method field | Synthetic internal book only; requires declared cohort/method metadata before rate comparison |
| `short_interest.csv` (official-style) | `SIM_SHORT_OFFICIAL` | Row-level `SIM_OFFICIAL_STYLE_V1` | Lagged fictional position publication; never relabeled as a live official report |
| `short_interest.csv` (estimated) | `SIM_SHORT_EST` | Row-level `SIM_ESTIMATE_V1` | Fictional position estimate; remains separate from official-style rows |
| `short_sale_volume.csv` | `SIM_SHORT_VOLUME` | Generator version plus scenario manifest; venue scope `SIM_CONSOLIDATED` | Fictional transaction-flow context; never a position proxy |
| `equity_market_daily.csv` | `SIM_EQUITY` | Generator version plus scenario manifest | Synthetic raw OHLC, adjusted close, volume and ADV inputs |
| `options_snapshots.csv` | `SIM_OPTIONS` | Generator version plus scenario manifest | Synthetic aggregate options context; not a contract-level surface |

The scenario manifest pins the generator and seed for all rows. A future LIVE contract must replace these generator-level method identities with source-native methodology, coverage and revision metadata; matching column names alone is not semantic equivalence.

## Quantity and utilization rules

| Rule | Inputs and units | Calculation | Invalid or unavailable conditions |
|---|---|---|---|
| `MARKET_UTILIZATION_PCT` | `on_loan_qty`, `lendable_qty` in shares | `100 × on_loan_qty / lendable_qty` | Zero lendable is unavailable when both quantities are zero; on-loan above lendable or any negative quantity is invalid |
| `MARKET_AVAILABLE_QTY` | `lendable_qty`, `on_loan_qty`, reported availability in shares | `lendable_qty - on_loan_qty` | Negative result or disagreement with reported availability is invalid |
| `INTERNAL_ELIGIBLE_QTY` | gross and restricted quantities in shares | `gross_inventory_qty - restricted_qty` | Negative result or disagreement with reported eligible quantity is invalid |
| `INTERNAL_AVAILABLE_QTY` | eligible, reserved and on-loan quantities in shares | `eligible_lendable_qty - reserved_qty - on_loan_qty` | Negative result or disagreement with reported availability is invalid |

Available divided by lendable is not utilization. Internal and provider quantities may be compared only after security identity, business date, aggregation scope and methodology are aligned.

## Fee, rebate and loan-comparison rules

| Rule | Inputs and units | Calculation | Invalid or unavailable conditions |
|---|---|---|---|
| `EQUIVALENT_FEE_BPS` | Quoted annualized bps, convention and—only for rebates—the applicable benchmark bps | `FEE`: quoted bps. `REBATE`: benchmark bps minus quoted rebate bps | A rebate without its named benchmark is unavailable; an unknown convention is invalid |
| `LOAN_RATE_COMPARABILITY` | Rate currency, collateral type, term type, rate convention, methodology, source cohort and settlement status for both observations | No arithmetic; returns comparable only when dimensions match | A dimension mismatch or unsettled loan makes the comparison unavailable; malformed dimensions remain invalid |

The current loan CSV stores `fee_bps` and `rate_convention` but does not carry a rebate benchmark. Therefore a `REBATE` row cannot be converted or compared merely because it contains a number. Future contracts must carry the benchmark identity, value, observation time and day-count/economic convention. CSV v1 also lacks an explicit rate-methodology version and comparison cohort, so cross-source rate comparison remains unavailable even when the visible numeric fields happen to match.

## Short-positioning and volume rules

| Rule | Inputs and units | Calculation | Invalid or unavailable conditions |
|---|---|---|---|
| `SHORT_INTEREST_PCT` | Position in shares, declared basis and basis quantity | `100 × position_qty / basis_qty` | Zero basis is unavailable; negative quantities or unknown basis are invalid |
| `SHORT_MEASURE_COMPATIBILITY` | Actual and requested measure kind | The kinds must be identical | Official, estimated and short-sale-volume observations cannot fill or overwrite one another |
| `SHORT_SALE_VOLUME_PCT` | Reported short volume, short-exempt volume and total reported volume in the same venue scope | `100 × short_volume_qty / total_reported_volume_qty` | Total volume zero is unavailable; short above total or short-exempt above short is invalid |
| `DAYS_TO_COVER` | Position in shares and `adv20_qty` in shares/day | `position_qty / adv20_qty` | Zero ADV is unavailable; negative inputs are invalid |

Supported short-position kinds are `OFFICIAL` and `ESTIMATED`. `SHORT_SALE_VOLUME` is transaction flow with a venue scope. Daily short-sale volume is not short interest and is not a proxy for an official or estimated position. A short-interest percentage above 100% is representable and is not rejected merely for crossing 100; identity, float, publication lag and source methodology still require validation.

FINRA defines Short Volume as aggregate volume of executed short-sale and short-sale-exempt trades; Short Exempt Volume is the exempt subset. Therefore the exempt field is validated against short volume but is not added to the numerator a second time. Coverage is limited to the named reporting facilities and must not be presented as consolidated market volume. See the [FINRA Short Sale Volume Daily Data User Guide](https://www.finra.org/sites/default/files/2020-12/short-sale-volume-user-guide.pdf).

For `basis=FLOAT`, the denominator is effective-dated `float_shares`. For `basis=SHARES_OUTSTANDING`, the denominator must come from the effective-dated security master because CSV v1 does not repeat it on the short-interest row.

## Price and adjustment rules

| Rule | Inputs and units | Calculation | Invalid or unavailable conditions |
|---|---|---|---|
| `PRICE_RETURN_PCT` | Positive start/end prices with `RAW` or `ADJUSTED` basis | `100 × (end_price / start_price - 1)` | Mixing raw and adjusted observations is invalid; a non-positive start or negative end price is invalid |

OHLC fields are raw in CSV v1. `adjusted_close_price` is the corporate-action-adjusted series. Return features must use one declared basis across the full window. Charts may show raw OHLC, but raw and adjusted values cannot be spliced into one return series.

## Options rules

| Rule | Inputs and units | Calculation | Invalid or unavailable conditions |
|---|---|---|---|
| `PUT_CALL_RATIO` | Put and call volume in contracts | `put_volume_qty / call_volume_qty` | Zero call volume is unavailable; negative volume is invalid |
| `OPEN_INTEREST_CHANGE_PCT` | Current and prior open interest in contracts | `100 × (current - prior) / prior` | Zero prior open interest is unavailable; negative quantities are invalid |
| `OPTIONS_MEASURE_VALIDITY` | `iv30_pct`, `iv_rank_1y_pct`, `skew_25d_vol_points` | Validation only | IV must be non-negative; IV rank must be within 0–100; skew may be positive or negative but must be finite |

Production options methodology must additionally name the contract universe, adjusted-contract handling, expiration filters, delta convention, interpolation, snapshot time and stale-market policy.

## Quality, clocks and publication

| Rule | Inputs | Behavior |
|---|---|---|
| `PUBLICATION_ELIGIBILITY` | `quality_state`, freshness result, required/optional role and explicit degraded-data policy | `QUARANTINED` is invalid. Stale data is unavailable. `DEGRADED` is unavailable unless an approved policy explicitly permits it. |

All feature calculations use only revisions satisfying `first_knowable_at <= decision_at`. The selected revision is the latest eligible revision of the same logical record, not simply the row with the latest business or settlement date. Publication, observation and ingestion timestamps may push `first_knowable_at` later; none may be used to backdate a correction.

## Vector maintenance

Every rule above has at least one machine-readable valid case and one boundary or rejection case where applicable. A semantics change requires all of the following in the same review:

1. Update this dictionary and explain the economic convention.
2. Add or revise a golden vector.
3. Update the evaluator and run the focused semantic test.
4. Assess whether the CSV/JSON schema needs a new contract version.
5. Obtain data/product-owner approval before model behavior depends on the change.

The vectors prove arithmetic and classification semantics. They do not validate a vendor methodology, authorize a source, set a model threshold or demonstrate live predictive performance.
