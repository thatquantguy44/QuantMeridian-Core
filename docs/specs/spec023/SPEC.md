# Spec023: FX Exposure & Hedging

- **ID:** spec023-fx-exposure-hedging
- **Stable module id:** `fx-exposure-hedging`
- **Status:** Draft for owner review; detailed policy and implementation are not approved
- **Owner / approver:** Joshua Lutkemuller
- **Last updated:** 2026-10-30
- **Scope authority:** [FX capability map](../../../FX_CAPABILITY_MAP.md)
- **Provider dependency:** [spec022 FX Research](../spec022/SPEC.md) and its [versioned snapshot contract](../spec022/DATA_CONTRACT.md)

> This document defines WHAT and WHY. The owner confirmed the two-module split, inclusion of **both dated cashflows and portfolio positions in the first release**, and category coverage of **cash, equities/ETFs and bonds, plus existing FX hedges**, then authorized parallel specification work. Cash balances are included. These confirmations do not approve every subtype, valuation/exposure methodology, look-through, hedge policy, private-data intake, implementation plan or runtime change. All detailed defaults below are **proposals for review**. Unresolved decisions must not become implicit model behavior.

**Scaffolding checkpoint:** the owner separately authorized the frontend shell.
`FXH` is registered under Financing at `/fx/exposure-hedging`, with local workspace
navigation, reporting-currency preference and explicit empty states. See
[FX_SCAFFOLD.md](../spec024/FX_SCAFFOLD.md). Financial calculations and private intake are
not connected or approved by that shell authorization.

## Objective

Help a treasury or portfolio user explain which currencies a selected book is exposed to, which records and assumptions produce that exposure, how explicit FX shocks change its reporting-currency translation, and what an indicative offset would leave outstanding. A reviewer must be able to reconstruct the signed original exposures, existing hedges, proposed legs and residuals without access to a research narrative.

Success means that both first-release input paths work: a dated contracted/forecast cashflow book and a portfolio-position book, covering cash balances, equities/ETFs, bonds and existing FX hedges under reviewed methods. Users can distinguish a position's denomination from a supplied economic currency attribution, identify missing or unsupported exposures, and avoid counting a position and its related cashflows twice. A complete-looking total that silently omits an instrument, date, entity or unavailable conversion is a failure.

The module consumes a frozen public FX snapshot from `fx-research`; private book data stays in a separate trust boundary. Research does not depend on this module, and opening the research page is not a prerequisite for a calculation.

## Current evidence and limitations

- The terminal has no implemented dedicated exposure/hedging workflow or approved private-book input contract. Existing Markets FX, ETF proxies and SIM basis panels do not establish eligible currency exposure or hedge prices.
- The [Gold refresh checkpoint](../../gold-db/FX_DATA_REFRESH.md) records verified extraction and Gold publication: 104 successful series, two unavailable rate identifiers and zero differences between selected Gold rows and current Silver revisions. Sixteen stored FX/index series still need curated catalog metadata. Publication success does not approve snapshot admission, source-use rights, historical system knowledge or private-book readiness.
- The local QuantSmith reference-hedging helper can construct **signed net currency cash offsets using reference rates**. Dated cashflow eligibility, portfolio derivation, counting rules, existing hedge allocation, privacy and reconciliation are new product gaps. Its spot/calendar utilities require supplied evidence; they are not a general settlement-calendar service.
- The consumed local QuantSmith copy differs from the [reviewed pin](../spec005/QUANTSMITH_PIN.md), and the relevant [spec009 readiness work](../spec009/TASKS.md) remains pending. Candidate reuse needs separate source review/re-pinning and acceptance; this draft makes no library or worker readiness claim.
- Real private inputs require trusted access, data handling and export controls. The terminal currently lacks production user authentication. Initial design and verification must use fictional, labeled synthetic books until that boundary is approved and demonstrated.

## Confirmed scope, proposed scope and exclusions

