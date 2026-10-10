# Feature Addition — Inversion Detection Expansion

Status: Completed — live spread inversion detection is integrated

Here's exactly how the inversion periods are derived (all in src/data/econCurve.ts). There are two different paths depending on which spread you've selected.

1. The default 10Y-2Y spread → curated historical record
When the spread is 10Y2Y, getInversionsForSpread() returns getInversionHistory() (econCurve.ts:215) — a hand-coded table of the real inversions since 1978 (1978, 1980, 1988, 2000, 2006, 2019, 2022). Each row carries actual figures: inverted/un-inverted dates, maxDepthBps, whether a recession followed, the recession start, and the leadTimeMonths (e.g., 2006 → −19bps, GFC started Dec 2007, 18-month lead). These are curated real values, not computed.

2. Every other spread (10Y-3M, 30Y-5Y, 5Y-2Y, etc.) → algorithmically detected
For any non-2s10s spread, the inversions are detected from a synthesized spread path (getInversionsForSpread, econCurve.ts:331):

Step A — build the spread path:

Start from one shared 2s10s "base path" defined by ~29 historical knots (S2S10_KNOTS, year → approx bps, e.g. [2000,-50], [2007,5], [2022,-55]), linearly interpolated between knots (baseAt).
Transform it per-spread with value = base × factor + offset (SPREAD_TX, econCurve.ts:288). Each spread has its own factor/offset — e.g. 10Y-3M is steeper & more volatile (×1.18, −22), 30Y-5Y flatter & shifted positive (×0.7, +70), 5Y-2Y the belly (×0.55, +8).
Sample monthly 1976→2026 and add small deterministic seeded noise.
Step B — detect episodes: scan for contiguous runs where the spread is < 0 (inverted). For each run:

invertedDate = start, unInvertedDate = end, durationMonths = length of the run
runs shorter than 2 months are discarded as noise (line 351)
maxDepthBps = the most-negative value in the run
lead time / recession-followed: find the next NBER recession (from the hardcoded RECESSIONS ranges, line 284) whose start is after the inversion; leadTimeMonths = months between, and it's only flagged recessionFollowed if that lead is 0–36 months (lines 352–362).
3. The summary stats and the timeline chart
getInversionStats() (line 227) aggregates over the selected spread's inversions: total count, recession hit-rate (% followed by a recession), avg/min/max lead, avg/deepest depth, longest duration.
The inversion timeline chart uses getSpreadSeriesFor() (line 319) — the same base-path × transform, sampled quarterly, with recession shading from the RECESSIONS ranges.
Honest caveat on data lineage
The current spread value (the live "2s10s is +37bps" reading) is live — currentSpreadBps() reads the actual live curve (FRED when keyed).
But the historical inversion analysis is curated (10Y-2Y) or model-derived (all other spreads) — the non-2s10s inversions come from transforming the stylized 2s10s base path, not from independently pulling each spread's full daily history from FRED. That's the README's "history & inversions are curated/computed" note.
If you'd like, I can make the inversion detection fully live — pull each spread's real daily history from FRED (we already do this for the point-in-time curves via /api/econ/curve-history) and run the same negative-run detection on the actual series, so 10Y-3M, 5Y-2Y, etc. reflect genuine historical inversions instead of the transformed base path. Want me to wire that up?

, I can make the inversion detection fully live, I want all of them detected, including 10Y2Y.  I want to show all unique inversion periods