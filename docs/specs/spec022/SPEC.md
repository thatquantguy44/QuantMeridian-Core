# Spec022: FX Research

- **ID:** spec022-fx-research
- **Stable module id:** `fx-research`
- **Status:** Broader requirements remain draft. The bounded FXR-S01 source/purpose/calendar/retention policy is owner-approved and implemented locally; see [IMPLEMENTATION.md](IMPLEMENTATION.md).
- **Owner:** Joshua Lutkemuller
- **Updated:** 2026-10-31
- **Selection index:** [FX capability map](../../../FX_CAPABILITY_MAP.md)
- **Provider boundary:** [DATA_CONTRACT.md](DATA_CONTRACT.md)
- **First slice policy:** [ADMISSION_POLICY.md](ADMISSION_POLICY.md), including the owner-confirmed stale-display rule and bounded research-only proposal.
- **History slice:** [HISTORY_POLICY.md](HISTORY_POLICY.md) is owner-approved; [HISTORY_IMPLEMENTATION.md](HISTORY_IMPLEMENTATION.md) records completed chart/table/1,5,21 interval changes and replay in PR #200. Broader history/brief defaults remain proposed.
- **Volatility slice:** [VOLATILITY_POLICY.md](VOLATILITY_POLICY.md), branch `feat/fxr-volatility`. Following the owner's delivery direction, 5/21/63/126/252-return sample log volatility, optional √252 annualization, a 253-level capture, UI and immutable replay are implemented locally. See [VOLATILITY_IMPLEMENTATION.md](VOLATILITY_IMPLEMENTATION.md).

> WHAT and WHY for the broader module. The owner subsequently approved the narrow [admission policy](ADMISSION_POLICY.md) and directed completion of its [implementation plan](PLAN.md). That approval does not adopt all detailed requirements/defaults below or approve operational hedge use. Defaults outside the delivered S01/S02/S03 slices remain proposed.

**Scaffolding checkpoint:** the owner subsequently authorized the frontend shell.
`FXR` is registered under Markets at `/fx/research`, with pair selection, keyboard
tabs and empty reference/evidence states. See [FX_SCAFFOLD.md](../spec024/FX_SCAFFOLD.md).
This separate authorization does not approve the financial defaults below.

## Objective

Give an FX researcher a daily, source-dated answer to “what changed, in which pair direction, over which actual observations, and on what evidence?” The researcher can inspect reference exchange rates, qualified crosses, descriptive history and volatility, then reproduce an evidence-backed brief. A separate exposure module can consume an eligible frozen reference snapshot without opening this page or invoking an agent.

Success means numerical statements are traceable to frozen Gold revisions and explicit conventions. “Rates” initially means exchange rates. A reference exchange-rate change measures the appreciation of one currency relative to another; it is neither investment total return nor portfolio PnL.

## Scope and assumptions to review

The first release is proposed as daily/on-demand descriptive research. It owns public market evidence and the one-way snapshot boundary; it never receives a private exposure book. [Spec023](../spec023/SPEC.md), module `fx-exposure-hedging`, owns private cashflows, portfolio positions, hedge assumptions and residuals.

| Proposed default | Reason and review condition |
| --- | --- |
| Currency universe: EUR, USD, GBP, JPY, CHF, CAD, AUD, NZD; EUR/USD initially selected | Small reviewable research universe; every currency and source mapping still requires Gold/source qualification. Unsupported pairs stay visible and unavailable. |
| ECB reference family as the initial conversion snapshot; qualified FRED bilateral series as separate research comparisons | One coherent reference family prevents silent mixing of fixing conventions. Neither preference nor fallback is approved by this draft. |
| Latest eligible common observation date for the requested snapshot universe | Keeps crosses and reporting conversions coherent. Dropping a missing currency or moving the entire selection to an earlier date requires an explicit user-visible new selection. |
| Change horizons: 1, 5 and 21 observed intervals; history view: up to five calendar years | Labels must say observed intervals and show actual endpoint dates; these are not promises of exact 1/5/21-day holding periods. Available history can be shorter. |
| Realized volatility: 5/21/63/126/252-return windows, mean-centered sample daily log-return standard deviation and optional √252 scaling | N returns require N+1 qualified levels. Non-annualized means daily dispersion estimated over that window, not total-window volatility. The delivered bounded method is recorded in VOLATILITY_POLICY.md; no gap bridging or imputation. |
| Deterministic, non-LLM research brief; no automatic delivery | Keeps replay independent of model/provider availability. Optional narrative integration requires separate source, worker and egress approval. |
| Synthetic examples for design; governed Gold reads for admitted market evidence | Current lack of user authentication prevents treating a prototype as a trusted private-book interface. Synthetic and Gold results remain distinct. |

