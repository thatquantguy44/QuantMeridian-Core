# Squeeze Radar synthetic scenario manifest

The Phase 1 generator is driven by a versioned, `SIM`-only JSON manifest. The manifest is generator configuration, not a model input. Its resolved bytes are archived under the ignored bundle's `_truth/` directory and their SHA-256 digest is recorded in `manifest.csv`.

## Committed manifests

| Manifest | Purpose | Expected scale |
|---|---|---|
| `contracts/squeeze_radar/v1/scenarios/base.json` | Default coherent fixture and hand-checkable negative controls | 6 fictional securities × 25 business days |
| `contracts/squeeze_radar/v1/scenarios/fault-suite.json` | Deterministic clock, revision, stale-source, and unit failures | Base scenario plus six isolated faults |
| `contracts/squeeze_radar/v1/scenarios/large-demo.json` | Longer local dataset for UI, ranking, and performance work | 6 fictional securities × 250 business days |

`fault-suite.json` and `large-demo.json` are overlays of `base.json`. An overlay can extend only a sibling JSON file, cannot escape the scenario directory through `..` or a symlink, and cannot form a cycle. Containment and cycle checks use canonical filesystem paths. Resolution is shallow and explicit: an overlay replaces a complete top-level section such as `calendar` or `faults`. The archived replay manifest is the fully resolved object and points to `scenario-manifest-1.0.schema.json`, not to the overlay schema.

## Contract sections

| Section | Required content | Reason |
|---|---|---|
| Identity | Manifest ID/version, generator version, scenario ID, seed, generated time, `data_mode=SIM` | Exact replay and provenance |
| Calendar | Start date and bounded business-day count | Stable observation dates and output size |
| Fictional universe | Stable issuer/security/listing IDs and starting economic values | Cross-domain joins without real identities |
| Named streams | One salt for each domain | Domain changes do not perturb unrelated outputs |
| Regimes | Effective interval, target securities, and typed economic effects | Configurable ordinary, tightening, near-miss, and squeeze-like paths |
| Events | Fictional published event schedule | Evidence and outcome context |
| Publication schedules | Per-dataset observation time and ingest/knowable delay | Point-in-time clock behavior |
| Invariants | The complete fixed invariant set | A manifest cannot weaken generator coherence checks |
| Faults | Ordered, typed fault entries with an expected downstream gate | Repeatable negative testing |
| Truth events | Hidden outcome labels and causal drivers | Evaluation only; forbidden to feature/scoring paths |

Unknown fields and missing required sections fail generation. Contract tests check committed manifests against the published JSON Schema; the dependency-free runtime enforces the corresponding shape plus stricter cross-field domain rules. Every security name must end in ` Synthetic`, every ticker uses the reserved fictional `Q...` convention, and every generated record remains `SIM`. These are guardrails, not a legal assertion that an arbitrary name can never collide with a future real issuer; owners must still review new universe entries before approval.

## Determinism and stream independence

Random samples are stateless hashes of:

```text
seed + domain stream name + domain stream salt + stable record key
```

The stream name remains in the hash even if two salts are accidentally equal. Call order and row count therefore do not advance shared mutable random state. Changing `random_streams.options` changes options rows but cannot change equity, borrow, inventory, positioning, short-volume, or ETF rows.

The replay identity is the SHA-256 of the canonical resolved manifest bytes. Programmatic objects and file manifests use the same recursively key-sorted serialization. CLI overrides for `scenarioId`, `seed`, and `generatedAt` are applied before serialization, hashing, archival, and generation, so the archived manifest always describes the output actually produced.

## Regimes

Regimes are additive, effective-dated effects rather than code branches for particular tickers. Supported effects are:

- daily price change in percentage points;
- daily utilization change in 0–100 percentage points;
- daily fee change in annualized basis points;
- daily lendable-supply change in percent;
- daily volume multiplier growth;
- options call-volume multiplier.

The base manifest uses these primitives to produce ordinary drift, borrow tightening, an offering-driven near miss, and a squeeze-like price/volume episode. New effect types require a manifest schema and generator-version change; an unrecognized number is not silently ignored.

## Publication clocks

Each time-series dataset has an explicit schedule containing an observation time, ingest delay, and first-knowable delay. `knowable_delay_seconds` cannot precede `ingest_delay_seconds`. Official-style short interest additionally uses a declared business-day publication delay. Publication dates advance independently beyond the final observation date when necessary; the schedule's observation time and ingest/knowable delays still apply on that later date.

