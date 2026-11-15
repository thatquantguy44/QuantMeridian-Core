# Capability Map — Relationship Intelligence Graph

The module is a local, synthetic research explorer for relationships that are
hard to see in flat collateral, lending, funding and schedule tables.

| Module id | Responsibility | Depends on |
|---|---|---|
| `graph-stress` | Show entities, documents and exposures as a relationship graph and trace a selected shock through connected edges | synthetic fixture |
| `schedule-timeline` | Represent collateral eligibility, haircut and margin schedules as dated evidence with before/after values | synthetic fixture |
| `coupling-matrix` | Surface shared entities and concentration across collateral, lending and funding domains | synthetic fixture |
| `evidence-ledger` | Explain each relationship with source-document labels, units, as-of dates and synthetic notices | synthetic fixture |
| `inventory-obligations` | Connect synthetic inventory lots to obligations, schedules, reuse, mobilization friction, document conflicts and optimization constraints | synthetic fixture |

Build order: `graph-stress` → `schedule-timeline` → `coupling-matrix` → `evidence-ledger` → `inventory-obligations`.

The first release is intentionally one browser module, not four separately
deployable services. The capability boundaries are visual and contractual so a
later service split can be made without changing the synthetic meaning.