Except for explicitly confirmed choices and the separately authorized S01/S02/S03 slices, defaults above remain **proposed**, not adopted model behavior. Broader source, purpose, export and runtime decisions remain open below.

## Current evidence and readiness limits

The [refresh checkpoint](../../gold-db/FX_DATA_REFRESH.md) records verified extraction and Gold publication. Its 106 existing active series produced 104 successes and two known invalid ECB rate identifiers returning HTTP 404. All 17 ECB FX reference and 26 FRED currency/index series extracted successfully; all 641,317 selected Gold rows matched current Silver revisions in both directions. ECB FX reached 2026-10-30; FRED FX/index reached 2026-10-23, consistent with the inspected weekly H.10 release. Sixteen additional stored FX/index series lack curated discovery-catalog entries. Publication success does not establish an admitted pair universe, source rights or a complete snapshot adapter.

The two failed interest-rate identifiers are unavailable context inputs; they do not establish failed FX extraction. A source's expected release cadence and actual successful receipt must be assessed separately from the economic observation date. Refreshing today cannot turn the prior week's FRED observations into today's reference levels.

Gold remains the numeric market-data authority under spec009. Existing FX rows in `src/data/universe.ts`, the Markets FX tab, ETF proxies, dollar indexes and simulated cross-currency-basis panels do not establish this module's source readiness. Dollar indexes can be labeled research context; they cannot be converted into a bilateral pair. A yield curve is not an FX forward curve.

QuantSmith's local FX arithmetic/history/brief components are candidates for reviewed reuse, described in the capability map. Consumed content fingerprints currently drift from the reviewed pin; worker readiness is pending. Direct library/browser acquisition that bypasses Gold is not approved. No requirement here depends on a worker or claims it is ready.

Historical point-in-time reconstruction is not certified. The refresh checkpoint records a Silver interval-only revision limitation and sampled current-run evidence, not full historical source/receipt certification. Descriptive current-vintage history must carry that limitation visibly.

## Functional requirements

