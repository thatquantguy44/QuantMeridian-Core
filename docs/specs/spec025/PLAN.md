# Spec025 implementation plan and completed slice

**Updated:** 2026-10-31. Branch `feat/spec025-aaii-postgres`.

## Completed delivery order

1. Source/schema inspection and offline normalization/reader-admission contracts.
2. Owner-approved dedicated local reader provisioning, then actual access checks.
3. Owner confirmation of private local research rights and operating ownership.
4. Bounded read-only reader and no-store local API, admitted before Gold SELECT.
5. One validated AAII selection shared by card, chart, table, latest dates and KPI.
6. Latest instruction: remove **all** generated SENT inputs, examples and provider
   enrichment. Every unconnected view/metric shows No data, even with global SIM on.
7. Inspect macro_medallion read-only, admit seven catalog-backed daily FRED
   series and add a bounded macro API/history UI. Preserve missing rows, explicit
   ages and units; no full index or macro freshness policy is invented.
8. Offline contract/API/browser checks plus separate real database-to-browser reads.

## Current consumer treatment

| Surface | Final behavior |
| --- | --- |
| AAII card/table/chart | Exact admitted current-vintage history, latest 104 observations; no filled dates. |
| Latest date evidence | Reported date, source retrieval/first seen, unknown publication and actual terminal read time shown separately. |
| AAII top KPI | Real latest spread; No data when stale/unavailable. Dated stale history remains inspectable. |
| Full index/regime/week change | No data: required real NAAIM/options/breadth components are absent. No reweighting. |
| Macro components | Seven verified Gold/FRED series through `/api/sentiment/macro`; up to 252 stored rows each, explicit metadata/missingness and paginated history. No seeded scores or new freshness verdict. |
| Social | SENT-specific strict observed-post path; no generated enrichment, empty providers unavailable, StockTwits absent sentiment not neutralized. |
| Positioning/signals/analogs/divergence/borrow join | No data until their required real source contracts exist. |
| Legacy `src/data/sentiment.ts` | No longer imported by SENT. Other consumers outside SENT remain outside this change. |

## Next implementation boundary

Start **AAII-T08**, a source inventory/admission document for real NAAIM. Establish
actual dataset location, permitted use/owner, schema/units, dates/clocks/revisions,
coverage/freshness and dedicated read access. Produce a bounded proposed contract
and invented fixtures before wiring. No score-method changes, replacement generated
series, production activation, provider scraping or database writes are implied.

Do not re-ask local AAII target, reader provisioning, private local use or NO-SIM
choices. Do not run the non-idempotent reader-role reference SQL again.

## Verification

```bash
npx vitest run src/lib/aaii src/lib/server/aaii src/lib/server/sentSocial.test.ts src/lib/server/sentMacro.test.ts src/app/api/sentiment src/app/sentiment/SentMacroInputs.test.ts --no-file-parallelism
npx playwright test test/sentiment-history.spec.ts test/sentiment-macro.spec.ts test/sentiment-feed-transition.spec.ts
npm run typecheck
npm test -- --reporter=dot --no-file-parallelism
npm run build
npm run check:gold-policy
npm run check:agent-skills-pin
```

Ordinary tests never require a real source. The live evidence in HANDOFF.md came
from a separately authorized private local read. No source values, DSNs or
credentials are committed. Public/production use and durable survey retention
remain separate.
