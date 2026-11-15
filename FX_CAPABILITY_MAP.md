# FX module capability map

- **Status:** Owner-confirmed scope: two modules; both cashflows and portfolio positions; first-release cash, equities/ETFs, bonds and existing FX hedge records. FXR-S01’s bounded local Gold snapshot/replay/Research overview policy is approved and implemented. Broader research and exposure methods remain for review.
- **Owner:** Joshua Lutkemuller
- **Updated:** 2026-10-31
- **Entry point:** This map selects the FX workstream. The separate SQZ workstream remains at SQZ-T11b; see [master handoff](docs/handoff.md).

## Two modules

| Stable module id | User question and responsibility | Depends on | Proposed spec allocation |
| --- | --- | --- | --- |
| `fx-research` | What changed in FX markets and exchange rates, over which observations, and what evidence supports the research? Owns the public market-data view, pair conventions, research metrics and reproducible briefs. | Governed Gold market data and qualified source/convention metadata. | [spec022: FX Research](docs/specs/spec022/SPEC.md) |
| `fx-exposure-hedging` | Which currency exposures do I have, how do they change under explicit scenarios, and what would a proposed hedge leave outstanding? Owns private exposure inputs, aggregation, hedge assumptions, scenarios and residuals. | The versioned FX snapshot boundary specified by `fx-research`; user-supplied exposures and approved hedge policy. | [spec023: FX Exposure & Hedging](docs/specs/spec023/SPEC.md) |

**Proposed delivery order:** prepare/review `fx-research` and its provider boundary alongside `fx-exposure-hedging` → review each specification → plan and implement each module in dependency order. The owner directed parallel draft specification work while Gold refresh runs. The exposure specification can be reviewed before the research module ships. Research does not require an exposure book.

The snapshot boundary is shared infrastructure owned by the research specification, not a third user-facing module. Exposure calculations must work from an eligible frozen snapshot without depending on an open research page, a narrative, or an agent conversation. Private exposures never flow back into public research output.

The owner subsequently authorized frontend scaffolding: **FX Research** (`FXR`, `/fx/research`, Markets) and **FX Exposure & Hedging** (`FXH`, `/fx/exposure-hedging`, Financing). The [scaffolding checkpoint](docs/specs/spec024/FX_SCAFFOLD.md) records implemented preview navigation and the next data-adapter slice; detailed financial policies remain open.

**Current checkpoint:** [FXR-S02 implementation/runbook](docs/specs/spec022/HISTORY_IMPLEMENTATION.md) extends the approved S01 four-pair ECB reference snapshot with 90-date history, 1/5/21 observed-interval changes, chart/table/source evidence and immutable local replay, merged in PR #200. The owner approved both bounded policies. Exposure remains a shell. FXR-S03 now has a dedicated branch, `feat/fxr-volatility`, and a completed [volatility slice](docs/specs/spec022/VOLATILITY_IMPLEMENTATION.md): 5/21/63/126/252-return sample log volatility, annualization choice, a 253-level Gold capture, UI and immutable replay. Next is a separately reviewed deterministic research-brief policy; broader defaults remain proposed.

## Proposed first-release scope to review

### `fx-research`

Daily/on-demand research for a selected currency-pair universe: source-dated reference levels and crosses, pair-direction-aware changes, historical comparisons, descriptive realized volatility and an evidence-backed research brief. Each view and export identifies the source, cutoff, actual endpoint dates, observation horizon, missingness and method version. Reference-rate moves are exchange-rate changes, not investment total returns or executable PnL.

“Rates” initially means exchange rates. Interest-rate differentials, central-bank context and event overlays are useful candidates, but need their own approved series, timing and comparability definitions. Forward points, yield curves, carry, cross-currency basis, options surfaces and intraday executable markets are later capabilities unless explicitly added to the first specification with qualified inputs. Existing simulated basis panels are not evidence that these data are available.

**Proposed acceptance anchors for the specification:** selecting EUR/USD versus USD/EUR changes units and recomputes returns correctly; missing or stale inputs yield a reason; a history import received today cannot establish earlier system knowledge; a brief can be reproduced from the same frozen revisions. The initial currency universe, freshness policy, history length, change horizons and volatility definition remain decisions for the specification.

### `fx-exposure-hedging`

Separate exposure measurement from hedge proposals. Preserve signed amounts in their native currencies, reporting currency, source/as-of evidence and the identities needed to explain netting. Show original exposure, eligible offsets, reporting-currency counterlegs, assumptions and residual exposure. Reference-based proposals are indicative and do not establish execution prices, funding costs, value dates or hedge effectiveness.

