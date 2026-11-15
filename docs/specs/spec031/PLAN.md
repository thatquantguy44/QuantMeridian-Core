# Relationship Intelligence Graph implementation plan

## Architecture

Start with a deterministic TypeScript fixture and a single terminal page. The
fixture is the only source for all five views; this prevents the graph, schedule,
matrix and inventory overlay from drifting into separate synthetic truths. Reuse the terminal's
`Panel`, `PageHeader`, `KpiStrip`, `Stat`, `Tag`, `NetworkGraph` and table
conventions. Do not add a graph library for the prototype.

## Runtime, model and service proposals

The first slice needs no Python model, service process, database, LLM or external
provider. A pure function is the portable boundary:

```text
buildKnowledgeGraph(scenario) -> KnowledgeGraphSnapshot
```

If later scale or source admission justifies extraction, package the same pure
contract as a standalone Python model plus a read-only FastAPI adapter. A graph
database is a later option only after measuring relationship volume, query shape,
and provenance requirements. QuantSmith may orchestrate scenario comparison in a
future phase but must not become the numerical source of truth.

## Ordered slices

1. Contract and fixture: nodes, edges, schedules, stress paths, deterministic IDs.
2. Graph/stress view: scenario selector, impact KPIs, graph and path ledger.
3. Schedule and coupling views: dated clauses, before/after values, matrix.
4. Evidence ledger and inventory overlay: document labels, lot coverage, reuse,
   mobilization friction, conflicts, substitutions and optimization framing.
5. Navigation, browser verification at 320px, 768px, 1024px and 1440px;
   typecheck and build.

## Risks and mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Synthetic links look authoritative | High | persistent SIM banner, source labels and explicit non-causal copy |
| Graph becomes decorative | Medium | pair every edge with value, units, stress delta and ledger row |
| Views disagree | High | derive every view from one immutable snapshot and test invariants |
| Premature graph infrastructure | Medium | no graph database or dependency until scale/query evidence exists |
