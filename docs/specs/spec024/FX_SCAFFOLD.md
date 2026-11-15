# FX module scaffolding checkpoint

**Scope authorized:** 2026-10-30 owner request to build scaffolding for both FX modules.
**Status:** Frontend workspaces implemented; financial policies and data adapters remain draft.

**Later checkpoint:** FXR-S01 now connects the Research overview/evidence to approved local Gold snapshots; see [spec022/IMPLEMENTATION.md](../spec022/IMPLEMENTATION.md). The preview description and counts below record the original scaffold merge. The exposure workspace remains a shell.

| Module | Code / navigation group | Route | Working interactions |
| --- | --- | --- | --- |
| `fx-research` | FXR / Markets | `/fx/research` | Pair selection with explicit quote units; Market overview, Pair history, Research brief and Evidence tabs; link to exposure workspace. |
| `fx-exposure-hedging` | FXH / Financing | `/fx/exposure-hedging` | Reporting-currency workspace preference; Cashflows, Portfolio, Existing hedges, Scenarios, Proposals and Reconciliation tabs; link to research. |

Both pages are registered through the existing module configuration, router,
sidebar and command palette. Each route and crosslink respects its module gate.
New navigation entries are appended to preserve existing Alt+number shortcuts.
The module settings can hide either preview through the normal `enabled` flag.

The pages show `PENDING` provenance and `Workspace preview`, with explicit no-book,
no-reference-snapshot and unassessed-coverage states. There are no numerical
market/book examples, zero-exposure totals, financial calculations, data-fetching
effects, private uploads, export actions, or claims that a refreshed Gold table
is already an eligible FX snapshot. Selectors change workspace context only.

The confirmed exposure categories are cash balances, equities/ETFs, bonds and
existing FX hedges, alongside dated cashflows. Trading/denomination currency is
kept distinct from economic currency exposure in the workspace wording.

## Files and verification

- Pages: `src/app/fx/research/page.tsx`, `src/app/fx/exposure-hedging/page.tsx`.
- Shared presentation: `src/components/fx/Workspace.tsx` (tabs, status strip and empty panels).
- Integration: `src/App.tsx`, `src/lib/nav.ts`, `settings/modules.config.json`.
- Regression coverage: existing navigation/route tests and `test/fx-scaffold.spec.ts`.

The browser flow was first run against the absent routes and failed at the
research heading. After implementation it verifies both routes/crosslinks,
inverse-pair unit labels, tab keyboard navigation, empty states, no write
requests, no console/page errors and no main-content horizontal overflow at
320, 768, 1024 and 1440 pixels. Screenshots are captured for both workspaces;
mobile and desktop outputs were visually inspected. Table headers scroll within
their panel while empty-state descriptions wrap to the viewport.

Run from the repository root:

```bash
npm run typecheck
npm test -- --reporter=dot --no-file-parallelism
npm run build
npx playwright test test/fx-scaffold.spec.ts --retries=0 --workers=1
npm run check:gold-policy
npm run check:agent-skills-pin
```

Verified: **1,402 tests in 129 files** pass in the serial full-suite run; all four
responsive browser flows, typecheck, client/server build, Gold policy and skills
pin checks pass. The full suite's existing HTTP health fixtures need localhost socket permission;
a sandbox `listen EPERM` is not a product regression. The build retains existing
large-bundle and `eval` warnings. One parallel run encountered an empty SQZ CSV
while existing tests regenerated their shared fixture directory; serial execution
avoids that contention. Isolating those SQZ fixtures is a separate test-harness
follow-up, not a change to FX behavior. Independent code review found no concrete
scaffold issues. This checkpoint does not certify financial behavior or historical
point-in-time data.

## Next scoped work

PR #199 is merged at `342dcc4`. Work continues on `feat/fx-gold-snapshot-adapter`.
The owner approved the narrow [ECB admission policy](../spec022/ADMISSION_POLICY.md).
The adapter, local immutable replay and Research overview/evidence path are implemented
in [FXR-S01](../spec022/IMPLEMENTATION.md). [FXR-S02](../spec022/HISTORY_IMPLEMENTATION.md) now adds approved bounded history/changes in the same PR.
Next is FXR-S03: review descriptive-volatility policy before implementing it. Unknown original receipt/first Gold availability
remain null; current capture does not imply historical knowledge.
The [verified refresh checkpoint](../../gold-db/FX_DATA_REFRESH.md) records two invalid
rate identifiers, 16 discovery-catalog omissions and a latent interval-update
limitation that need separate upstream work.

For [spec023](../spec023/SPEC.md), next review valuation/attribution, counting,
existing-hedge allocation and input-classification policies before implementing
financial calculations or real-book intake. Module/category selection is already
confirmed; do not ask the owner to choose those again. There is no production
execution, pricing, hedging or private-access approval in this shell slice.