**Owner-confirmed input scope:** include both cashflows and portfolio positions in the first release, covering cash, equities/ETFs, bonds and explicit existing FX hedge records. Portfolio positions are part of the initial specification, not a later extension. Instrument subtype/valuation coverage, exposure methodology, look-through and hedge-policy details still require definition and review; the category choice does not approve a pricing or risk model.

Dated cashflows require new maturity-aware requirements beyond the available QuantSmith cash-offset helper: separate contracted and forecast amounts, timing/certainty, entity/book and netting scope, and existing hedges. Opposite flows with different dates cannot silently disappear into one net cash figure. Portfolio inputs require instrument mappings, valuation dates, currency attribution and a clear treatment of existing FX instruments. Neither capability is delivered merely by importing the current library.

The specification must define how positions, their related cashflows and existing hedges reconcile without counting an exposure twice. It must distinguish denomination currency from economic currency exposure and identify unsupported instruments or unavailable look-through explicitly. Accepting portfolio inputs does not establish full security/derivative coverage or an approved exposure method.

**Proposed acceptance anchors for the specification:** both cashflow and portfolio input paths produce traceable exposure results; positive and negative exposures retain their signs; related position/cashflow/hedge records are reconciled under an explicit counting rule; unsupported instruments remain visible with a reason; hedge ratios and reporting conversion are explicit; offsetting currencies/dates/entities are combined only under the approved netting rule; both hedge legs and residuals reconcile; missing eligible FX evidence blocks the affected conversion/proposal without removing the original exposure. Existing-hedge treatment, permitted instruments, horizon buckets, scenarios and manual/CSV input format remain decisions for the specification.

No order/RFQ submission, automated rebalancing, settlement instructions or operational deployment is proposed in the first release. Forward/roll pricing, transaction costs, constrained optimization, VaR and hedge accounting require separate approved scope and evidence. An indicative cash offset must not be presented as a maturity-matched forward hedge.

## Proposed boundary contract ownership

The research specification will define the versioned provider contract before a consumer is implemented. Its review must cover:

- Explicit base and quote currency, quote units, reference versus two-sided indicative versus executable data class, finite positive values, and cross/inversion lineage. A single reference value cannot acquire a fabricated spread.
- Source identity, source date, actual receipt/first-known evidence, available publication/observation timestamps, revision/content identity, cutoff, quality/freshness disposition and source-use/export restrictions. Unknown timestamps remain unknown.
- Frozen selection identity and method/convention versions sufficient to reproduce calculations. Current-vintage historical imports and actual archived system-known history remain distinct.
- Missing pair/leg, stale source, unsupported convention and failed admission as explicit unavailable reasons. No silent source blending, synthetic fallback, zero-fill or inferred earlier availability.
- Approved reporting-conversion semantics. Market observation dates do not establish trade/value dates, business calendars, settlement instructions or a permitted hedge instrument.

The exposure module owns exposure and hedge-policy versions, private-input access, scenario assumptions and result lineage back to that snapshot. User exposures and assumptions are separate input classes from public market data; they must not be written into the public market-data store.

## What exists and what still needs building

Initial repository inspection on 2026-10-30 found no dedicated terminal FX module/specification. The following inventory predates the later scaffold and FXR-S01 checkpoints above; it identifies ingredients and reuse limits.

| Ingredient | Evidence | Reuse limit |
| --- | --- | --- |
| Markets FX tab and a small currency universe | `src/app/markets/page.tsx`, `src/data/universe.ts` | Pipeline/synthetic compatibility surfaces; not a governed FX source contract. |
| FRED currency series and dollar index catalog | `src/data/econSeries.ts` | Catalog entries do not prove Gold coverage, freshness or source timing for a proposed pair/universe. |
| FX ETF chart proxies | `src/data/chartCatalog.ts` | ETF prices are not interchangeable with direct currency reference rates. |
| Cross-currency basis panels | `src/data/funding.ts` | Explicit SIM placeholders, not qualified forward/basis data. |
| Dated conversion inputs and FX shocks in other analytics | spec016 collateral and spec020 indemnification | Existing purpose-specific inputs do not approve cross-currency funding or a general hedge workflow. |

The local QuantSmith source is selected through [the reviewed source-path pin](docs/specs/spec005/QUANTSMITH_PIN.md): `../../agentic_workflows/qf_workflow_sdk_public` relative to this repository. Its consumed content currently differs from the approved fingerprints. These observations identify candidates for review; they do not approve that copy or claim its tests were rerun for this map.