| Classification | Scope |
|---|---|
| Owner confirmed | Two separate modules; dated cashflows **and** portfolio positions in the first exposure release; **cash, equities/ETFs and bonds, plus existing FX hedges** as covered categories. Cash balances are included. Portfolio support must not be moved to a later release. The one-way snapshot dependency is the proposed boundary under review. |
| Proposed first-release behavior | Manual/CSV input with explicit revisions; source-supplied position values and optional separately labeled economic attribution; signed dated flows; existing paired currency obligations; reporting translation; deterministic FX-only scenarios; user-set indicative offset ratios; reconciliation and governed exports. |
| Proposed cash measurement | Signed native cash balances with a balance as-of time/source, separate from dated flows and reconciled against position-related settlement/proceeds. Cash inclusion is confirmed; measurement/counting details remain open. |
| Open instrument policy | Supported subtypes and exposure/valuation methods within the confirmed categories, treatment of instruments outside them, and what supplied evidence is sufficient. Existing FX hedge coverage is not blanket derivative pricing/risk coverage or full look-through. |
| Outside this proposed release | Execution/RFQs/orders, settlement instructions, automated rebalancing, optimal hedge selection, constrained optimization, forward/roll pricing, curves/carry/basis, transaction costs, option valuation/Greeks, VaR, security total-return modeling, accounting designations or hedge-effectiveness certification. |

Reference offsets are indicative currency arithmetic. A future date attached to an exposure or proposed leg does not turn a reference-rate offset into an executable or maturity-matched forward hedge. No change is authorized to spec011 per-currency solving, spec012's single-currency model, spec014 cross-currency funding/netting gates, or spec021 same-currency re-rate rules.

## User workflow and presentation requirements

1. Select a book revision, exposure as-of, reporting currency, analysis view, explicit counting/netting policy, and eligible frozen FX snapshot. Show private-input and market-data dates independently.
2. Review intake validation and a coverage ledger before any aggregate: included, deliberately excluded by counting policy, unsupported, unvalued, unavailable conversion and unresolved relationship records, with reasons.
3. Inspect positions and dated flows separately, then drill from each native-currency subtotal to its source records. Contracted and forecast flows remain distinguishable. Broad totals are descriptive and do not grant permission to net.
4. Inspect existing hedges as signed paired legs and their exact allocations. Select a proposed ratio against the remaining eligible exposure and review both proposed legs, countercurrency amounts, residuals, scenario assumptions and limitations.
5. Compare original, existing-hedged and proposed-residual FX-only translation scenarios. Explicitly download an entitled result and lineage manifest through the governed export boundary.

The UI must keep currency units, signs, date/as-of, view/method, source age, coverage state and indicative labels visible alongside material figures. Missing values are textual unavailable states, not zero or a blank that resembles zero. Date buckets may aid display but must not authorize netting. Filters must identify when the displayed subset differs from the analyzed book. Route, navigation code and exact layout remain open.

## Input and ownership contracts

### Public FX input