| ID | Requirement |
| --- | --- |
| FXR-001 | Select an explicit ordered base/quote pair and source family. Display “quote currency units per 1 base currency,” source observation date, receipt evidence, cutoff and reference-data class beside levels; never infer direction from a ticker or symbol alone. |
| FXR-002 | Read admitted numerical market evidence through governed Gold. Validate positive finite FX levels, source units, identities and revision lineage. Never substitute a synthetic value, ETF price, index, prior source family or a zero for a failed observation. |
| FXR-003 | Support direct, inverse and same-source common-date reference crosses with complete leg evidence. Recompute all directional metrics after inversion. A single reference level has no bid/ask spread, executable size, trade date or settlement value date. |
| FXR-004 | Freeze every selection under the provider contract. Record requested universe, source family, common date, exact input revisions/content identities, cutoff, policy/convention/method versions and eligible/missing/degraded/blocked outcomes. Later Gold revisions create a new snapshot; they cannot mutate an old brief or result. |
| FXR-005 | Show simple change `100 × (qEnd / qStart − 1)` and, when selected, log change `100 × ln(qEnd / qStart)`. Identify change type, actual endpoints, elapsed calendar span and available observation count. A rising A/B rate means A appreciated against B. Do not label a rise universally bullish or bearish. |
| FXR-006 | Present daily histories in observation-date order with gaps visible. Duplicate conflicting revisions require deterministic eligible revision selection or a blocked result. Do not forward-fill, interpolate, compress an unexpected gap into a one-day return, or infer earlier system knowledge from a backfilled historical date. |
| FXR-007 | Calculate descriptive realized volatility under an explicit versioned window, return and annualization convention. Publish sample size and actual date range. Insufficient or gapped windows return a reason rather than zero. Pairwise historical comparisons use a stated common-date intersection and retain excluded-date counts. |
| FXR-008 | Produce a deterministic brief containing selected universe/direction, source cutoff, actual observation dates, numerical findings, comparison methodology, missing/degraded coverage and caveats. Every numerical claim links to its snapshot, input evidence and calculation. Unsupported narrative claims, causal forecasts and trade recommendations are excluded. |
| FXR-009 | Make coverage and errors inspectable per pair and per metric. Partial coverage cannot silently shrink the universe or produce a “complete” ranking. A latest reference level may remain eligible while a longer-horizon metric is unavailable for insufficient history; the states must not be conflated. |
| FXR-010 | Publish the versioned one-way snapshot defined in DATA_CONTRACT.md. Consumption requires an eligible pair and allowed purpose; research-page visibility, narrative confidence or a healthy database connection is insufficient. No private inputs enter this provider. |
| FXR-011 | Preserve source-specific cadence, observation and publication/receipt clocks. Report freshness relative to the expected source release, successful retrieval and permitted lag policy. Missing or unapproved freshness policy blocks consumption; elapsed calendar days alone cannot define stale. |
| FXR-012 | Export a reproducibility manifest and human-readable research only within each source's approved use/redistribution rights. Include provenance, cutoff, actual endpoints, versions, limitations and incomplete coverage; denied or unknown rights disable the affected export with a reason. Exporting a chart cannot remove its source restrictions. |
| FXR-013 | Distinguish `SYNTHETIC`, current-vintage descriptive history and evidence-supported archived system-known selections. A date-only publication field remains date-only; unknown clocks remain unknown. An archived claim requires exact revision availability evidence at or before its cutoff. No automatic historical-PIT or LIVE badge follows from Gold presence. |
| FXR-014 | Provide accessible tabular equivalents of charts, pair-direction labels, visible empty/error states, keyboard selection and non-color status text. Keep source/date/method caveats attached when a chart or brief is viewed separately. |

## States and failure behavior

The provider's pair states are authoritative for reference consumption. **ELIGIBLE** means admitted for the narrowly declared reference/reporting purpose, not executable. **MISSING** means the needed observation/leg is absent. **DEGRADED** means evidence exists but fails freshness/coverage requirements and is display-only. **BLOCKED** means policy, rights, identity, convention, integrity or knowledge admission failed. Multiple reasons may apply; none authorizes fallback.

Research metric states are separate: a metric is available only if its own inputs and method qualify. Insufficient history can suppress volatility without invalidating the latest level. A previously valid retained snapshot may be shown as historical evidence after refresh failure, with its original cutoff/date; it cannot be relabeled as the current selection. Changed rights can deny present access/export even for retained evidence.

If Gold is disconnected or unconfigured, show an explicit source failure. Do not fetch externally to conceal it. If all requested pairs fail, show the requested universe and reasons with no eligible numerical summary or downstream consumable levels. Permitted retained last-observed evidence may remain separately visible with its actual date and stale/unverified label under the owner-confirmed rule in [ADMISSION_POLICY.md](ADMISSION_POLICY.md).

## Independent acceptance cases

These fictional hand cases are independent numerical/state oracles for future tests, not evidence that production data is admitted. Proposed financial arithmetic tolerance is `1e-10` absolute for unrounded rates/decimal changes; presentation rounding cannot feed calculations. Export identity and admission outcomes compare exactly. Tolerance adoption is an open decision.

