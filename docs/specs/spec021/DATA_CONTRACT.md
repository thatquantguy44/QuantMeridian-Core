# Squeeze Radar CSV data contract v1

- **Current contract version:** `1.1` (`1.0` retained for explicit loader compatibility)
- **Phase:** synthetic-only (`data_mode=SIM`)
- **Fixture bundle:** generated locally at `data/synthetic/squeeze_radar/v1/`
- **Bundle guide:** [`contracts/squeeze_radar/v1/README.md`](../../../contracts/squeeze_radar/v1/README.md)
- **Machine-readable field catalog:** generated as `data/synthetic/squeeze_radar/v1/data_dictionary.csv`
- **Generator:** [`scripts/generate-squeeze-radar-csv.mjs`](../../../scripts/generate-squeeze-radar-csv.mjs)
- **JSON Schemas:** current [`csv-records-1.1.schema.json`](../../../contracts/squeeze_radar/v1/csv-records-1.1.schema.json); retained [`csv-records-1.0.schema.json`](../../../contracts/squeeze_radar/v1/csv-records-1.0.schema.json)
- **Scenario contract:** [`SCENARIO_MANIFEST.md`](SCENARIO_MANIFEST.md) and [`scenario-manifest-1.0.schema.json`](../../../contracts/squeeze_radar/v1/scenario-manifest-1.0.schema.json)
- **TypeScript contracts:** [`src/lib/squeezeRadar/contracts.ts`](../../../src/lib/squeezeRadar/contracts.ts) and generated record types
- **Server loader:** [`src/lib/server/squeezeRadar/loadCsvBundle.ts`](../../../src/lib/server/squeezeRadar/loadCsvBundle.ts)
- **Point-in-time selection:** [`src/lib/squeezeRadar/pointInTime.ts`](../../../src/lib/squeezeRadar/pointInTime.ts)
- **SIM publication and last-good behavior:** [`SIM_PUBLICATION.md`](SIM_PUBLICATION.md)
- **Future real-feed requirements:** [`PRODUCTION_DATA_REQUIREMENTS.md`](PRODUCTION_DATA_REQUIREMENTS.md)
- **Methodology and semantic vectors:** [`METHODOLOGY_DICTIONARY.md`](METHODOLOGY_DICTIONARY.md)
- **Identity and corporate-action contract:** [`IDENTITY_LINEAGE.md`](IDENTITY_LINEAGE.md)

This is the input boundary for Squeeze Radar. Generated CSVs are realistic synthetic fixtures, but their identifiers, clocks, units, grains, and field names are intended to survive the later move to real sources. A future live adapter must preserve these normalized semantics through a separately versioned LIVE contract; model code must not learn a vendor's native payload. Raw generated data lives under the Git-ignored `data/synthetic/` tree and is recreated locally as needed.

CSV v1 is executable only for `data_mode=SIM`; its schema deliberately rejects `LIVE`. The reusable domain fields and the additional envelope, lineage, entitlement, correction and feed-health requirements for a future real-feed contract are documented separately in [PRODUCTION_DATA_REQUIREMENTS.md](PRODUCTION_DATA_REQUIREMENTS.md). That document is a readiness checklist, not approval to activate a source.

The CSV bundle is a foundation fixture, not yet the complete production schema set described by T03. Alert cases, model cards, entitlements, exports, and scored outputs remain separate contracts to implement.

The approved SQZ egress policy applies to synthetic and future live inputs. Ingestion begins when the first byte or record is accepted by any Market Terminal-controlled adapter or process, before parsing, validation, quarantine, diagnostics, or persistence. From that instant, raw, rejected/quarantined, normalized and derived data stays inside the registered Market Terminal trust boundary. Same-origin UI/API use and least-privilege registered internal services are allowed. Third-party model software may run wholly inside the attested boundary only when prompts, features, outputs, telemetry, diagnostics, and callbacks cannot leave it. External notifications, webhooks, external APIs/out-of-boundary models, payload-bearing telemetry, platform screenshot generation and external-share features are prohibited. An authorized user's explicit governed download/export is the sole external-transfer exception; its generation and staging remain inside the boundary until download.