The provider owns its schema and evidence semantics. Consume [snapshot envelope](../spec022/DATA_CONTRACT.md#snapshot-envelope), [pair result](../spec022/DATA_CONTRACT.md#pair-result), [evidence and clocks](../spec022/DATA_CONTRACT.md#evidence-and-clocks), and [admission/consumer rules](../spec022/DATA_CONTRACT.md#admission-and-consumer-rules); do not define a parallel provider schema here.

Each run pins the provider's contract/snapshot identity, cutoff, convention/method/selection/freshness policy identities, source set/common observation date, knowledge basis and exact eligible pair evidence. Only an `ELIGIBLE` result permitted for `REPORTING_CONVERSION` may supply a consumable level; research eligibility alone is insufficient. A degraded last observation is display context only. Conversion from currency C to reporting currency R requires the eligible C/R reference level, expressed as **R per one C**, under the provider's source/cross rules. This consumer cannot invert, cross, mix sources or observation dates, forward-fill, override freshness or invent eligibility outside that boundary. For C = R, identity conversion is arithmetic at 1, explicitly not a sourced market observation.

Provider observation dates are not position valuation dates, cashflow dates, forward value dates or proof that a historical book could have known the rate. A current-vintage import cannot be labeled a historically available decision. A frozen reference snapshot supports reporting conversion only; it supplies no executable spread or instrument readiness. Source-use restrictions apply to derived views and exports as well as raw observations.

**Proposed input-classification policy:** fully synthetic verification uses a fictional book and a `SYNTHETIC` market snapshot by default. A synthetic-book demonstration with real Gold reference evidence requires explicit approval/selection of that mode; retain separate fictional-book and actual market provenance, and label the book and resulting exposure analysis synthetic. It cannot establish real-book or operational hedge readiness. A `SYNTHETIC` market snapshot is never permitted as real-book reporting evidence. The final permitted combination matrix remains open in FXE-D07; no mixed-input permission follows from this draft alone.

### Private book envelope — proposed consumer-owned semantics

These are required meanings for a future typed contract, not a final CSV schema or an API route design. Every input revision must have an immutable book identity, revision/content identity, declared synthetic/private classification, producer/source, actual receipt evidence, exposure as-of, and explicit record selection. Corrections create new revisions. A run pins one revision and cannot silently substitute newer data. Exact same-revision/content replay is safe; reusing its identity with different content fails.

Every record has a stable namespaced record ID, entity ID, book ID, explicit netting-scope ID, source/effective evidence and record kind. Currency codes, units, sign conventions, valuation basis and dates are validated at intake. Neither a currency nor a shared parent name establishes an entity or netting scope. Free text cannot override typed policy or be executed as instructions.

| Record kind | Required meaning / distinctions |
|---|---|
| Dated cashflow | Signed native amount/currency, contracted versus forecast, due date or an explicitly unresolved date/window, certainty/source evidence, and optional linked position/economic-component ID. Positive means receipt/asset entitlement; negative means payment/obligation. Forecast amounts remain gross stated amounts, without hidden probability weighting. An unresolved date remains visible but cannot enter exact-date netting or a dated proposal. |
| Portfolio position | Instrument/security and position IDs, instrument classification, signed holding/long-short convention, denomination currency, supplied signed market value in a named valuation currency, valuation as-of/source, and clean/dirty/accrual basis when applicable. Quantity, notional, price and market value have distinct units; quantity/notional alone cannot become an FX amount. Missing valuation can be retained as `UNVALUED`; contradictory or nonfinite supplied values are invalid. |
| Supplied economic attribution | Explicit per-currency signed exposure amounts, units, effective/valuation dates, producer/method identity, coverage and position/component links. Distinguish a decomposition of supplied market value from sensitivity/delta-equivalent risk. A value decomposition must reconcile to supplied position value at the pinned rates within the approved tolerance; sensitivity vectors need not, and must never be summed into market-value totals. |
| Existing FX hedge | Stable hedge ID, instrument/type, entity/book/netting scope, source/as-of and explicit allocation to exposure groups/components. Proposed fixed-obligation representation: two signed currency legs with stable leg IDs, actual contracted native amounts and due/settlement dates; actual counterleg terms remain supplied values, not recomputed from today's reference rate. Unsupported/contingent methods remain visible rather than fabricating fixed legs. Subtype/method coverage is open. |
| Cash balance | Signed native amount/currency, account/balance identity, balance as-of and source. Cash inclusion is confirmed. It is a stock exposure, not an undated forecast or a duplicate of already-settled position proceeds. |

Malformed values, invalid currencies/dates, duplicate IDs, ambiguous identities, supplied links to nonexistent IDs and inconsistent revisions reject the submitted revision with field/row reasons; do not silently deduplicate or partially promote it. An explicitly declared unresolved relationship is a valid unavailable state, distinct from a broken claimed link. Hedge IDs may group distinct leg IDs, but each leg is unique. A structurally valid unsupported instrument or missing valuation is retained in the coverage ledger with its original record identity and reason. No unsupported record is discarded or assigned zero exposure.

Private records, rejected payloads and derived books never enter the public Gold market-data store. Exact upload headers, allowed formats/size, retention and error-code schema require approval before implementation.

## Exposure measurement and counting rules — proposed

### Instrument and method boundary

The owner confirmed first-release categories of **cash, equities/ETFs and bonds, plus existing FX hedges**. The detailed subtype/method matrix still requires approval; category coverage does not establish full valuation or risk coverage for every instrument in it. Proposed measurement is signed native cash balances, supplied equity/ETF/bond valuations, and supplied fixed paired obligations where applicable for existing FX hedges. Proposed ETF treatment is denomination/valuation-currency translation without automatic look-through. For each admitted subtype, record supported valuation basis, permitted attribution method, required evidence and unsupported cases. Fund denomination is not underlying currency look-through; issuer domicile, exchange, ticker, security notional or trading currency must not fabricate economic FX exposure. No broader pooled-fund category is approved by the ETF confirmation.

Two separately named views are proposed:

- **Value translation:** use a supplied signed native/valuation-currency market value and eligible conversion. State exactly which currency the value belongs to. Hold that supplied value fixed for FX-only scenarios. Display denomination separately when it differs from valuation currency. This measures translation under an assumption, not total economic risk.
- **Supplied economic FX attribution:** accept approved, dated, source/method-labeled currency components. A supplied value allocation and a supplied sensitivity vector are separate subtypes with separate totals/scenario eligibility. No calculated security valuation, automatic look-through, delta extraction or derivative decomposition is implied. Until approved sensitivity units and shock rules exist, sensitivity inputs are visible but scenario/proposal-ineligible.

Approval of portfolio inputs and existing FX hedges does not approve all derivatives or their valuation methods. Proposed treatment is to retain options, swaps, structured products and other uncovered methods visibly as unsupported for calculated FX risk, including an existing FX hedge whose contingent risk cannot be represented by the reviewed method. An FX forward may be represented as supplied signed dated obligations for an existing-hedge ledger, without repricing it. Its notional and mark-to-market must not both be counted as independent FX exposures. Which hedge subtypes and supplied derivative attributions are method-eligible remains an open instrument/method decision; the category itself is confirmed.

### Separate stock and flow questions

A position is a stock at valuation as-of; a cashflow is a dated receipt/payment. A dirty bond value can already include accrued interest, and redemption principal or sale proceeds can replace the stock rather than add new wealth. First release must support both questions without automatically adding the books together.

**Proposed conservative default:** position translation and dated cashflow exposure are separate ledgers; there is no default combined stock-plus-flow exposure or combined hedge proposal. A flow linked to a position remains visible in its flow view and identifies whether it represents principal/proceeds, income, settlement or another component. Independent operating flows remain identifiable. Unresolved links/classifications block a combined analysis rather than infer independence.

Any future approved combined view requires an explicit, versioned component inclusion/exclusion rule and reconciliation bridge. Each economic component can contribute once to a chosen measure. Excluded related flows remain visible with the counted position/component and exclusion reason; unrelated contracted and forecast flows cannot be discarded as presumed duplicates. Alternative views of the same position (denomination versus economic attribution) are never additive.

### Netting and aggregation

Proposed eligible groups are keyed by analysis view/method, entity, book, explicit netting-scope ID, native currency, and **exact due date for flows** or **the selected valuation as-of for stocks**, with contracted/forecast class separate. A display maturity bucket is not a netting group. Different dates, entities, books, scopes, certainty classes and stock/flow ledgers remain separate by default, even when amounts offset.

Display gross positive, gross negative, signed net and the membership of every eligible group. Native amounts aggregate only within the same currency. Reporting-currency summaries may span groups for description, but retain group coverage and gross contributions and cannot authorize an offset across them. Unknown scope/date disables the affected proposal; it must not default to a global netting set. A broader cash management or portfolio netting policy requires explicit approval and its own version.

For each included currency component, reporting translation is `V_R = A_C × r(C,R)` with signed native amount `A_C`. A short exposure remains negative. Reporting-currency components translate at identity and remain visible even though they need no FX conversion. A zero net with nonzero gross exposures is displayed as such; it is not evidence that dates/obligations have disappeared.

## Existing hedges, indicative proposals and reconciliation — proposed

Existing hedges affect only explicitly allocated, compatible groups. Both legs are preserved, including a reporting-currency counterleg associated with that group's entity/date/scope context; the counterleg is not expected to share the foreign currency of the target group. Allocations must conserve each leg's signed amount and cannot reuse it across groups; unknown, incompatible or overallocated links block affected residual/proposal results. Unallocated existing hedges stay visible separately and make an existing-hedged whole-book measure incomplete when their intended treatment is unresolved; they do not prevent an otherwise complete original-exposure measure. Cross-entity or cross-date hedges are not inferred from matching currencies. Overhedged groups remain signed and flagged; residuals are never clamped to zero.

For one approved group/currency, let `X_C` be original included exposure, `H_C` the allocated existing-hedge leg, and `Y_C = X_C + H_C` the remaining exposure. The proposed user ratio `h ∈ [0,1]` applies **to Y_C after existing hedges**, not implicitly to original X_C. State that denominator next to the control. A separate original-exposure coverage ratio, if shown, is undefined for zero/ambiguous denominators and must not replace the signed ledger.

For C different from R, an indicative proposal has `P_C = −h × Y_C` and `P_R = −P_C × r(C,R)`. It therefore sells positive foreign residuals and buys negative foreign residuals; both legs have equal and opposite reporting value at the selected reference level. Residual native amounts reconcile by currency as `Z = X + H + P`, including reporting-currency legs. Display `X`, `H`, `Y`, `P` and `Z` separately, and `Z_C = (1−h)Y_C` for the proposed eligible leg.

This proposed ratio does not select an optimal hedge, close an existing contract or create an executable trade. If an existing hedge leaves a reversed exposure, an offset of that reversed residual is a new illustrative opposite position, flagged for review; do not silently label it an unwind. For h = 0 no new legs are generated; h = 1 removes the eligible foreign residual in this arithmetic while preserving its reporting-currency counterlegs and any unresolved groups.

Attach target exposure/date context to a proposal without fabricating value-date calendars, discount factors, spreads, forward points or costs. A reference offset of a future flow remains explicitly indicative. Existing contract legs can have nonzero reference-translated value today; do not reset their actual counterleg to force a zero value. Neither this value nor a scenario change is a contractual mark-to-market or a hedge-effectiveness result.

## Scenario contract — proposed

Use deterministic, user-entered percentage shocks to the **C/R reference conversion vector**, with R fixed at identity. The proposed first defaults are parallel foreign-currency shocks of −10%, 0%, +10%, editable before a run; shock bounds and final defaults remain open. Reject nonfinite shocks and `s_C ≤ −1`. State `r'(C,R) = r(C,R) × (1+s_C)` and the exact currency/direction beside each scenario.

Keep native exposure amounts, supplied position values and supplied existing/proposed leg amounts fixed. Recompute translation under the shocked vector. Any displayed inverse is its exact reciprocal; any cross is derived consistently from that vector and clearly labeled scenario arithmetic, not a new source observation. Do not apply independently contradictory pair shocks. An unchanged currency has an explicit zero shock; an unavailable required conversion remains unavailable under every scenario.

For each ledger stage show baseline reporting value, shocked reporting value and signed difference. These are **FX-only translation changes under fixed inputs**: no security-price movement, total-return/PnL forecast, forward repricing, carry, discounting, forecast probability, hedge accounting or stochastic risk claim. The same shocks can apply to separate dates for comparison; they are not a term structure or simulated future path. Supplied economic sensitivity/nonlinear instruments require a separately approved method before this scenario is extended to them.

## Coverage, errors and replay

Each source record and requested output has an explicit status and reason. The proposed consumer statuses are `COMPLETE`, `PARTIAL`, `BLOCKED` for aggregates, with row-level included/excluded/unsupported/unvalued/unavailable/unresolved dispositions. These are consumer result states, not replacements for provider admission states.

- **Complete:** every in-scope component is accounted for, including deliberate exclusions with reconciled links; every dependency needed by that measure is eligible.
- **Partial:** at least one group can be calculated and at least one in-scope component/group is unresolved or unavailable. Show only a labeled covered subtotal, its membership, excluded/unknown counts and reasons. Do not label it total book exposure, fully hedged or zero risk. Missing valuation prevents an economic-value coverage percentage; row counts are not a value-coverage substitute.
- **Blocked:** no valid covered result exists for that requested measure, or structural validation/counting/allocation ambiguity prevents a safe result. Keep the original book/diagnostic ledger visible within entitlements. A flow view may remain usable when an independent position view is blocked and vice versa.

Blocked inputs propagate to dependent conversion, scenario, allocation and proposal outputs; independently eligible groups remain reviewable. A proposal for a partial book must identify exactly the covered groups, require deliberate subset selection and be labeled a partial indicative proposal. There is no automatic whole-book hedge or executable action.

Each result must pin book revision/content identity, record and relationship membership, exposure/valuation as-ofs, provider snapshot/cutoff and evidence references, reporting currency, view/instrument/counting/netting policy versions, existing-hedge allocations, ratios, scenario definitions and calculation/precision version. Same frozen inputs/settings reproduce the same result regardless of newer Gold revisions or current UI state. Unavailable archived/entitled evidence yields a replay-unavailable reason; do not fetch latest and call it a replay.

## Trusted access and export boundary

Before real private intake, approve and demonstrate authenticated server-side access, permitted book/entity/field/action/export scopes, retention/deletion, audit policy and an explicit deployment trust boundary. A local UI selector is not production identity. Until then the module must reject real-book mode and use labeled fictional examples; do not put private records in tracked fixtures, browser bundles or public snapshots.

From initial intake, raw/rejected/normalized private inputs, linked exposures and derived results remain inside the approved boundary. No external model-service egress by default, including prompts, diagnostics, telemetry or worker/narrative payloads. Any optional model/worker integration needs its own explicit approval and proof that its data path respects the boundary; no model call is required for deterministic exposure arithmetic.

Exports are explicit authorized user actions with field/row entitlements and source-use review applied again at download time. They must include permitted native rows, group/leg/residual reconciliation, settings, coverage/reasons, indicative disclosures and a lineage manifest. Deny or visibly withhold restricted fields/source payloads, prevent spreadsheet-formula execution from untrusted text, and record the export action without leaking raw books to logs. If restrictions prevent full portable replay, label the package accordingly and identify which entitled in-boundary evidence is required; a hash alone is not a replay dataset.

## Functional requirements

All requirements below are draft acceptance requirements, subject to the open decisions; priority “must” is proposed release necessity, not approval of its defaults.

| ID | Requirement | Priority |
|---|---|---|
| FXE-001 | Accept and version both dated cashflow and portfolio input paths in the first release, including confirmed cash, equities/ETFs, bonds and existing FX hedge categories under reviewed methods, preserving signed native amounts, identities, provenance and independent as-of clocks. | must |
| FXE-002 | Validate revisions atomically; reject invalid/nonfinite values, duplicate/ambiguous IDs and broken relationships with actionable row/field reasons. Preserve valid unsupported/unvalued inputs visibly. | must |
| FXE-003 | Apply an approved instrument/method matrix; distinguish supplied valuation, denomination translation, supplied economic attribution, and unsupported risk without inferred look-through. | must |
| FXE-004 | Keep stock/flow and contracted/forecast measures separate; reconcile linked economic components under an explicit versioned counting policy. | must |
| FXE-005 | Consume only eligible frozen spec022 conversion evidence and preserve its cutoff, knowledge basis, conventions, lineage, quality and source-use restrictions. | must |
| FXE-006 | Show gross and signed exposure with explicit same-currency/group membership; prohibit inferred cross-entity/date/scope netting. | must |
| FXE-007 | Preserve signed existing hedge legs/terms, enforce allocation conservation, and expose unallocated, reversed and unresolved residuals. | must |
| FXE-008 | Produce user-controlled indicative paired reference offsets for eligible groups, with explicit residual-based ratio semantics, counterlegs and complete native/reporting reconciliation. | must |
| FXE-009 | Compare original, existing-hedged and proposed residuals under versioned, direction-consistent FX-only scenarios with assumptions and excluded risks. | must |
| FXE-010 | Propagate unavailable dependencies; distinguish covered subtotals from complete results and block ambiguous whole-book claims/proposals. | must |
| FXE-011 | Reproduce a calculation from pinned private/market revisions and policy/settings; expose replay failure without latest-data substitution. | must |
| FXE-012 | Enforce trusted private access and default egress denial before real books; restrict exports by both private entitlements and market-source rights. | must |
| FXE-013 | Keep every material amount's units, method, dates, coverage, source and indicative classification inspectable in the UI and exports. | must |
| FXE-014 | Preserve all existing modules' funding/netting/currency gates; require separate review for library reuse, worker integration, forward/derivative models or execution. | must |

## Acceptance criteria

The numerical fixtures below are fictional and use supplied eligible reference evidence. Values are exact at the shown precision; general precision and reconciliation tolerance require approval. Each case must be verified at the calculation boundary and through the user-visible coverage/lineage/export flow where applicable.

| ID | Testable result |
|---|---|
| FXE-AC01 — direct signed translation | At EUR/USD = 1.10 USD per EUR, cash balances of EUR +1,000 translate to USD +1,100 and EUR −200 to USD −220. A USD +50 balance translates at identity. EUR/USD versus its inverse cannot change the result when approved provider evidence is used correctly. Balance as-of/source remain visible; no quantity/notional is silently interpreted as market value. |
| FXE-AC02 — portfolio first release | A supplied EUR +2,000 value on a long equity and EUR −500 on a short bond translate to USD +2,200 and −550. A EUR-denominated ETF with USD valuation is labeled with both currencies; denomination does not manufacture EUR economic exposure. An unsupported option and an unvalued position remain counted in the ledger; the portfolio total is partial/blocked as appropriate, never a complete USD +1,650 book. |
| FXE-AC03 — economic attribution | A supplied value allocation of EUR 600 and GBP 400 at EUR/USD 1.10 and GBP/USD 1.25 reconciles to a supplied USD 1,160 position value. A USD 1,200 supplied value fails the approved reconciliation rule. A delta-equivalent vector is labeled sensitivity and does not join that market-value total or receive translation-scenario/proposal eligibility without its approved method. |
| FXE-AC04 — counting | A EUR 1,000 position and linked EUR 1,000 redemption appear in separate stock/flow views; no default EUR 2,000 combined proposal exists. A related coupon has an explicit component/valuation-basis relationship. An unresolved relationship blocks a combined measure; a reviewed exclusion names the counted component and remains visible. |
| FXE-AC05 — date/entity/forecast isolation | EUR +100 due Nov 2 and EUR −100 due Dec 2 remain separate despite a descriptive net zero. Identical-date flows in different entities/scopes or contracted versus forecast classes do not net by default. A missing due date remains visible and dated-proposal-ineligible. Displaying a common month bucket changes no membership. |
| FXE-AC06 — existing/proposed signed legs | For a same-group EUR +1,000 flow, existing legs EUR −400 / USD +430, r = 1.10 and h = 0.5 of the remaining EUR +600: propose EUR −300 / USD +330. Residual is EUR +300 / USD +760; its baseline USD value is 1,090, equal to original 1,100 plus existing −10 plus proposal zero. Actual USD +430 is never replaced by +440. |
| FXE-AC07 — negative/zero/full/reversed | For EUR −200 with no existing hedge, r = 1.10 and h = 0.5, propose EUR +100 / USD −110, leaving EUR −100 / USD −110. h = 0 generates no legs; h = 1 leaves zero eligible foreign amount while retaining reporting legs. Existing EUR −1,200 against EUR +1,000 leaves EUR −200 with an overhedged flag; it is never clamped to zero or called an executed unwind. Zero original exposure yields no fabricated coverage percentage. |
| FXE-AC08 — scenario arithmetic | Shock EUR/USD +10% from 1.10 to 1.21 in AC06, with every native leg fixed. Original translation changes by USD +110; after existing hedge by +66; after proposal by +33, from 1,090 to 1,123. Inverse equals 1/1.21. Labels state FX-only translation, without forward MTM, investment PnL or effectiveness claims. |
| FXE-AC09 — partial versus blocked | An eligible EUR group and an unavailable JPY conversion show original EUR/JPY rows and a labeled EUR covered subtotal; JPY translation/scenario/proposal is unavailable. Selecting only JPY blocks that measure. A stale last-observed JPY level, unknown scope or unsupported instrument cannot be zero-filled, omitted, or used to make the book appear fully hedged. |
| FXE-AC10 — hedge allocation | Allocating EUR −400 twice fails conservation. Incompatible date/entity scope and explicitly unresolved target relationships block affected residuals. A claimed paired hedge missing a counterleg, a duplicate leg ID or a claimed link to a nonexistent ID rejects revision promotion. An unallocated hedge stays visible without reducing unrelated groups. Both legs and all allocations remain traceable in exports. |
| FXE-AC11 — revision and replay | Duplicate IDs/nonfinite input reject promotion with row reasons. Same revision/content/settings replay identically; identity reuse with changed content fails. A later source correction does not change a pinned result. Missing archived evidence returns replay unavailable; today's historical import never proves knowledge at an earlier cutoff. |
| FXE-AC12 — access/egress/export | Without the approved real-input access boundary, real-book mode is rejected. Synthetic market evidence cannot feed real-book reporting. Synthetic examples remain labeled; any separately approved fictional-book/real-Gold demo labels its resulting book analysis synthetic and preserves actual market provenance. Unauthorized book/field/export access is denied server-side; rejected records/diagnostics do not leak to external models or logs. An authorized export contains permitted lineage and limitations, escapes formula-like text, and visibly identifies source-rights omissions and any resulting replay limitation. |
| FXE-AC13 — regression boundary | Existing spec011/012/014/021 currency/netting behavior is unchanged. No page, export, proposal or worker output represents the offset as an order, funding authorization, executable forward, accounting designation or optimized hedge. |

## Verification context and repository boundaries

This phase creates a specification only. No implementation files, schemas, DB writes, navigation, provider acquisition or service wiring are authorized by this draft. Existing application conventions are React/TypeScript with Vite, `src/` application code, Vitest tests and numbered documents under `docs/specs/`; final source/test locations and interface schemas belong to the later reviewed plan. Future boundary contracts must use explicit record/result variants and one consistent structured validation-error format, following existing camelCase TypeScript conventions rather than an unreviewed alternate contract.

Available repository commands are `npm run check:agent-skills-pin`, `npm run typecheck`, `npm test -- --reporter=dot`, and `npm run build`. The pin check verifies the immutable skill snapshot; application commands do not prove an unimplemented FX workflow. Later implementation must use signed hand fixtures, identity/counting/allocation failure cases, provider contract tests, privacy/egress tests, deterministic replay and UI/export checks against the accepted criteria. Do not add tests that merely assert this document exists.

- **Always:** preserve approved module boundaries and source authority; label provisional policy; use synthetic fixtures until private access is approved; retain missing/unsupported rows; verify native/reporting and hedge-leg reconciliation.
- **Review before enabling:** any instrument/method or broader netting/counting policy, real data intake/export, schema/dependency change, QuantSmith re-pin, worker/model data path, forward/option model, optimization or execution capability.
- **Never:** alter pinned `.agents/` content incidentally; commit private books/credentials/licensed payloads; invent source dates or rates; silently zero/drop exposures; relax another module's currency gates; present reference arithmetic as executable pricing or realized effectiveness.

## Decisions required before implementation

| ID | Decision / proposed default | Why it matters |
|---|---|---|
| FXE-D01 | Approve detailed subtypes and methods within the confirmed **cash, equities/ETFs, bonds and existing FX hedge** categories. Proposed: signed native balances, supplied equity/ETF/bond values, ETF translation without look-through, fixed paired FX obligations where applicable; uncovered methods stay visible unsupported. **Category coverage and both cashflow/portfolio paths are already confirmed.** Economic attribution, security/hedge pricing and contingent derivative methods remain open. | Defines meaningful portfolio coverage without silently narrowing confirmed categories or promising every subtype/method. |
| FXE-D02 | Approve value-translation versus supplied economic-attribution methods, accepted producers/units, valuation/accrual basis and reconciliation tolerance. Proposed: supplied valuations only; no automatic security pricing, risk derivation or look-through. | Denomination, fair value and economic sensitivity answer different questions. |
| FXE-D03 | Approve separate stock/flow ledgers and no default combined total; define related principal/income/settlement component rules if a combined view is required. | Prevents duplicate exposure and duplicate hedge proposals. |
| FXE-D04 | Approve exact-date/same-entity/book/scope/class netting and no cross-group proposal inference; choose display horizons/buckets and treatment of uncertain date windows. | A convenient display total is not a hedgeable net obligation. |
| FXE-D05 | Approve existing-hedge instrument/leg/allocation rules, treatment of unallocated/overhedged positions, and residual-based ratios in [0,1]. Proposed: no hidden forecast weighting or automatic unwind. | Defines the denominator and keeps existing contract terms intact. |
| FXE-D06 | Approve scenario currency basis, supported attribution types, bounds and defaults. Proposed: fixed-input C/R shocks at −10%, 0%, +10%, with exact inverse/cross consistency. | Prevents false repricing/PnL claims and contradictory scenarios. |
| FXE-D07 | Approve cash-balance measurement/counting details, manual/CSV formats/limits, reporting-currency universe, input as-of alignment/freshness, decimal/rounding tolerance and the synthetic/real input-classification matrix. **Cash inclusion is confirmed.** Proposed: fully synthetic verification by default; any fictional-book/real-Gold demo is an explicitly selected synthetic result with separate market provenance; synthetic rates never support real-book reporting. | Detailed methods and input-classification permissions are not implied by confirmed category coverage or Gold coverage. |
| FXE-D08 | Approve deployment trust/access model, book/field/export scopes, retention and source-use policy before real private intake. Proposed: synthetic-only until demonstrated; no external model egress by default. | Current lack of authentication cannot protect real books. |
| FXE-D09 | The authorized scaffold uses FXH at `/fx/exposure-hedging` under Financing. Review detailed workflows, partial-subset proposal confirmation, export/replay rules and performance/data-size targets. | Needed for usable and reviewable workflows without unstated operational limits. |
| FXE-D10 | Confirm spec022 snapshot contract compatibility and admission/use restrictions; separately review QuantSmith drift/readiness if reuse is chosen. | Published Gold and eligible evidence, not extraction/library availability, determine calculation readiness. |

## Decision log

| Date | Decision | Authority |
|---|---|---|
| 2026-10-30 | Use separate `fx-research` and `fx-exposure-hedging` modules. | Owner; capability map |
| 2026-10-30 | Propose a one-way versioned public snapshot boundary owned by research. | Draft capability map/specification proposal |
| 2026-10-30 | Include **dated cashflows and portfolio positions in the first release**; prepare the two specifications in parallel while Gold refresh proceeds. | Owner; capability map |
| 2026-10-30 | Cover **cash, equities/ETFs and bonds, plus existing FX hedges**; cash balances are included. Subtype, valuation, economic attribution, look-through and hedge/pricing methods remain subject to review. | Owner clarification: “Cash, equities/ETFs and bonds, plus existing FX hedges.” |
| 2026-10-30 | All detailed policy proposals and FXE-D01–D10 remain open; no PLAN/TASKS/runtime implementation approval is recorded here. | Draft status |