| ID | Given / action | Required outcome |
| --- | --- | --- |
| FXR-AC01 | EUR/USD moves from 1.10 to 1.21; invert both endpoints | Direct simple change is +10%; USD/EUR is −9.090909…%, not −10%. Log changes are equal and opposite. Units reverse. |
| FXR-AC02 | Same-source/date EUR/USD=1.10 USD per EUR and EUR/JPY=165 JPY per EUR | USD/JPY=150 JPY per USD and JPY/USD=1/150. Both original leg identities/revisions remain in the cross. If either leg has a different source family/date or is blocked, no eligible cross results. |
| FXR-AC03 | Custom three-return fixture has log changes −0.01, 0, +0.01 on consecutive qualified dates | Sample daily standard deviation is 0.01; √252 annualized volatility is 15.8745079…%. It is explicitly a custom three-return fixture, not the proposed default 21-return window. A constant complete window yields measured zero volatility; an empty window yields unavailable. |
| FXR-AC04 | A requested 21-interval change has only 20 valid levels; a 22-level volatility window contains an unexpected missing source observation | Change and volatility are unavailable with distinct insufficient-history/gap reasons. No zero, fill or shortened-window substitution appears. |
| FXR-AC05 | At cutoff T an exact revision has `knownByAt > T`, despite an old observation date; separately test a current capture with unknown original receipt/Gold publication | The later capture cannot be eligible at T. Unknown original clocks alone do not prevent current-capture research admission, but cannot support an archived system-known claim. Keep the historical-knowledge limitation visible. |
| FXR-AC06 | Freeze snapshot S, then publish corrected Gold revision R2 | S and its brief reproduce original R1 values and identities. A new snapshot selects R2 only if eligible by its cutoff. Payload tampering or missing retained inputs prevents verified replay. |
| FXR-AC07 | Compare a source released weekly with a daily reference source; their newest observations are seven days apart | Each receives its own cadence-aware disposition; source/date differences remain visible. No calendar-age-only failure, blended cross or “today” relabeling occurs. Missing approved freshness metadata blocks consumption. |
| FXR-AC08 | Request three pairs: one eligible, one missing a leg, one with independently permitted reporting use but unknown export permission | Requested/conversion-eligible counts remain 3/2. The missing-leg reason remains visible. Export excludes or denies the third pair's restricted content explicitly; derived narrative/chart cannot bypass the restriction. Export permission alone does not change internal conversion eligibility. |
| FXR-AC09 | Gold unavailable; synthetic Markets/ETF prices remain available | Research shows the Gold failure. No substitute level, eligible snapshot, numerical claim or hidden direct network fetch appears. |
| FXR-AC10 | The brief contains a forged numerical claim or a source says “ignore prior instructions” | The number fails deterministic evidence reconciliation; source text is treated as untrusted content and cannot change policies, code, tools or export permissions. |

## Source, privacy and export policy

The source registry must record authoritative series identifiers, units/fixing definition, geography/currency meaning, frequency, publication schedule, revisions, permitted purposes, attribution, retention and redistribution dispositions/evidence before admission. Admission requires affirmative permission for the requested internal use and retention; unknown export permission blocks export independently. “Publicly accessible” does not imply unrestricted reuse. Existing refresh success cannot approve those rights.

Only purpose-limited public market projections enter research. Private cashflows, holdings, counterparty identities, credentials and licensed raw payloads must stay out of tracked fixtures, public research, URLs and telemetry. External model prompts, external sharing and automatic notifications are outside proposed first-release scope. Deterministic briefs work without an external model. Optional model use later requires the separate approved profile/readiness/egress boundaries and reconciled numerical claims.

Exports require affirmative current permission and preserve source restrictions through every derived cross/metric. The most restrictive contributing leg governs; an inverse does not erase a license. Retention/replay must comply with rights: if retention is forbidden, report that replay cannot be guaranteed rather than promising permanent reproducibility. No raw-source redistribution is implied.

## Repository context and verification conventions