The server loader reads and validates `manifest.csv` before any model-input file, dispatches the exact retained `1.0` or current `1.1` schema, accepts `SIM` only, enforces exact ordered headers and JSON Schema types, verifies logical-record revision uniqueness, checks timestamp order and cross-file security/issuer references, and never reads or returns the truth ledger. Successful loads are privately branded and deep-frozen; the T08 service rejects hand-built, cloned, spread, or cast bundles at runtime. `buildSqueezeBundleAsOf` admits only rows whose `first_knowable_at` is no later than the requested decision time and keeps the latest eligible revision of each logical record.

## Replacement rule

To replace a synthetic source later:

1. Map source-native identifiers to `security_id` without using ticker as a durable key.
2. Normalize timestamps, units, rate convention, currency, methodology, and revisions into the documented columns.
3. Set `source_id` to the approved adapter, preserve the raw source reference outside this CSV projection, and set `data_mode=LIVE` only in an isolated future-live configuration.
4. Calculate `first_knowable_at` as the latest time the exact revision was both available and permitted for the model. Never backdate late files, backfills, or corrections.
5. Run the same schema, point-in-time, identity, reconciliation, and semantic tests used for the synthetic bundle.
6. Keep a response, case, feature snapshot, and export wholly `SIM` or wholly `LIVE`. Mixed provenance is invalid.

Changing a filename, header, grain, unit, or allowed meaning is a contract change and requires a new versioned schema. Major incompatible families receive a new directory; additive revisions within this v1 family receive a new schema file and explicit loader dispatch. Adding rows is not.

## Files and grains

| File | One row represents | Model role | Expected future source |
|---|---|---|---|
| `manifest.csv` | one generated bundle | Reproducibility and provenance | deployment/configuration registry |
| `securities.csv` | one security identity over an effective interval | Joins, float, listing and display identity | security master and corporate actions |
| `inventory_snapshots.csv` | security × book × owner × business-date snapshot | Internal supply and capacity | internal stock-loan platform |
| `loan_snapshots.csv` | loan × business-date snapshot | Internal economics and re-rate eligibility | internal stock-loan platform |
| `borrow_events.csv` | one locate/borrow lifecycle event | Demand and fill pressure | internal stock-loan platform |
| `market_borrow_snapshots.csv` | security × provider-style business-date snapshot | External borrow stress and benchmark | licensed securities-finance provider |
| `short_interest.csv` | security × report × kind × revision | Short positioning | official publication and optional estimate provider |
| `short_sale_volume.csv` | security × trade date × venue scope | Context only | FINRA/exchange short-sale volume |
| `equity_market_daily.csv` | security × trade date | Price, liquidity and volatility | licensed equity market data |
| `options_snapshots.csv` | underlying security × business date | Optional positioning/volatility context | licensed options data/analytics |
| `etf_snapshots.csv` | ETF × business date | ETF flow and structure context | licensed ETF reference/flow data |
| `security_events.csv` | one published security/issuer event | Catalyst and explanation context | approved events/corporate-actions feed |
| `_truth/truth_events.csv` | one injected scenario outcome | Tests and evaluation only | none; synthetic-only and forbidden to scoring |
| `data_dictionary.csv` | one published field in one file | Contract discovery and adapter mapping | maintained with this contract |

The executable T07 identity contract separates issuer, share class, security, and listing histories even though CSV v1.1 still transports their common fields in one `securities.csv` row. Its event-specific lineage fixture and quarantine rules are documented in [IDENTITY_LINEAGE.md](IDENTITY_LINEAGE.md). T08 publishes the normalized CSV histories through a future-compatible local SIM contract; publishing the separated T07 identity catalog itself requires a later contract revision and no v1.1 header or grain is implicitly changed here.

## Which inputs each model needs