Every base record must satisfy:

```text
published_at <= first_knowable_at   when publication applies
observed_at  <= ingested_at <= first_knowable_at
```

Faults may delay ingestion or knowability, but they do not reverse these mandatory relationships. Post-decision revisions must preserve an eligible earlier revision and require the injected revision's `first_knowable_at` to be strictly later than `decision_at`.

## Fault library and composition

Faults execute in manifest order against the evolving output. Point-targeted faults must resolve to exactly one row. Two point faults cannot target the same dataset/security/date/revision, and a point fault cannot target a row removed by a declared stale-source range. Ambiguity or overlap fails generation.

| Fault | Effect | Required downstream gate |
|---|---|---|
| `STALE_SOURCE` | Removes matching rows after a declared cutoff | Source freshness/coverage |
| `LATE_INGESTION` | Delays ingestion and knowability for one revision | Ingest delay/freshness |
| `OUT_OF_ORDER_RECORD` | Delays an older observation past a later one and emits it later in the file | Point-in-time ordering |
| `BACKFILL_REVISION` | Appends a later numbered revision with an explicit numeric correction | Revision lineage |
| `POST_DECISION_REVISION` | Appends a revision knowable only after a declared decision | Leakage/point-in-time selection |
| `BAD_UNIT` | Applies a non-unit scale factor to a non-zero numeric field | A named exact invariant or approved range gate |

Revision numbers are allocated as the next number for the logical record, not assumed to be `2`. Structural controls remain mandatory after fault injection: every generated object is validated against the generated CSV contract, and `SIM` provenance, scenario identity, unique revisions, and clock order may not be waived. Exact accounting violations are allowed only for the declared gate on the fault's exact dataset, logical record, and revision. A declaration on one security therefore cannot provide diplomatic immunity to bad arithmetic on another. The committed bad-unit case scales utilization from the 0–100 convention to a fraction and must trigger `MARKET_UTILIZATION` on its own target; it does not depend on an unapproved anomaly threshold.

## Fixed base invariants

Every manifest must include the complete known set, and unknown invariant names fail validation:

- `MARKET_AVAILABILITY`: `lendable_qty - on_loan_qty = available_qty`
- `MARKET_UTILIZATION`: `100 × on_loan_qty / lendable_qty = utilization_pct`
- `INTERNAL_ELIGIBLE`: `gross_inventory_qty - restricted_qty = eligible_lendable_qty`
- `INTERNAL_AVAILABLE`: `eligible_lendable_qty - reserved_qty - on_loan_qty = available_qty`
- `SHORT_INTEREST_FLOAT`: `100 × position_qty / float_shares = short_interest_pct`

These checks run before faults. They run again afterward, allowing only the exact target-scoped violation named by a declared fault. `BAD_UNIT` also has to prove that its own target triggered its declared exact gate. A scenario manifest therefore cannot turn off an inconvenient accounting identity. A revolutionary concept, apparently.

## Truth isolation

Truth events live only in the generator manifest and generated `_truth/` files. `loadSqueezeCsvBundle` does not read `_truth/`, its returned type has no truth property, and model-input CSVs contain no `truth_*` field. Future feature, scoring, API, UI, alert, and export modules must consume only the loader's model-input boundary.

## Commands

Generate the default scenario:

```bash
npm run generate:squeeze-csv
```

Generate the fault suite or large demo:

```bash
node scripts/generate-squeeze-radar-csv.mjs \
  --manifest contracts/squeeze_radar/v1/scenarios/fault-suite.json \
  --output-dir data/synthetic/squeeze_radar/fault-suite

node scripts/generate-squeeze-radar-csv.mjs \
  --manifest contracts/squeeze_radar/v1/scenarios/large-demo.json \
  --output-dir data/synthetic/squeeze_radar/large-demo
```

Generated data remains under the Git-ignored `data/synthetic/` tree. Commit manifests, schemas, generator code, and tests—not generated raw CSVs.

## Approval boundary

The contract and implementation exist, but SQZ-T05a remains open until the product/data owner approves universe size/distributions, regime parameters, simulated cadence, and the golden/large-demo parameter sets. Synthetic values are test inputs, not evidence of real-world model efficacy.
