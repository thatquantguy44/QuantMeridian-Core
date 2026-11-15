# Spec025 scoped tasks

**Updated:** 2026-10-31. Owner's latest direction: **NO SIM anywhere in SENT**;
source failure/unconfigured inputs show No data, even if global SIM is enabled.
Private local AAII research and operating ownership are confirmed.

| Task | Deliverable and acceptance | State |
| --- | --- | --- |
| AAII-T01 | Verified source/schema facts, coverage and safe admission evidence. | Complete |
| AAII-T02 | Read-only inspector and strict pure reader-admission guard. | Complete; approved dedicated reader verified |
| AAII-T03 | Typed contract, invented fixtures, units/dates/totals/clocks/adjacency/revisions validation. | Complete; 22 normalizer tests |
| AAII-T04 | Private local reader/use/owner admission; production kept separate. | Complete for local scope; no composite method or production approval implied |
| AAII-T05 | Dedicated read-only reader, exact target/role, timeouts, no-store local API and sanitized failures. | Complete; real 104-row API read verified |
| AAII-T06 | Real AAII card/history/KPI/dates; no generated SENT components/provider enrichment. | Complete for source-only display. Full index and unconnected views intentionally No data |
| AAII-T07 | Offline API/browser fresh/stale/failure/unknown-clock and NO-SIM checks; separate real DB-to-browser verification and handoff. | Complete for this slice; nine browser cases and four widths |
| AAII-UI01 | Entire bounded 104-row historical table, pagination, units, gaps, coverage, latest date and separate clocks. | Complete with real local AAII data; earlier SIM example removed |
| MACRO-T01 | Read-only macro_medallion inventory; admit existing catalog-backed series with strict source/unit/date/missingness checks, bounded no-store API and history UI. | Complete: seven FRED series, twenty focused cases, five macro browser cases and actual DB-to-browser verification. [Evidence](MACRO_INVENTORY.md) |
| SENT-BUG01 | Prevent retained legacy feed state reaching a new macro contract during live updates; absent selected history must show No data. | Complete: endpoint/parser/refresh identity guard, four render regressions, two browser transition regressions; all sixteen SENT browser cases pass |
| AAII-T08 | Inventory/admit a real NAAIM source: location, rights/owner, schema/units/dates/clocks/revisions/coverage and least-privilege reader proposal. | **Next scoped work**; no connector or synthetic replacement yet |

## Limits

- No survey-data writes, acquisition/provider-file downloads or pipeline repair.
- No writer/admin account in runtime; no changes to generic GoldStore policy.
- No SIM fallback, examples, generated input scores or invented neutral observations.
- No public display/export, new durable survey store or production source activation.
- No current aggregate until all required real inputs and method policies are admitted.