| Signal product | Hard-required inputs | Optional/context inputs | If hard-required data is absent |
|---|---|---|---|
| Borrow Stress | `securities`, `market_borrow_snapshots` | internal inventory, borrow events, security events | signal is `UNAVAILABLE`; do not substitute zeros |
| Squeeze Risk | `securities`, `market_borrow_snapshots`, `short_interest`, `equity_market_daily` | options, events, ETF context, short-sale volume | signal is `UNAVAILABLE` or explicitly `DEGRADED` under an approved feature policy |
| Re-rate Opportunity | `securities`, `inventory_snapshots`, `loan_snapshots`, `market_borrow_snapshots`, `equity_market_daily` | demand/events | signal is `UNAVAILABLE`; never compare non-comparable loan economics |

Daily short-sale volume is never a fallback for official or estimated short interest. The truth file is never an input. ETF rows augment context and do not turn an ETF flow into evidence of a squeeze.

## CSV conventions

- UTF-8 text, comma delimiter, RFC-4180-style quoting, one header row, and `\n` line endings.
- Dates use `YYYY-MM-DD`. Timestamps use UTC ISO-8601 with a trailing `Z`.
- Integers are base-10 without grouping separators. Decimal point is `.`. Blank represents an optional missing value; zero represents a measured zero.
- Quantities ending in `_qty` are shares unless the dictionary says otherwise. Currency values include the currency in their field name or companion field.
- Percentages use the human 0–100 scale: `78.5` means 78.5%, not 0.785. Fees and spreads use annualized basis points.
- Booleans are lowercase `true` or `false`. Enumerations are uppercase tokens.
- `scenario_id`, stable entity IDs, observation/report/event IDs, `source_id`, `revision`, and `data_mode` are not decoration. They are required lineage.
- File order carries no meaning. Consumers must sort by the relevant clock and stable ID.

## Clock semantics

| Clock | Meaning |
|---|---|
| `business_date` / `trade_date` / `settlement_date` | Economic date represented by the value; not necessarily when the model learned it |
| `event_time` | Time the underlying event became effective in the scenario/source |
| `published_at` | Time the source made the record public or distributable |
| `observed_at` | Time the source or adapter observed the value |
| `ingested_at` | Time this platform persisted this exact revision |
| `first_knowable_at` | Earliest permitted model-use time for this exact revision; must be no earlier than applicable publication/observation/ingestion constraints |
| `generated_at` | Bundle-generation time; never a substitute for an observation clock |

All as-of joins must require `first_knowable_at <= decision_at`, then select the latest eligible revision. This is the anti-time-travel rule, which sounds obvious right up until a revised file quietly makes a backtest clairvoyant.

## Important calculations and invariants

- Market utilization: `100 × on_loan_qty / lendable_qty`.
- Market availability: `lendable_qty - on_loan_qty`.
- Internal eligible inventory: `gross_inventory_qty - restricted_qty`.
- Internal available inventory: `eligible_lendable_qty - reserved_qty - on_loan_qty`.
- Short-interest percentage: `100 × position_qty / float_shares` when `basis=FLOAT`.
- Official and estimated short interest remain separate rows via `short_interest_kind`; one must not overwrite or fill the other.
- `adjusted_close_price` carries the corporate-action-adjusted series. OHLC fields are unadjusted unless a later contract version says otherwise.
- Loan and benchmark fees are comparable only after rate convention, currency, collateral, term, settlement state, and source cohort are compatible.
- `quality_state=QUARANTINED` is ineligible for feature publication. `DEGRADED` requires an explicit model policy; it is not silently valid.

The SQZ-T09 decision shape and policy-injected row-quality, freshness, and coverage rules are documented in [QUALITY_GATES.md](QUALITY_GATES.md). The gate deliberately has no built-in budgets or coverage thresholds while owner decisions remain open.

## Field reference

The generated `data/synthetic/squeeze_radar/v1/data_dictionary.csv` is the exhaustive machine-readable field reference and documents every file/column pair with:

