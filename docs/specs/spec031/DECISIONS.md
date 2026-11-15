# KGR decisions

| Decision | Status | Choice |
|---|---|---|
| D01 | Accepted for R0 | Use a local deterministic TypeScript fixture; no service boundary or graph database yet. |
| D02 | Accepted for R0 | Treat one immutable snapshot as the source for graph, schedule, matrix and ledger views. |
| D03 | Accepted for R0 | Model collateral schedule clauses as first-class evidence nodes/rows with dates and before/after values. |
| D04 | Accepted for R0 | Stress is a bounded scenario delta mapped to declared edges and summarized at path level; it is not a forecast or causal estimate. |
| D05 | Open | Source admission format (PDF, normalized table or both) requires owner and data-rights review. |
| D06 | Open | Graph analytics, ML and database selection require historical relationship evidence and scale measurements. |
| D07 | Accepted for R0 | Inventory analysis is a synthetic overlay on the same snapshot; coverage is haircut-adjusted and edge/allocation deltas are diagnostic, not recommendations. |
| D08 | Accepted for R0 | Optimization is represented as an explicit constraint frame and candidate space only; no solver action is emitted in the prototype. |
| D09 | Accepted for R0 | Expansion uses a second synthetic book and three operational/compound scenarios rather than increasing graph density through duplicate edges. |
| D10 | Accepted for R0 | Drillthrough resolves graph and inventory selections back to the same immutable snapshot, exposing paths, obligations, schedules, documents and evidence without creating a separate state model. |
| D11 | Accepted for R0 | Temporal mode replays declared schedule effective dates over bounded synthetic timepoints; it suppresses inactive edge deltas but does not infer historical market states. |
| D12 | Accepted for research collection, 2026-11-05 owner request | Collect and assess CME, LCH Ltd, ICE Clear Europe, Eurex, Bank of England and Federal Reserve public collateral sources. Preserve originals/provenance and normalized research examples separately from the synthetic runtime. This does not approve product reuse rights or activate adapters. |
| D13 | Proposed, not activated | The source-admission proposal retains original documents plus normalized research records, separate publication/as-of/effective/retrieval dates and explicit unavailable values. D05 and provider admission remain open pending rights and semantic review. See SOURCE_ADMISSION.md. |
