# FX reference snapshot contract — review draft

- **Provider:** `fx-research`, [spec022](SPEC.md)
- **Consumer:** `fx-exposure-hedging`, [spec023](../spec023/SPEC.md)
- **Proposed contract version:** `fx-reference-snapshot/1`
- **Status:** The narrow current-vintage research subset is implemented under the approved [ECB admission policy](ADMISSION_POLICY.md). Broader purpose/knowledge classes remain draft; see [IMPLEMENTATION.md](IMPLEMENTATION.md).
- **First slice:** The owner approved the four-pair ECB research-only/calendar/local-retention package, including stale dated display with downstream calculations blocked. No reporting-conversion admission follows from this approval.

This document owns the shared field meanings. Consumers reference this contract rather than invent a competing market-data schema. Only the provider selects governed Gold revisions and creates the immutable market snapshot. No exposure amounts, holdings, counterparties, hedge requests or user-scenario assumptions flow back through this boundary.

## Snapshot envelope

| Field | Required meaning |
| --- | --- |
| `contractVersion` | Exact supported semantic version, initially proposed `fx-reference-snapshot/1`; reject unknown major/unsupported versions. |
| `snapshotId` | Immutable identity bound to the frozen selection manifest, full pair outcomes, selected evidence and policy/convention/method versions. Reusing an ID for changed content is invalid. |
| `cutoffAt` | UTC ISO-8601 instant ending `Z`; latest permitted knowledge time for selecting the exact revisions. Not the economic observation date or transaction time. |
| `createdAt` | Actual snapshot creation instant in UTC, at or after `cutoffAt`; never substitute it for source observation/publication/receipt. |
| `sourceSetId` | Qualified single source family/fixing set used for this snapshot. ECB/FRED comparison views use separate snapshots, with their differences visible. |
| `observationDate` | `YYYY-MM-DD` selected common economic date, including a stale selection with no eligible level; null when no date can be selected. This is not a settlement date. |
| `requestedPairs` | Explicit ordered list of unique `{ baseCurrency, quoteCurrency }` requests. Preserve the requested universe even if some or all fail. |
| `selectionPolicyVersion` | Approved revision/precedence/common-date selection and admission policy identity; unapproved/unknown policies cannot yield eligible pairs. |
| `freshnessPolicyVersion` | Source-specific release-calendar, successful-receipt and stale-budget policy identity. No approved policy means no eligible conversion. |
| `conventionVersion` | Versioned currency mapping, units, fixing, inversion/cross and schedule conventions. |
| `methodVersion` | Versioned numerical/precision methodology used to derive the reference values. |
| `knowledgeBasis` | One of `SYNTHETIC`, `CURRENT_VINTAGE`, `ARCHIVED_SYSTEM_KNOWN`; definitions below. A snapshot cannot mix these classes. None is an executable/LIVE readiness label. |
| `pairs` | Exactly one pair result per requested pair; no duplicate or silently dropped request. Unrequested intermediate legs occur only as cited evidence. |

The full selection manifest must remain retrievable under its identity within approved retention/access rights. It must preserve exact source revision/value evidence rather than reread mutable “latest” rows. A hash proves consistency with retained content, not source truth, license permission or historical knowledge. Canonical serialization/hash format and durable retention location remain decisions before implementation; ID/content integrity and replay behavior are requirements now.

## Pair result

Every result includes `baseCurrency`, `quoteCurrency`, `state` and `reasons`. Currency identities use qualified ISO-4217 codes; the first version supports only distinct currencies. Same-currency identity arithmetic belongs to the consumer and creates no market observation.

