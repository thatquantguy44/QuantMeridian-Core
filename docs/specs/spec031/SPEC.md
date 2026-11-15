# Spec 031 — Relationship Intelligence Graph

Status: proposed synthetic exploratory module. This slice is for discovering
relationships, not for live collateral instructions, credit decisions or trade
execution.

## Objective

Give a quant or risk reviewer a fast way to see relationships that disappear in
flat tables: collateral schedule changes that affect several agreements, assets
shared by multiple margin calls, and stress paths that pass through a common
counterparty or document clause.

## User outcome

A user opens `KGR` at `/knowledge-graph`, selects one bounded fictional scenario,
and can move between six views:

- graph + scenario delta review;
- temporal graph mode with bounded effective-date replay;
- schedule-to-exposure timeline;
- cross-domain coupling matrix;
- evidence ledger/documentation.
- inventory-to-obligation explorer.

Every view says `SIM`, preserves units and dates, and distinguishes a synthetic
relationship from an observed market fact.

## Commands

- Dev: `npm run dev`
- Focused tests: `npm test -- src/data/knowledgeGraph.test.ts src/lib/nav.test.ts`
- Typecheck: `npm run typecheck`
- Client build: `npm run build:client`

## Project structure

- `src/data/knowledgeGraph.ts` — deterministic synthetic graph, schedules and stress paths.
- `src/data/inventoryGraph.ts` — synthetic inventory lots, obligations, allocations and optimization framing.
- `src/data/knowledgeGraph.test.ts` — fixture, scenario and evidence invariants.
- `src/app/knowledge-graph/page.tsx` — module shell and scenario controls.
- `src/app/knowledge-graph/*View.tsx` — graph, schedule, coupling, evidence and inventory views.
- `settings/modules.config.json`, `src/lib/nav.ts`, `src/App.tsx` — module registration.

## Contract and boundaries

The fixture contains fictional entities, relationship edges, schedule clauses,
units, as-of dates and deterministic stress deltas. No view may imply that a
relationship is observed, executable, approved or causal. The expanded fixture
contains two synthetic books, two counterparties, two custodians/locations,
operational schedule nodes and five obligation paths. No live fetch, upload,
ML estimate, solver action, order route or production service is in this first
slice. Inventory allocation panels are descriptive and synthetic; they do not
assert legal eligibility, enforceability or an executable pledge.

Always:

- keep graph, schedule, matrix and ledger derived from one immutable scenario snapshot;
- show scenario, `SIM`, as-of date, units and source-document labels;
- keep shocks bounded and disclose the affected edges and nodes;
- show inventory lots, obligations, allocations, mobilization friction and document conflicts from the same snapshot;
- make graph and inventory selections drill through to affected paths, obligations, schedules, documents and evidence;
- preserve null/unavailable evidence instead of inventing a link.

Ask first:

- adding live collateral schedules or internal-book adapters;
- adding a Python model/service boundary or a graph database;
- changing module settings or adding a new package dependency.

Never:

- present the synthetic graph as a live exposure map;
- turn a graph edge into an implied recommendation or executable action;
- hide an impacted node when a stress path cannot be completed.

## Success criteria

- The page is reachable through a gated `KGR` nav route.
- Seven deterministic scenarios produce different, inspectable stress paths.
- The graph includes multiple books, counterparties, custodians, schedules and obligations rather than a single linear chain.
- A schedule row links to the affected relationship and shows before/after values.
- The coupling matrix exposes at least one shared-entity concentration that is not obvious in the graph alone.
- The inventory explorer shows at least one shared lot, one coverage shortfall, one mobilization risk and one document conflict.
- The inventory graph renders lots, schedules, obligations and operational signals as connected nodes from the same snapshot.
- Selecting a graph or inventory node exposes a deterministic impact-path drillthrough with linked obligations, schedule/document lineage and evidence IDs.
- Temporal Graph Mode replays pending versus active schedule changes at bounded synthetic dates and suppresses inactive edge deltas.
- Unit tests verify deterministic IDs, bounded scenarios, non-additive path-level deltas, schedule-to-edge links and visible evidence metadata.
- The page renders at mobile and desktop widths without relying on color alone.

## Open questions

- Should the later source adapter accept PDF schedule extracts, normalized tables,
  or both?
- Is a graph database warranted after the synthetic relationship count exceeds
  the current bounded fixture?
- Which stress paths should be promoted into BRV, COLL or SXU workflows, if any?
