# Trade-flow imbalance — open decisions

The image establishes a desired comparison, not a complete data or mathematical
specification. Remaining production decisions are **open**, not defaults
authorized by this draft.
Record the owner, date, supporting evidence and decision version before building
the affected capability. The initial test-source selection below is decided;
its terms and operational details remain open.

**2026-11-14 — Initial test source:** The user selected Kraken's public spot
feed as the first source to test and integrate, initially `BTC/USD` where
available. This choice covers a real-market pipeline test, not SOFR futures or
production admission. Source rights, retention and quality still need review.

**2026-11-15 — User clarifications:** Intended Kraken use is personal,
non-commercial research. The optional cross-model second opinion was explicitly
declined; proceed with the completed independent single-model reviews. These
clarifications do not supply the factor formulas or establish the applicable
capture/retention permission. Do not repeat the personal/commercial-use question.

The original chart's author, post/article link and signal source code have not
been identified in this spec's reference trail. `run_signal`, `TicksPipeline`
and `TicksLivePipeline` are illustrative names recorded from the reference, not
implemented upstream code here. Recover the original notebook/function and
contract weights before claiming reproduction; no exact definition was found in targeted web
searches on 2026-11-15. An unsuccessful search does not establish that none exists.

**2026-11-15 — Research formula integration:** Following the source-backed
proposal, the user requested “Integrate this.” D03 is resolved for the local
research definition `sofr-curve-flow/1`: per-expiry signed contract flow times
SR3 BPV 25; level is the all-expiry mean, slope the FAR mean minus NEAR mean.
[FORMULA_POLICY.md](FORMULA_POLICY.md) records primary sources, signs, units,
fixed denominators, rounding and missing-data rules. D02 and D04–D07 have explicit
SIM-only experimental conventions there; provider qualification, production
mapping/rolls, classification, sessions, corrections and finality remain open.

| ID | Decision needed | Why it matters |
|---|---|---|
| D01 | For the selected Kraken spot test, resolve access/retention and display/export terms, coverage and operational limits; separately select and qualify a SOFR futures dataset and venue. | The Kraken test does not provide SOFR futures, and a futures tick source cannot be inferred from the image or replaced by unrelated daily data. |
| D02 | What `SFR1`–`SFR10` identify, exact contract identifiers and effective-dated leg/roll policy, including missing or expired legs and mapping as known at the calculation time. | Generic strip labels do not identify contracts, tenor, rolls or weights. |
| D03 | Resolved for local research: `sofr-curve-flow/1` in FORMULA_POLICY.md. Original reference code remains unidentified; real-source validation remains open. | Explicit mean-level and far-minus-near flow definitions are our adaptation, not the screenshot's recovered code or validated yield predictions. |
| D04 | Aggressor-side policy, side semantics, source coverage, quote alignment/staleness, out-of-order and ambiguous ordering, unknown-side inclusion and minimum quality threshold. | Side is often classified and uncertain; applying a guessed sign creates false flow. |
| D05 | Five-minute rolling window: event-time endpoints, sampling cadence, every-trade versus every timestamp, warm-up, simultaneous events, sessions, timezone, session reset, halts and end-of-day behavior. | The screenshot does not define boundary math or a session calendar. |
| D06 | Source-specific deduplication, correction/cancel identity, trade condition filters, timestamp precision, tie order, quote/trade cross-feed sequence and data-as-known policy. | Different choices alter historical and replay results. |
| D07 | Watermark/lateness, sequence-gap response, replay/backfill, revision/late correction, finality and recovery policies, including live-vs-replay matching and tolerance. | A 4× replay alone does not make an incomplete or revised stream equivalent. |
| D08 | Source coverage, freshness and completeness SLOs; storage, retention, authorized views/exports and maximum sizes; time zone / session authority; environment, credentials and data redaction. | Production and entitlement require provider-specific operating evidence. |
| D09 | Product entry point, mnemonic, user access, default instruments and window/controls; event marker source and label; which downstream consumers may access derived series. | A desired chart is not an approved deployment, feed or alert. |
| D10 | A genuine, approved historical sample and independently checked expected facts; permissible licensing/redaction and cross-run validation evidence. | Synthetic and replay tests cannot establish real-source correctness or entitlements. |

The Kraken raw signed-volume diagnostic stays separately named and provisional.
Only the explicitly versioned SIM curve kernel uses `level_flow` and `slope_flow`
under FORMULA_POLICY.md. Neither calculation represents recovered image code;
production use still requires resolution of the source-specific decisions.

## Implemented experiment boundary — 2026-11-15

The Kraken implementation uses the separately named `classified_signed_qty/1`
and the explicit, versioned [diagnostic policy](DIAGNOSTIC_POLICY.md). Those BTC
conventions do not define SOFR factors, leg mapping, quote classification,
production lateness or finality. The later research factor definition is
separate from that BTC diagnostic. The source/rights evidence in
[SOURCE_REGISTER.md](SOURCE_REGISTER.md) leaves real capture blocked; the checked-in
permission record is deliberately unusable. No provider consent, real capture,
warehouse write, UI/API registration or deployment occurred.
