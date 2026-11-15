# KGR — relationship and collateral evidence contract

Contract version: `relationship-intelligence-demo/1`. All values in this slice
are synthetic and deterministic.

## Scenario controls

| Scenario | Synthetic shock | Bounded purpose |
|---|---|---|
| `baseline` | none | show the ordinary relationship topology |
| `haircut-step` | UST haircut rises from 2% to 4% | trace coverage pressure through an eligibility schedule |
| `margin-call` | CCP call rises by $25m | trace shared collateral and funding dependencies |
| `borrow-recall` | recall exposure rises by $12m | trace the borrow-to-collateral substitution path |
| `custody-outage` | Custodian B becomes unavailable | show stranded T-Bill capacity and replacement paths |
| `cutoff-miss` | a substitution cutoff is missed | show operational shortfall without changing legal eligibility |
| `compound-stress` | haircut + margin + recall + custody outage | test several interacting declared deltas together |

## Nodes and edges

Each node has `id`, `label`, `kind`, `domain`, `status`, `valueUsd`, `asOf` and
`evidenceIds`. Each edge has `id`, `source`, `target`, `relation`, `valueUsd`,
`stressDeltaUsd`, `units`, `asOf`, `documentId`, `evidenceIds` and an explanation.
Edge direction is descriptive, not a causal claim. Diagnostic edge deltas are
an allocation view and must not be added together.

The fixture covers two borrowers/desks, two counterparties, agreements, assets,
margin calls, a custodian and schedule documents across lending, collateral,
funding, document and operations domains. A relationship can be present with a zero stress
delta; absence of an edge means unavailable synthetic evidence, not proof of no
relationship.

## Schedule rows

Each schedule row includes `documentId`, `clauseId`, `effectiveFrom`, `effectiveTo`,
`subject`, `field`, `before`, `after`, `unit`, `affectedNodeIds`, `status` and
`note`. It also includes `affectedEdgeIds` and an `allocationRule`, which make
scenario allocation links and the non-additive interpretation explicit. The
normalized row is always paired with a visible fictional document label. No row
is an official eligibility schedule.

Coupling cells include `units`, `asOf`, `documentIds` and `evidenceIds` so a
shared-entity score can be traced to its synthetic source labels.

## Impact drillthrough

`buildImpactDrillthrough(snapshot, focusId)` resolves graph nodes, inventory lots,
obligations, schedule rows, mobilization risks, document conflicts and stress
paths into one deterministic detail contract. The result retains related edges,
affected obligations, schedule/document lineage, evidence IDs and notices. A
focus may be a graph node, inventory graph node or declared stress path. Path
deltas remain diagnostic and non-additive; the drillthrough never emits an
allocation, order or collateral instruction.

## Temporal graph mode

`buildTemporalState(snapshot, asOf)` applies schedule `effectiveFrom` and
`effectiveTo` boundaries to one immutable snapshot. It returns visible,
active and pending schedule IDs, active edge IDs, paths with active components,
and a copy of the edge list with inactive stress deltas suppressed. The mode
uses the bounded timepoints `2025-12-31`, `2026-01-01` and `2026-11-04`; it is a
date-replay view of synthetic clauses, not a historical market reconstruction.

## Derived outputs

The snapshot contains graph nodes/edges, schedule rows, coupling cells, stress
paths, an inventory overlay, five KPI metrics, `scenario`, `asOf`, `dataMode: SIM`,
`methodVersion: kgr-synthetic-scenario/1`, `runId` and notices. Repeated
scenario input produces the same output. All views must preserve the same
`runId` and evidence IDs.

## Inventory overlay

The inventory overlay contains synthetic lots, obligations, allocations,
mobilization risks, document conflicts and an optimization frame. Lots carry
market value, haircut, usable value, pledged value, location, settlement lag,
schedule IDs and evidence IDs. Restricted lots remain visible for lineage but
cannot contribute an allocation to obligation coverage. Obligations carry required
value, haircut-adjusted coverage, shortfall and evidence IDs. Obligation shortfalls are an aggregate,
non-additive view because the same lot may be visible against more than one
obligation. Allocations identify shared lots so reuse is visible rather than
silently treated as free capacity. The optimization frame
records constraints and candidate substitutions but never emits an executable
allocation.

The inventory graph projection groups lots as `SOURCE`, schedules, mobilization
risks and document conflicts as `ENGINE`, and obligations as `USE`. Allocation
edges carry haircut-adjusted synthetic value; risk and conflict edges preserve
the lot relationship even when no allocation exists.

## Proposed external research envelope

The six-provider package uses a separate `kgr-source-research/1` envelope described
in [SOURCE_ADMISSION.md](SOURCE_ADMISSION.md). It is a proposed research contract,
not an extension that admits public schedules into this synthetic snapshot.
All collected records remain `RESEARCH_ONLY`; source clauses are not joined to
fictional obligations, collateral holdings or stress paths.