| Dictionary column | Meaning |
|---|---|
| `dataset` | Relative CSV path |
| `column_name` | Exact case-sensitive header |
| `data_type` | `string`, `integer`, `number`, `boolean`, `date`, `timestamp`, or `enum` |
| `required` | Whether the field must be populated for that dataset |
| `unit` | Scale and unit, including 0–100 percentages and basis points |
| `description` | Business meaning |
| `allowed_values` | Closed values where applicable; blank means source-specific/open vocabulary |
| `live_replacement_source` | Expected category of future system or vendor |

The same logical field may have different requiredness by dataset in a later version. V1's dictionary repeats field metadata by file deliberately so an adapter can validate one file without inferring rules from another.

## Synthetic scenario included

`sqz_base_v1` contains six fictional securities and 25 business dates. It includes an ordinary regime, one squeeze-like event, a borrow-tightening near miss, a mundane negative control, and ETF context. Domain series share the same dated scenario rather than being independent dice rolls. The truth ledger contains the intended evaluation labels and is physically separated under `_truth/`. The manifest, overlay, stream, regime, schedule, invariant, and fault rules are defined in [SCENARIO_MANIFEST.md](SCENARIO_MANIFEST.md).

Regenerate from the repository root:

```bash
npm run generate:squeeze-csv
npm test -- --run src/data/squeezeCsvFixtures.test.ts
```

### Portable generator interface

The generator is a dependency-free ES module that can be copied with or run from any clone containing this repository. It exposes both a CLI and an importable API; importing the module has no write side effects.

```bash
node scripts/generate-squeeze-radar-csv.mjs \
  --manifest ./contracts/squeeze_radar/v1/scenarios/base.json \
  --output-dir ./data/synthetic/squeeze_radar/v1 \
  --scenario-id sqz_base_v1 \
  --seed 21021 \
  --generated-at 2026-10-23T16:00:00Z
```

```js
import { generateSqueezeRadarCsv } from "./scripts/generate-squeeze-radar-csv.mjs";

const result = await generateSqueezeRadarCsv({
  manifestPath: "./contracts/squeeze_radar/v1/scenarios/base.json",
  outputDir: "./data/synthetic/squeeze_radar/v1",
  scenarioId: "sqz_base_v1",
  seed: 21021,
  generatedAt: "2026-10-23T16:00:00Z",
});
```

The API returns the resolved output path, generator and resolved-manifest identities, manifest SHA-256, applied fault IDs, file count, and per-file row counts. `scenarioId` must be a safe stable identifier, `seed` must be a non-negative safe integer, and `generatedAt` must be a valid UTC timestamp ending in `Z`. Overrides are applied before canonical serialization, hashing, archival, and generation. The default output is script-relative; explicit CLI paths are caller-working-directory-relative. Raw output remains under the Git-ignored `data/synthetic/` tree unless the caller deliberately selects another destination.

When the field contract changes, regenerate the committed schema and TypeScript types with:

```bash
npm run generate:squeeze-contracts
```

The generator is deterministic at `scenario_id=sqz_base_v1`, `seed=21021`, `scenario_manifest_id=sqz-base`, and `generator_version=sqz-csv-gen-1.2.0`. Named, stateless domain streams ensure an options-only stream change does not perturb equity or borrow output; the seed is not decorative manifest metadata.

## Live-adapter acceptance checklist

A future real-data adapter is not ready until all answers are yes:

- Do headers, types, grains, units, enumerations, and stable IDs match a versioned contract?
- Are source methodology and licensing/retention rights recorded outside the model payload?
- Do publication, observation, ingestion, revision, and first-knowable clocks preserve source reality?
- Are official short interest, estimates, and short-sale volume distinguishable end to end?
- Do inventory, loan, availability, and utilization invariants reconcile within approved tolerances?
- Are late, stale, duplicated, revised, unmapped, or unit-invalid records rejected or quarantined?
- Is `LIVE` isolated from `SIM`, with no fallback from one mode to the other?
- Can every feature and score be reconstructed from eligible input revisions without the truth ledger?
