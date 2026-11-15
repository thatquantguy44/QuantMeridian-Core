# ECB reference snapshot — first slice

**Branch:** `feat/fx-gold-snapshot-adapter`, from merged scaffold PR [#199](https://github.com/thatquantguy44/QuantMeridian/pull/199), base `342dcc4`.
**Updated:** 2026-10-30 (America/New_York).
**Status:** Owner-approved 2026-10-30; implemented for the explicitly configured local research runtime. See [implementation checkpoint](IMPLEMENTATION.md). Broader financial policies and operational deployment remain outside this approval.
**Boundary:** [DATA_CONTRACT.md](DATA_CONTRACT.md); broader research remains in [SPEC.md](SPEC.md).

## Approved decision and scope

The owner confirmed: **show the last dated rates with a stale label; block calculations** when an expected publication is missed. This means no stale rate may feed exposure conversion, hedge calculations or a consumable `referenceLevel`. The research page may show a dated display-only inverse/cross if all retained legs share a date and pass integrity/use checks; identify it as a calculation from stale reference data. Invalid, conflicting or rights-denied evidence is never salvaged for display.

The owner approved the complete package below for the first path from Gold to the Research overview:

| Choice | Approved first slice |
| --- | --- |
| Purpose | `CURRENT_VINTAGE`, `REFERENCE`, `allowedPurposes=[RESEARCH]` only. Freshness does not grant reporting conversion or hedge use. |
| Requests | Fixed ordered universe `EUR/USD`, `USD/EUR`, `USD/JPY`, `GBP/USD`, matching the existing selector. EUR/USD selected initially; selector switches views of the same four-result snapshot. |
| Inputs | Three qualified daily ECB legs below, through Gold only. FRED comparisons, more currencies, history metrics and briefs deferred. |
| Freshness | TARGET operating dates; approved daily admission deadline **17:00 Europe/Berlin**, inclusive, with no extra missed-publication allowance. This is an application grace policy, not an ECB timestamp/SLA. |
| Evidence | Capture exact current Gold rows and metadata in a consistent read. Unknown original receipt/publication/first Gold availability remain null. No historical cutoff requests or archived system-known selections. |
| Access | Existing local research application only; no external sharing, paid distribution, exports, private inputs or deployment approval. |
| Replay | Retain full immutable snapshots on the server's persistent local filesystem, outside Git; bounded retention policy below. No warehouse writes, database migration or new dependency. |

## Qualified mappings and arithmetic

Approved source/fixing identity: `ECB_EURO_REFERENCE_DAILY`; versioned mapping identity `ecb-fx-core4/1`.

| Gold `series_id` | Source direction | Required curated metadata |
| --- | --- | --- |
| `ECB:EXR:D.USD.EUR.SP00.A` | USD per 1 EUR | source `ecb`, frequency `d`, units `USD per EUR` |
| `ECB:EXR:D.JPY.EUR.SP00.A` | JPY per 1 EUR | source `ecb`, frequency `d`, units `JPY per EUR` |
| `ECB:EXR:D.GBP.EUR.SP00.A` | GBP per 1 EUR | source `ecb`, frequency `d`, units `GBP per EUR` |

The read-only warehouse inspection on 2026-10-31 at 03:03:49Z verified these curated rows. Gold's latest-observation schema has observation date, value, missing flag, revision number, realtime fields and ingestion time; it has no first-Gold-publication timestamp. The inspected ECB USD row has empty realtime fields, not evidence of a historical vintage. [Refresh evidence](../../gold-db/FX_DATA_REFRESH.md) separately verifies current-run reconciliation; it does not certify all historical intervals.

Let `u`, `j`, `g` be these source levels on the selected date. Results are `u`, `1/u`, `j/u`, `u/g`, in request order. Preserve original levels and metadata, and label inverses/crosses as terminal-derived. EUR identity 1 is arithmetic, not a source record. Require finite positive inputs and outputs; no rounding before calculation. Approved numerical oracle tolerance is absolute `1e-10`; state, identity and evidence comparisons are exact.

## Selection and admission

1. Read the allowlisted Gold observations and curated metadata consistently, preserving exact revision/value/ingestion/realtime fields. An unconfigured/unreachable Gold source yields four explicit `BLOCKED / SOURCE_UNAVAILABLE` outcomes. No browser/source fetch, Bronze read, synthetic fallback or empty-success response.
2. For each required leg, inspect its latest observation, including missing/invalid/conflicting rows; never skip a bad latest row to find a good earlier value. First validate its date as described below, then choose the maximum qualified actual observation date among requested legs as the common selection date. A date-invalid leg is blocked and contributes no selection date; do not substitute its older row. A valid-date row with a bad value still contributes its date and blocks its affected leg. No row at the selected date means `MISSING`. Conflicting duplicates block, rather than choosing one by row order. All eligible pairs use exactly the selected date. Preserve all four requests and leg-specific reasons, including partial failure. If no qualified date exists, keep the common date null and retain each blocked/missing outcome explicitly.
3. Only valid ISO dates on the qualified publication calendar, no later than the capture's Europe/Berlin civil date, may qualify. Unknown cutoff-calendar coverage blocks all admission; an invalid/future/unsupported observation date blocks affected evidence before common-date selection. There is no automatic search for an older common intersection or smaller universe. Different explicit selection policies require new snapshot identities and approval.
4. Apply source policy, mapping, clock and numerical checks before freshness. Primary state precedence is `BLOCKED`, then `MISSING`, then `DEGRADED`; retain all material reasons. Missing required legs on the selection date cannot be combined with older legs to create a cross.
5. A fully qualified pair whose selected date is at least the expected publication date is `ELIGIBLE` for research. An older date is `DEGRADED / STALE_SOURCE`, without `referenceLevel`; retain permitted same-date display evidence as `lastObserved`. A newest missing/invalid record cannot be replaced by a previous eligible record. Retained historical evidence may be displayed separately, with its original snapshot/date and present failure reason.
6. A failed current read does not create a successful current snapshot from cache. A retained snapshot keeps its original cutoff and outcome; show current source status separately as unverified/unavailable. On every current display/consumption, reassess freshness and current rights at actual access time. A snapshot that was eligible Friday cannot remain current indefinitely because its frozen Friday assessment passed. Never mutate the retained original to record the new assessment.

## Publication calendar and clocks

ECB describes publication as usually around 16:00 CET on working days except TARGET closing days, and reference use as informational. Its schedule is approximate; do not fill `publishedAt` with that time. See the [official reference page](https://www.ecb.europa.eu/stats/policy_and_exchange_rates/euro_reference_exchange_rates/html/index.en.html) and [reference-rate framework](https://www.ecb.europa.eu/stats/pdf/exchange/Frameworkfortheeuroforeignexchangereferencerates.en.pdf).

Approved calendar `ecb-target-2026-2028/1`: weekends plus the starred TARGET closures on the [ECB holiday page](https://www.ecb.europa.eu/ecb/contacts/working-hours/html/index.en.html). Other ECB office holidays are not automatically reference-rate closures.

| Year | TARGET closing dates in addition to weekends |
| --- | --- |
| 2026 | Jan 1; Apr 3, 6; May 1; Dec 25, 26 |
| 2027 | Jan 1; Mar 26, 29; May 1; Dec 25, 26 |
| 2028 | Jan 1; Apr 14, 17; May 1; Dec 25, 26 |

At cutoff T, expected date E is the latest operating date whose approved 17:00 Europe/Berlin deadline is `<= T`. Resolve daylight saving with the named timezone, not a fixed UTC offset. A valid same-day rate received before its deadline may qualify early; the deadline is only the latest tolerated wait. Calendar lookup crossing the unreviewed year boundary fails closed (`FRESHNESS_CALENDAR_UNKNOWN`), including early January 2026 if the previous operating date lies in 2025. Versioned exceptions/suspensions require policy review; none are inferred from missing data. Local time, expected date, actual date, deadline and policy version belong in freshness evidence.

For current-vintage capture, record actual consistent-read start/end. Set `cutoffAt` to read completion and `knownByAt` no earlier than that; any evidenced access/publication constraint after cutoff blocks the pair. `createdAt` records completed admission/freeze, at or after cutoff. Persist exact rows and qualified metadata before returning an eligible snapshot. Retained ingestion fields have clock kind `SILVER_INGESTION`; do not relabel them as original receipt. Neither Gold's build watermark nor a current `asOf` query certifies first revision availability. An old economic date cannot qualify for a caller's earlier historical cutoff merely because it is present now.

## Purpose, attribution and retention

Approved source policy `ecb-fx-internal-research/1` permits local research and retention of these public ECB reference statistics with accurate unchanged source records and attribution. The [ESCB reuse policy](https://www.ecb.europa.eu/stats/ecb_statistics/governance_and_quality_framework/html/usage_policy.en.html) conditions reuse on attribution and preservation of statistics/metadata and excludes unpermitted third-party data. The [ECB copyright conditions](https://www.ecb.europa.eu/services/using-our-site/disclaimer/html/index.en.html) also require identification of modifications and specific disclosures for paid distribution. Preserve original inputs; identify terminal inversions/crosses separately. This is the approved application admission decision based on those sources, not a blanket approval for every ECB-hosted dataset. The eligible-assets pipeline's license attestation does not approve this FX source policy.

Source policy evidence must retain review date, source URLs, reviewed terms/content fingerprint, mapping scope, purpose and attribution obligations. Display “Source: ECB reference rates; terminal-derived inverse/cross where indicated. Information only.” The first slice sets exports `DENIED` as product policy; this does not assert that ECB forbids all exports. Unknown or revoked internal/retention permission blocks affected evidence. Denied retention cannot be bypassed by keeping only an unreviewed source payload elsewhere.

Approved local retention: immutable canonical UTF-8 JSON manifests under a configured server directory within ignored `.data/`, maximum **500 snapshots or 30 days**, whichever evicts first. Include exact selected rows, read clocks, outcomes, mappings, policy/calendar/method contents and their versions. No credentials, connection strings, raw HTTP payloads or private books. Source-row values use explicit tagged evidence: `FINITE` with the exact decoded finite number, `NULL`, or `NONFINITE` with token `NaN`, `Infinity` or `-Infinity`. Preserve malformed types in a separate invalid-value tag and exact JSON value; do not coerce strings/null/nonfinite values into numbers. Preserve signed zero with an explicit tag if encountered. This makes invalid-latest outcomes replayable without JSON silently converting NaN to null. Valid calculation fields remain finite numbers only.

Serialize object keys lexicographically, preserve array order, use JSON finite-number serialization, and hash the canonical payload (excluding its `snapshotId`) with SHA-256. Prefix with `fx-reference-snapshot/1:sha256:`; changed clocks/content yield a new ID. Evidence IDs hash exact canonical decoded source-row content plus mapping, separate from capture time. Never overwrite different content under an existing ID. A retained ID alone does not prove truth or permission.

Verify digest/content on replay; recalculate using the recorded method version, never today's mutable Gold rows. Atomic publication follows successful durable write; persistence failure blocks publication (`RETENTION_UNAVAILABLE`). Eviction/revocation/corruption reports `REPLAY_UNAVAILABLE` or `INTEGRITY_FAILURE`, never reconstructed success. Retention is bounded replay, not a permanent archive; local disk loss has the same explicit limitation. On an ephemeral/unconfigured host, snapshot admission remains blocked. No operational deployment is authorized by choosing a local prototype retention rule.

## Independent cases for the first implementation

| ID | Hand case | Expected result |
| --- | --- | --- |
| FXA-01 | Same date `u=1.10`, `j=165`, `g=0.88`; all checks pass | Four research-only levels: 1.10, 1/1.10, 150, 1.25, with exact leg evidence. |
| FXA-02 | USD/GBP at Oct 30; JPY at Oct 29 | Common date Oct 30; USD/JPY missing, other three may qualify. No mixed-date cross or hidden smaller universe. |
| FXA-03 | Latest USD on Oct 30 is missing/zero/NaN/conflicting; valid Oct 29 exists | Affected pairs missing/blocked as applicable; Oct 29 is not consumed as a replacement. |
| FXA-03b | JPY latest date is in the future; USD/GBP have valid Oct 30 rows | JPY is blocked before selection; other three pairs can qualify on Oct 30. Retain the future-dated evidence/reason without letting it move their common date. |
| FXA-04 | Monday Nov 2, 2026, at 16:59 Berlin; latest date Friday Oct 30; then advance to 17:00 | Expected date changes from Oct 30 to Nov 2. Previously current evidence becomes stale/display-only in the present assessment. |
| FXA-05 | Weekend Oct 31/Nov 1; Easter closure Apr 3–6, 2026; office holiday May 14 | Weekend expects Oct 30; Easter expects Apr 2. May 14 is an operating date with a new expectation at its deadline. |
| FXA-06 | Cutoffs around March/October DST changes; unsupported calendar year | Named-zone deadline maps correctly to UTC; unsupported calendar blocks rather than guesses. |
| FXA-07 | Source economic date old; exact row captured now; original clocks unknown | Current-vintage research only from completed current capture, with unknown clocks null. Historical cutoff/archived request rejected. |
| FXA-08 | Fresh snapshot requested for reporting conversion or export | Both operations denied by this slice; changing a UI label or inverting the pair cannot grant permission. |
| FXA-09 | Freeze, restart, revise Gold; replay original ID; then tamper/evict retained content | Original replays exact original result. Tampering fails integrity; eviction is explicitly unavailable. |
| FXA-10 | Gold fails or local retention fails, with a previously eligible retained snapshot | No new eligible snapshot. Old evidence may be shown with original date/cutoff plus current failure; consumer cannot use it as current. |

## Approval and implementation checkpoint

The owner approved this package and continuation through the complete local adapter/replay/overview slice on 2026-10-30. Do not ask for these source, purpose, universe, deadline or retention decisions again. This narrow approval does not adopt all defaults in the broader spec022 or spec023 drafts.

Independent policy and code reviews resolved date-selection ordering, malformed-value retention/validation, recorded-version replay, orphan recovery, expiry cleanup, socket-origin enforcement, delayed-response freshness and derivation labeling. Additional cross-model review was skipped per the owner's earlier preference. See [IMPLEMENTATION.md](IMPLEMENTATION.md) for final verification and the next scoped work.

Expired replay is refused immediately. Physical cleanup occurs on access/startup and minutely while the configured local application runs; a stopped application's files can only be removed when it restarts. No background operating-system daemon or permanent archive is implied. Reviewed source-policy summaries and their content digest are retained as review evidence; that digest is not presented as a fingerprint of an entire remote website.
