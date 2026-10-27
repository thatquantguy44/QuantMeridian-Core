# Squeeze Radar synthetic CSV bundle v1

This directory contains the durable contract guide for the deterministic `sqz_base_v1` fixture pack. Raw generated CSVs are written to `data/synthetic/squeeze_radar/v1/` and intentionally ignored by Git.

- Contract and replacement guide: [`docs/specs/spec021/DATA_CONTRACT.md`](../../../docs/specs/spec021/DATA_CONTRACT.md)
- Future real-feed field requirements: [`docs/specs/spec021/PRODUCTION_DATA_REQUIREMENTS.md`](../../../docs/specs/spec021/PRODUCTION_DATA_REQUIREMENTS.md)
- Methodology dictionary: [`docs/specs/spec021/METHODOLOGY_DICTIONARY.md`](../../../docs/specs/spec021/METHODOLOGY_DICTIONARY.md)
- Scenario manifest and fault contract: [`docs/specs/spec021/SCENARIO_MANIFEST.md`](../../../docs/specs/spec021/SCENARIO_MANIFEST.md)
- Threat model: [`docs/specs/spec021/THREAT_MODEL.md`](../../../docs/specs/spec021/THREAT_MODEL.md)
- Point-in-time SIM publication contract: [`docs/specs/spec021/SIM_PUBLICATION.md`](../../../docs/specs/spec021/SIM_PUBLICATION.md)
- Quality, freshness, and coverage gates: [`docs/specs/spec021/QUALITY_GATES.md`](../../../docs/specs/spec021/QUALITY_GATES.md)
- Current JSON record schema: [`csv-records-1.1.schema.json`](csv-records-1.1.schema.json); retained compatibility schema: [`csv-records-1.0.schema.json`](csv-records-1.0.schema.json)
- Machine-readable quality-decision schema: [`quality-decision-1.0.schema.json`](quality-decision-1.0.schema.json)
- Synthetic freshness policy and schema: [`policies/synthetic-freshness-1.0.json`](policies/synthetic-freshness-1.0.json) and [`synthetic-freshness-policy-1.0.schema.json`](synthetic-freshness-policy-1.0.schema.json)
- Synthetic coverage policy and schema: [`policies/synthetic-coverage-1.0.json`](policies/synthetic-coverage-1.0.json) and [`synthetic-coverage-policy-1.0.schema.json`](synthetic-coverage-policy-1.0.schema.json)
- Scenario schemas and golden configurations: [`scenario-manifest-1.0.schema.json`](scenario-manifest-1.0.schema.json) and [`scenarios/`](scenarios/)
- Machine-readable semantic vectors: [`semantic-test-vectors-1.0.json`](semantic-test-vectors-1.0.json)
- Identity and corporate-action golden fixture: [`identity-lineage-golden-1.0.json`](identity-lineage-golden-1.0.json)
- Generated TypeScript record types: [`src/lib/squeezeRadar/contracts.generated.ts`](../../../src/lib/squeezeRadar/contracts.generated.ts)
- Exhaustive field catalog after generation: `data/synthetic/squeeze_radar/v1/data_dictionary.csv`
- Manifest after generation: `data/synthetic/squeeze_radar/v1/manifest.csv`
- Generator: [`scripts/generate-squeeze-radar-csv.mjs`](../../../scripts/generate-squeeze-radar-csv.mjs)
- Contract tests: [`src/data/squeezeCsvFixtures.test.ts`](../../../src/data/squeezeCsvFixtures.test.ts)

All issuers, tickers, owners, books, counterparties, values, and events are fictional and marked `SIM`. Generated files directly under the v1 data directory are model inputs. `_truth/truth_events.csv` and `_truth/scenario-manifest.json` are generator/test-only metadata and must never be reachable by feature or scoring code.

This v1 schema is not a dormant live connector: `data_mode` is constrained to `SIM`. Production fields are documented for future adapter design, but enabling real feeds requires a separately versioned and approved LIVE contract.

Regenerate and verify from the repository root:

```bash
npm run generate:squeeze-csv
npm test -- --run src/data/squeezeCsvFixtures.test.ts
```

The generator uses only Node.js built-ins, so a fresh clone can also run it directly without installing application dependencies:

```bash
node scripts/generate-squeeze-radar-csv.mjs \
  --manifest ./contracts/squeeze_radar/v1/scenarios/base.json \
  --output-dir ./data/synthetic/squeeze_radar/v1 \
  --scenario-id sqz_base_v1 \
  --seed 21021 \
  --generated-at 2026-10-23T16:00:00Z
```

Run `node scripts/generate-squeeze-radar-csv.mjs --help` for all CLI options. The same file is an import-safe ES module and exports `generateSqueezeRadarCsv(options)` for test harnesses or other local tooling. Paths supplied with `--output-dir` are resolved from the caller's working directory; the default output path is resolved from the checked-out script, so it does not depend on this machine's absolute path.

Use `npm run generate:squeeze-contracts` after changing headers or field metadata; it refreshes the current JSON Schema and generated TypeScript types. The CSV output is byte-stable for the same resolved manifest. Named domain streams keep unrelated outputs stable when an optional domain changes. Do not hand-edit generated CSVs or force-add them to Git; change the manifest, generator, and contract tests together.