| Variant / field | Meaning |
| --- | --- |
| `state=ELIGIBLE` | Consumable reference evidence for the declared permitted purpose at this snapshot's cutoff, under the recorded policies. Requires all fields below and empty blocking reasons. This grants no trade, hedge-instrument, calendar, value-date or execution readiness. |
| `referenceLevel` | Finite strictly positive number, quote-currency units per **one** base-currency unit. Unrounded calculation value; display precision cannot replace it. Only an `ELIGIBLE` result has this consumable field. |
| `dataClass` | `REFERENCE` only in version 1. No bid/ask fields or fabricated spread. A future two-sided indicative/executable contract requires separate approval and semantics. |
| `derivation` | `DIRECT`, `INVERSE` or `CROSS`; includes the exact ordered evidence references and formula needed to reconstruct `referenceLevel`. Intermediate EUR identity 1 may be used as arithmetic, never as a fabricated source observation. |
| `evidence` | Nonempty complete source-leg records under the next section; all must qualify. A direct pair is not exempt from lineage. |
| `allowedPurposes` | Explicit subset of `RESEARCH` and `REPORTING_CONVERSION` admitted for these source legs. Spec023 requires `REPORTING_CONVERSION`; an eligible research-only pair does not authorize that use. |
| `exportDisposition` | `PERMITTED`, `DENIED` or `UNKNOWN` for this derived result under current source rights, with policy/evidence references and attribution obligations. Export permission is separate from in-boundary calculation permission. |
| `state=MISSING` | Required pair/leg or observation at the selected date is absent. No `referenceLevel`. |
| `state=DEGRADED` | A potentially usable observation exists but fails the approved freshness/coverage gate; display-only. No `referenceLevel`. |
| `state=BLOCKED` | Integrity, policy, rights, convention, identity or knowledge eligibility failed; no `referenceLevel`. |
| `reasons` | Machine-readable reason codes plus concise human explanation and affected leg/policy references. Required nonempty for noneligible states. Text cannot authorize a state transition. |
| `lastObserved` | Optional display-only evidence on a noneligible result. If retained and permitted, include its value, units, actual observation date and source identity; it never substitutes for `referenceLevel` or changes the state. |

Proposed reason vocabulary: `PAIR_NOT_SUPPORTED`, `MISSING_LEG`, `MISSING_OBSERVATION`, `SOURCE_UNAVAILABLE`, `STALE_SOURCE`, `RECEIPT_FAILURE`, `FRESHNESS_POLICY_UNAPPROVED`, `FRESHNESS_CALENDAR_UNKNOWN`, `CONVENTION_UNQUALIFIED`, `SOURCE_MAPPING_UNQUALIFIED`, `INVALID_LEVEL`, `REVISION_CONFLICT`, `INTEGRITY_FAILURE`, `KNOWLEDGE_EVIDENCE_MISSING`, `AFTER_CUTOFF`, `SOURCE_USE_DENIED`, `SOURCE_USE_UNKNOWN`, `EXPORT_DENIED`, `EXPORT_UNKNOWN`, `RETENTION_UNAVAILABLE`, `REPLAY_UNAVAILABLE`. Export/replay-only failure does not rewrite an originally permitted internal reference value; it governs the present operation. History metrics use their own insufficient-history/gap reasons, outside this level-only boundary.

If multiple failures apply, retain all material reasons. Proposed primary-state precedence is `BLOCKED` before `MISSING` before `DEGRADED`; consumer eligibility always requires `ELIGIBLE` and the required purpose, independently of reason ordering. A failed Gold connection may produce all-pair blocked outcomes with `SOURCE_UNAVAILABLE`; it must not produce an apparently successful empty universe.

## Evidence and clocks

Each selected source leg records the following. Values from multiple legs must share the snapshot's source family/fixing and economic date. Different series IDs within that qualified family are expected; mixing families or dates within an eligible cross is forbidden.

| Evidence field | Meaning |
| --- | --- |
| `evidenceId`, `sourceId`, `seriesId` | Stable evidence identity, authoritative source identity and source-native series identity with qualified mapping. |
| `sourceBaseCurrency`, `sourceQuoteCurrency`, `sourceLevel`, `sourceUnit` | Original normalized pair direction/value/unit before inversion/cross. An ECB EUR-based value expressed per 100 units must be explicitly normalized; no unit guess from labels. |
| `observationDate` | Source economic reference date matching the snapshot's common date. Preserve source period metadata where relevant; monthly interest-rate/index context is not a daily FX leg. |
| `publishedAt`, `observedAt` | UTC instants only when actually evidenced. Null if unknown. Date-only publication evidence is retained separately as `publicationDate`, with its source precision; do not invent midnight or a fixing time. |
| `receiptAt` | Original platform receipt instant for this exact source revision, only if independently evidenced; otherwise null. An ingestion/normalization timestamp is not an exact transport receipt. Required for an archived system-known claim, not for current-capture research admission. |
| `goldAvailableAt` | First publication time of this exact revision through Gold, only if independently evidenced; otherwise null. A build watermark or rebuild completion cannot establish it. Required for an archived system-known claim. |
| `upstreamRecordedAt`, `upstreamClockKind` | Retained ingestion metadata, if present, explicitly identified as e.g. `SILVER_INGESTION`. Not publication, original receipt or first Gold availability. |
| `goldReadStartedAt`, `goldReadCompletedAt` | Actual UTC start/completion of the successful consistent Gold read containing this exact row. Required for current-capture evidence; retain its selected row content and read identity. These clocks prove current capture, not original publication. |
| `knownByAt` | Conservative evidenced time by which the exact revision was captured through the FX boundary, no earlier than read completion or any known receipt/publication/access constraint. Required and `<= cutoffAt` for current-vintage eligibility. Does not assert earliest system knowledge. |
| `revisionId`, `contentId` | Exact revision identity and content fingerprint; preserve original revision/vintage metadata where available. If a source supplies no revision ID, the governed adapter supplies a content-based revision identity and labels that fact. Rewritten row IDs alone cannot establish unchanged content. |
| `freshnessState`, `freshnessEvidence` | `CURRENT`, `STALE` or `UNKNOWN`, with applicable calendar/release expectation, latest successful receipt evidence and policy evaluation at the cutoff. Only `CURRENT` may be eligible. A weekly release containing daily observations remains a weekly publication cadence. |
| `sourcePolicyId`, `sourcePolicyVersion` | Versioned purpose, attribution, retention, access and export dispositions/evidence. Each source leg must affirmatively permit the requested internal use/retention; unknown export permission independently denies export and need not deny internal conversion. Unknown permissions cannot default to permitted. The most restrictive contributing rule governs each operation on derived output. |

