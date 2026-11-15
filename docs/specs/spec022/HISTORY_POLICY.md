# FXR-S02: pair history and observed changes

**PR:** [#200](https://github.com/thatquantguy44/QuantMeridian/pull/200), branch `feat/fx-gold-snapshot-adapter`.
**Scope:** owner approved this history policy on 2026-10-30 and directed completing the Gold reader and Pair history in this PR. S01 admission remains approved. Do not repeat the history-window/method/gap/staleness/retention questions.

## Approved bounded policy

- Keep the same four requested pairs and three ECB Gold mappings as [ADMISSION_POLICY.md](ADMISSION_POLICY.md). Research only; no reporting conversion, hedging, export, volatility or brief behavior is added.
- Apply S01's latest-row guard **before** filtering the chart window: inspect each leg's actual latest row(s), including malformed/future/missing/conflicting rows; validate its date before selecting the common maximum qualified date. Preserve those guard rows even when outside the chart window. An older in-window row cannot restore current endpoint eligibility for a failed latest leg. Valid older historical observations may remain dated display-only history, with the current endpoint failure shown separately.
- Show the most recent **90 TARGET operating dates**, ending at the common economic date selected from the latest captured source rows. Use only the already-reviewed 2026–2028 calendar. A window reaching outside reviewed coverage is visibly truncated; do not guess earlier holidays. Preserve expected and valid observation counts and the actual first/last dates.
- Historical left-edge truncation is separate from current freshness: an unsupported capture calendar or expected-publication lookup still blocks new current admission/metrics under S01. Do not use truncation to waive the early-January-2026 or post-2028 freshness gate.
- Calculate **simple percentage changes over 1, 5 and 21 observed intervals**, `100 × (qEnd / qStart − 1)`. Each available metric requires N+1 valid, consecutive expected source observations ending at the selected date. The label says observed intervals and includes exact endpoints/calendar span. A rising A/B rate means A appreciated against B; it is not total return or PnL.
- Construct each date's direct/inverse/cross only from valid same-date, same-source legs. A missing/invalid/conflicting date stays a gap. Never fill, interpolate, bridge an unexpected gap, use an older replacement row, shorten a window, or silently drop a requested pair. Recompute inverse-pair changes from inverted endpoints; do not negate direct simple changes.
- Distinguish insufficient history, gaps/invalid observations, stale endpoint and source/retention failure. A stale endpoint remains visible in dated history, but **current change metrics are unavailable**. Earlier historical levels are descriptive current-vintage evidence; they do not grant consumption as current reference levels.
- Read a bounded allowlist of Gold rows and catalog metadata in one consistent statement. Preserve exact selected revisions, missing flags, decoded values (including invalid-value tags), ingestion fields and actual capture clocks. Unknown original publication/receipt/first Gold availability remain null. No historical system-known claims or caller-selected historical cutoffs.
- Freeze history under a separate versioned `fx-reference-history/1` identity. Retain the entire bounded selection and its policy/method/calendar/evidence so replay recomputes the same chart points, changes and reasons without today's mutable Gold rows. Preserve S01 v1 replay unchanged. History and level manifests share the existing **500 artifacts / 30 days** local retention budget and access gates.
- Keep the original capture assessment immutable. The current endpoint returns a separate access-time metric assessment; reassess at source deadlines and before displaying a delayed response. A Friday metric may replay as captured historical evidence on Monday while its Monday current assessment is unavailable. Replaying cannot mutate the original metric or authorize current consumption.
- Bound capture to **320 projected rows**: 90 scheduled dates × 3 legs plus latest-row guards and duplicate/invalid-row allowance. Query one extra row to detect overflow; more than 320 rows, more than S01's 32 latest-guard rows, or a manifest over the existing 1 MiB byte cap fails capture rather than returning a silently truncated successful history. Empty and partial history preserve all four pair outcomes.

## Independent acceptance cases

| Case | Required result |
| --- | --- |
| EUR/USD 1.10 → 1.21 on consecutive qualified dates | +10%; USD/EUR is −9.090909…%, with reversed units and original source-leg evidence. |
| Twenty-two complete points on consecutive TARGET dates | 1/5/21 interval metrics use the exact 2/6/22 endpoint windows; labels show actual dates and calendar span. |
| Twenty-one valid points | 21-interval change is insufficient; shorter complete windows may remain available. |
| One expected date absent inside a requested window | Visible gap; affected metric unavailable, with no shortened-window substitution. |
| Missing JPY leg on one date; USD/GBP complete | USD/JPY has a gap; other same-date pairs may remain available. |
| Invalid/future latest date or conflicting revisions | Affected evidence blocked; no older replacement or contamination of unrelated pair dates. |
| Latest endpoint stale under the existing release deadline | Dated history visible, current 1/5/21 change figures unavailable. |
| Gold revision changes after capture; process restarts | Old history identity replays original points/metrics/reasons; new capture has a new identity. |
| Source or retention fails | No new admitted history or current metrics; any verified retained history is separately labeled with its original cutoff and current failure. |
| History runs into the reviewed calendar boundary | Show available bounded coverage and truncated-calendar reason; do not fabricate earlier observations or holidays. |

## Delivery

Delivered after owner approval: hand-oracle tests → bounded Gold history capture and immutable replay → Pair history chart, accessible table, interval-change cards and evidence → integration/browser/live Gold checks → handoff and this same PR. See [HISTORY_IMPLEMENTATION.md](HISTORY_IMPLEMENTATION.md). The next research slice after S02 remains a separate policy decision; volatility and briefs are not implicitly approved.
