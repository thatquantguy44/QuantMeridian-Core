# Squeeze Radar legacy consumer inventory

**Task:** SQZ-T10a

**Inventory contract:** `contracts/squeeze_radar/v1/consumer-inventory-1.0.json`

**Scope:** repository-owned TypeScript/JavaScript consumers of `src/data/squeeze.ts`

**Mode:** synthetic only (`SIM`)

**Reviewed:** 2026-10-25

## Decision

Freeze the current deterministic SIM interface for every non-SQZ consumer. Migrate only the
Squeeze Radar page to the authenticated `SqueezeRadarService` boundary in SQZ-T17, after the T16
same-origin request/response contract is stable. T17 must not silently redirect UTIL or SENT to the
new service.

Any change that adds, removes, or migrates a direct consumer must update the versioned inventory
and its compatibility snapshots in the same reviewed change. New direct imports are otherwise
prohibited.

```text
src/data/squeeze.ts
  ├─ SQZ page ───────────────────────────── migrate in T17
  ├─ UTIL page ─┬─ utilization analytics ─ freeze SIM compatibility
  │             └─ utilization PDF ─────── freeze SIM compatibility
  ├─ SENT crowding ── sentiment page ───── freeze SIM compatibility
  └─ regression tests ───────────────────── keep as guards
```

## Direct consumers

| ID | Consumer | Dependency | Downstream surface | Disposition |
|---|---|---|---|---|
| SQZ-C01 | `src/app/securities-lending/squeeze/page.tsx` | Values and types; all board and derived-view helpers | `/securities-lending/squeeze` | Migrate to the SIM-only service client in T17. The legacy Yahoo overlay is not admitted to that boundary. |
| SQZ-C02 | `src/app/economics/utilization/page.tsx` | Values and types; board and sector heat | `/economics/utilization`, PDF inputs | Freeze the current SIM interface. Any migration is a separate UTIL decision. |
| SQZ-C03 | `src/data/sentiment.ts` | Value; `getSqueezeBoard` | `getTickerSentiment`, `src/app/sentiment/page.tsx`, `/sentiment` | Freeze the current SIM interface. A later SENT integration must use a bounded in-platform projection. |
| SQZ-C04 | `src/data/utilizationAnalytics.ts` | Types only | Utilization time-series analytics | Freeze for now; later remove the unused board parameter and unused `SectorHeat` import in an isolated UTIL cleanup. |
| SQZ-C05 | `src/lib/utilizationPdf.ts` | Type only | User-initiated Utilization PDF download | Freeze for now; remove its pass-through board option with the UTIL cleanup. Downloads remain an allowed user action. |
| SQZ-C06 | `src/data/squeeze.test.ts` | Values and types | Legacy overlay tests | Keep as a test guard until T17 decides which legacy overlay behavior remains isolated. |
| SQZ-C07 | `src/data/squeezeConsumerInventory.test.ts` | Values | Inventory and compatibility suite | Keep as the authoritative direct-import and snapshot guard. |

The first five entries are application/build consumers. The final two are test-only consumers.
Exact imported symbols, ownership, migration triggers, targets, and regression coverage live in the
machine-readable inventory rather than being duplicated here.

## Downstream findings

- The SQZ page is tightly coupled to the complete legacy board and derived-view helper set. It is
  the only Phase 1 consumer assigned to T17 migration.
- The utilization page calls `getSqueezeBoard` and `getSectorHeat`. It also passes the board through
  its analytics and PDF paths.
- `buildUtilizationTimeSeries` accepts a `SqueezeRow[]` but does not read it. `SectorHeat` is also an
  unused type import. These are dead couplings, but removing them inside T10a would change an
  unrelated UTIL interface and make the compatibility review less trustworthy.
- The Utilization PDF accepts and passes the same unused board. It does not directly render SQZ
  economics.
- `getTickerSentiment` is a real runtime dependency, not merely a type link: it anchors ticker
  crowding to the SQZ board order and consumes classification, short interest, utilization, fees,
  options fields, and heat.
- The downstream-core packaging manifest excludes SQZ and UTIL paths, and its sentiment patch
  removes the ticker-crowding cross-link. Those packaging controls are not runtime consumers, so
  they are documented but intentionally excluded from the direct-consumer registry.

## Compatibility evidence

`src/data/squeezeConsumerInventory.test.ts` provides two controls:

1. It parses every TypeScript/JavaScript file under `src/` with the TypeScript compiler API,
   resolves alias and relative references, and requires the discovered consumer paths, dependency
   modes, and imported symbol sets to exactly match the versioned inventory. Static imports and
   exports, side-effect imports, dynamic imports, and CommonJS `require` calls are detected.
2. It freezes SHA-256 snapshots of the full legacy board, all derived SQZ views, the fixed-clock
   utilization series for every page grouping, the generated report call sequence for every PDF
   tab, and sentiment/crowding output. These hashes are change detectors, not security claims.

The snapshots deliberately cover the untouched UTIL and SENT behavior. A deliberate behavior
change must explain the migration, update the inventory disposition, and refresh only the affected
snapshot under review.

Run the evidence from the repository root:

```bash
npx vitest run src/data/squeezeConsumerInventory.test.ts --maxWorkers=1 --minWorkers=1
```

## T17 handoff

T17 may replace direct imports only in SQZ-C01. Its client must accept only authenticated,
same-origin, SIM-provenance responses from `SqueezeRadarService`; it must not use the existing
request-time Yahoo overlay. SQZ-C02 through SQZ-C05 remain pinned to the legacy deterministic module
until their owning modules approve an explicit migration or dependency removal.