All timestamps are evidence about this exact revision. A request-start clock alone establishes no capture. The first slice requires a successful consistent Gold read, retained content, completed admission and durable freeze before publishing any eligible snapshot. Its cutoff is read completion; known constraints after that cutoff block admission. Unknown original receipt/publication/first-Gold-availability clocks remain null. Current capture permits use only from the evidenced current cutoff onward; it cannot establish earlier system knowledge. This replaces the unpublished draft's `firstKnownAt` field, which incorrectly implied that the current warehouse could establish earliest availability. No deployed contract or retained snapshot is migrated by this draft correction.

`CURRENT_VINTAGE` means a frozen selection of the revisions available at its present evidence-supported cutoff, including any old economic dates. It supports descriptive historical analysis, not historical point-in-time claims. `ARCHIVED_SYSTEM_KNOWN` requires retained evidence that every exact revision was available and permitted through Gold by the historical cutoff; a current Gold `asOf` query alone is insufficient. This class remains unavailable until independently certified. `SYNTHETIC` requires synthetic identities/data throughout and must not be consumed as real-market reporting evidence.

## Admission and consumer rules

1. Validate contract version, complete requested-pair accounting, currency identities, positive finite levels, units, immutable identity, exact revision lineage, clocks and policies before publishing or accepting a snapshot. Unknown versions, malformed envelopes or changed content under the same ID fail the entire contract; per-pair data-quality failures stay explicit pair results.
2. Freeze one qualified source/fixing set and one common observation date across all eligible pairs. A pair missing on that date stays missing; using its prior date silently is invalid. Selecting an earlier common date or a smaller requested universe creates an explicitly different snapshot and repeats freshness admission. No source blending, synthetic fallback or best-looking revision selection.
3. Current-vintage eligibility requires exact revision `knownByAt <= cutoffAt`, permitted purpose and `CURRENT` under the approved source-specific policy. Archived system-known eligibility additionally requires original receipt and first-Gold-publication evidence by its historical cutoff; this class is disabled in the first slice. A historical observation captured later fails an earlier cutoff even if a source labels it “final.” Future economic dates relative to the source's qualified calendar/cutoff fail admission; a timezone date alone is not an invented intraday instant.
4. A conversion from currency A to reporting currency R uses eligible A/R `referenceLevel` as `amountA × referenceLevel`. If only R/A was requested, obtain an explicitly derived eligible inverse under this contract; the consumer cannot salvage a blocked pair by recomputing its displayed stale inverse. Native signed amounts remain the consumer's responsibility.
5. Inversion is `q(B/A)=1/q(A/B)`. With EUR-based levels `xA` A per EUR and `xB` B per EUR, `q(A/B)=xB/xA`. Every selected direct/inverse/cross must be consistent with the same source-date vector; conflicting qualified routes block rather than silently arbitrage-select. No bid/ask, carry, interest rate, transaction cost or forward point is derivable from these fields.
6. Spec023 consumes only `ELIGIBLE` pairs permitted for `REPORTING_CONVERSION`. Missing/degraded/blocked pairs block the affected conversion/proposal, while the original private exposure remains visible. Snapshot-level success does not make every pair eligible. Research-only entitlement does not become a hedge-analysis entitlement by changing a label.
7. Scenarios, reporting-currency identity rates, positions, hedge legs, private access, counting/netting and policy versions belong to spec023. Consumer-derived scenario levels are assumptions linked to the original snapshot; they cannot be written back as observed market evidence. This contract grants no maturity-matched instrument or settlement convention.
8. A replay uses the original retained revisions/versions and reproduces the same numerical result and state; a changed source revision creates a new identity. Current entitlement revocation can deny retrieval/export of historical evidence without rewriting the original snapshot. Report denied/unverifiable replay clearly.
9. Exports independently enforce current source rights and preserve restrictions through levels, crosses, charts, narratives and consumer results. If an otherwise permitted private-result export must withhold restricted numeric/source payload, identify withheld fields and state that self-contained numerical replay is unavailable. Do not claim a hash-only/redacted export contains full reproducibility evidence. Unknown export rights deny the affected export; they do not justify leaking raw data for replay.