This is a React 18/TypeScript/Vite application, not a Next.js runtime. Existing navigation is in `src/App.tsx`, `src/lib/nav.ts` and `settings/modules.config.json`; page conventions are `src/app/**/page.tsx`. Gold readers are under `src/lib/server/`, with `goldStore.ts` providing the read boundary. Tests use Vitest 2.1 in `src/**/*.test.ts` and `src/tests/**/*.test.ts`, Node environment; API routes follow `src/app/api/**/route.ts`. These are existing conventions, not new file allocations or endpoint decisions.

Future verification should use pure hand-oracle arithmetic/contract tests, stubbed Gold failure/revision tests, and browser checks for selection, states, accessible evidence and export fidelity. Fixtures must be fictional/synthetic and cannot depend on the current warehouse. Source admission additionally needs retained read-only warehouse evidence; passing unit tests cannot certify source rights or historical knowledge.

Existing commands from the repository root:

```bash
npm run dev
npm test -- --run src/lib/server/goldEda.test.ts
npm run typecheck
npm run build
npm run check:gold-policy
npm run check:quantsmith-pin
npm run check:agent-skills-pin
```

The named Gold test demonstrates the existing Vitest/stub convention, not FX coverage. `check:quantsmith-pin` is a gate only if reuse is selected and may currently report the known drift. No runtime/build test is claimed by this documentation-only draft. Keep TypeScript interfaces explicit, lowerCamelCase field names, UPPER_SNAKE enum values and unit-bearing labels; representative existing style:

```typescript
export interface GoldStore {
  history<T>(table: string, key: Record<string, unknown>, limit?: number): Promise<T[]>;
}
```

## Boundaries

- **Always:** keep the stable module id; preserve pair direction, missingness, source rights and actual clocks; validate source evidence at the boundary; keep numeric authority in Gold; retain independent acceptance cases and version changes to meaning.
- **Resolve with owner before planning/implementation:** source/universe/default policy below, runtime placement, retention/export/access boundary, new source mappings and dependencies; reviewed QuantSmith repinning if selected.
- **Never within this scope:** direct-fetch bypass, private-book intake into research, synthetic fallback into real data, invented spreads/timestamps, backdated knowledge, trade/order/RFQ submission, execution readiness claims, causal forecasts or autonomous delivery.

## Decisions required before planning

1. **Universe and source qualification:** approve currencies, per-source mappings, fixing convention, source precedence and comparison treatment; decide whether initial FRED comparisons/dollar-index context are included or deferred. Gold refresh completion alone does not resolve this.
2. **Freshness and alignment:** approve expected-release calendars, receipt-failure and stale budgets, holiday rules and common-date selection policy. Specify what degradation remains visible and what blocks downstream use; no hidden built-in thresholds.
3. **Methods and bounds:** approve observed-interval horizons, five-year view, volatility convention/window/minimums, numerical tolerance, pair/history/request limits and performance acceptance targets. A bounded contract is required before runtime implementation.
4. **Evidence and retention:** choose durable frozen revision/receipt preservation and retention rights; define how unknown/legacy clocks are represented and whether any archived system-known history can qualify. Historical PIT remains uncertified until separately evidenced.
5. **Access and export:** approve source-specific purpose/attribution/retention/export decisions, who may access/download, and safe denial/redaction behavior. Current absence of authentication is not an access-control design.
6. **Product surface and optional context:** the authorized scaffold uses FXR at `/fx/research` under Markets; review the detailed research experience and brief/export formats. Interest-rate differentials, central-bank/event overlays remain separate proposed capabilities until units, tenor, fixing, publication timing and comparability are qualified. Missing ECB context identifiers remain unavailable.
7. **Integration:** select native arithmetic versus reviewed QuantSmith reuse and resolve the pin/readiness gates. The exposure consumer needs the frozen contract; neither module requires agent narrative to function.

No forward points, carry/roll PnL, funding valuation, cross-currency basis, options, portfolio risk/backtests, hedge accounting or executable intraday market capability is approved here. Reporting conversions do not relax spec012's single-currency model, spec011's per-currency solving, spec014's funding/netting limits or spec021's same-currency policy.