| Local QuantSmith artifact | Observed bounded capability | Remaining terminal gap |
| --- | --- | --- |
| `specs/0125-fx-spot-foundation/spec.md`; `src/quantsmith/fx/rates.py`, `calendars.py` | Supplied spot quote arithmetic and explicit supplied-calendar/value-date evidence. | Terminal contracts, source qualification and a reviewed integration; no general live market-calendar service. |
| `specs/0126-fx-reference-hedging/spec.md`; `providers.py`, `exposure.py` | Bounded ECB reference parsing/acquisition, reference crosses and signed net-currency cash offsets. | Gold-compatible ingestion decision, exposure workflow, maturity/existing-hedge treatment and private-input controls. Enterprise provider callbacks are not delivered licensed connectors. |
| `specs/0127-fx-rates-research/spec.md`; `archive.py`, `history.py`, `research.py`, `brief.py` | Local revision/receipt-aware archive, bounded daily history, descriptive pair metrics and deterministic briefs. | Terminal source adapters, persistence and operations, quality policy, UI and exports; library archive integrity does not prove external source truth. |
| `specs/0124-fx-rates-trading/spec.md`; `agents/fx/` | Broader draft parent and a bounded rates-analyst contract. | No complete production trading suite, autonomous multi-agent deployment, full forward/curve engine or execution workflow. |

## Data and integration constraints

The terminal's existing [spec009 market-data boundary](docs/specs/spec009/SPEC.md) makes Gold the numeric market-data authority. Reusing QuantSmith arithmetic does not authorize its direct ECB acquisition inside the terminal, a second market-data store, or browser-side external fetching. The first specification must inventory actual Gold coverage and propose any new upstream admission through the governed pipeline; unsupported data remains unavailable. Source access, storage and export rights need source-specific review.

The official [ECB reference-rate page](https://www.ecb.europa.eu/stats/policy_and_exchange_rates/euro_reference_exchange_rates/html/index.en.html), inspected 2026-10-30, describes EUR-based reference rates for information purposes and discourages transaction use. Its daily and history downloads are a potential upstream reference-data source, not proof of executable pricing, terminal ingestion, source entitlement or historical system knowledge. No market data was imported for this document.

Before using local QuantSmith in the terminal, review/re-pin the consumed code and assets and resolve the applicable [spec009 sourcing/readiness work](docs/specs/spec009/TASKS.md) (T-012). A local path removes the Git commit dependency; it does not remove content review or establish worker readiness. Library reuse and optional worker/narrative integration must have distinct acceptance evidence.

These modules do not relax spec012's single-currency model, spec011's per-currency solving, spec014's cross-currency funding/netting limits, or spec021's same-currency re-rate policy. Reporting conversions and indicative hedges do not authorize changes to those models.

Real private exposure intake requires an explicit trusted access boundary and data handling/export policy; the terminal currently lacks user authentication. Use labeled synthetic examples for initial design and verification. No private books, provider credentials or licensed source payloads belong in tracked fixtures or external model prompts.

## Next scoped work

1. The owner directed parallel specification work while Gold refresh proceeds. Use the two-module map and proposed one-way snapshot boundary to prepare review drafts. The two-module product split and inclusion of both cashflows and portfolio positions in the initial exposure module are already confirmed; do not ask the owner to choose that input scope again. Runtime delivery order and detailed requirements remain subject to review.
2. Review [spec022](docs/specs/spec022/SPEC.md) and its [snapshot contract](docs/specs/spec022/DATA_CONTRACT.md): Gold coverage, first-use decisions, required data classes and the versioned provider boundary. Defaults remain proposed until reviewed.
3. Review [spec023](docs/specs/spec023/SPEC.md), covering both cashflows and portfolio positions: supported instruments and exposure methodology, position/cashflow counting rules, signed hand cases, existing-hedge/netting rules, maturity limitations, privacy and reconciliation acceptance criteria.
4. Review the two specifications before creating implementation plans/tasks or changing runtime code. Allocate spec022/spec023 to this initiative. This map remains the selection index for the stable module ids as the numbered spec documents are added.

This stopping point follows [spec-driven-development](.agents/skills/spec-driven-development/SKILL.md), Phase 0: “The human reviews module boundaries, dependency direction, and build order before any module spec is written.” There are no approved delivery tasks or implementation claims in this document.