## Boundary acceptance cases

| ID | Independent case | Required outcome |
| --- | --- | --- |
| FXC-AC01 | Same-date ECB EUR/USD=1.10, EUR/JPY=165; request USD/JPY and JPY/USD | Eligible levels 150 and 1/150, same complete leg identities and cutoff; no invented spread or settlement date. |
| FXC-AC02 | EUR/USD leg has date D; EUR/JPY leg has D−1 or belongs to another fixing/source family | No eligible cross. Failure lists mismatched evidence; a separately selected common-date snapshot is a new selection. |
| FXC-AC03 | Exact revision captured on Oct 30 for an Oct 23 observation; historical cutoff Oct 24 | `AFTER_CUTOFF`, even if publication is dated Oct 23. A new evidenced current-vintage capture may qualify under its current policy; no archived historical-knowledge claim follows. |
| FXC-AC04 | Current Gold capture and source policy are evidenced; original receipt/publication/first Gold availability are unknown | Those three fields remain null. Current-vintage research may qualify from completed capture, never for a cutoff before capture or an archived system-known claim. Remove the consistent read or retained content and admission is blocked with `KNOWLEDGE_EVIDENCE_MISSING`. |
| FXC-AC05 | A retained last-observed level exists for a stale or failed pair | Display may show it with date/reason if permitted. No consumable `referenceLevel`; spec023 must retain and block the affected native exposure conversion. |
| FXC-AC06 | One pair is research-permitted but reporting conversion is denied; another is conversion-permitted but export-denied | First pair cannot feed spec023. Second may feed in-boundary permitted arithmetic but cannot leak denied source/derived content through export; withheld replay evidence is disclosed. |
| FXC-AC07 | Duplicate request outcome, missing requested result, NaN/infinite/nonpositive level, changed payload under the same snapshot ID, unknown version or synthetic/real mixture | Reject malformed contract or block invalid source leg as appropriate; none is consumed numerically. A valid partial snapshot contains explicit outcomes for every request. |
| FXC-AC08 | Latest current-level evidence is eligible; historical window lacks 22 levels | Reference conversion can remain eligible; research volatility is unavailable. Metric incompleteness does not silently manufacture or remove provider eligibility. |

## Versioning and unresolved approval

Pair direction, units, clock meaning, evidence requiredness, state/purpose meanings and eligibility changes are semantic breaking changes: require explicit version migration and consumer approval. Additive optional display metadata may be compatible; consumers must never reinterpret unknown fields/states as permission. Published retained snapshots are immutable; do not silently migrate their content in place.

The approved first-slice mappings, policies, tolerance, canonical identity, retention and bounds are recorded in ADMISSION_POLICY.md and implemented under local runtime gates. Extensions to purpose, knowledge class, universe or history require separate review. Transport/runtime details are recorded in PLAN.md and IMPLEMENTATION.md; no database migration or new dependency was introduced. No private-book ingestion, direct-source bypass, historical-PIT certification or operational deployment is approved by this contract.

The subsequently owner-approved [history policy](HISTORY_POLICY.md) owns a separate `fx-reference-history/1` descriptive research artifact; see [history implementation](HISTORY_IMPLEMENTATION.md). Its historical display levels and observed changes do not become consumable referenceLevel fields or reporting-conversion permission. Both artifact kinds share the same local retention budget; S01 retained content and identities remain unchanged.
