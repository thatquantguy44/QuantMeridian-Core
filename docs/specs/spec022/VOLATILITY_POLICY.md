# FXR-S03: selectable-window descriptive volatility

**Branch:** `feat/fxr-volatility`, based on merged PR #200 (`b5b86b7`).
**Updated:** 2026-10-31. **Status:** implemented locally after the owner directed delivery on 2026-10-31.
See [VOLATILITY_IMPLEMENTATION.md](VOLATILITY_IMPLEMENTATION.md) for evidence and operation.
The owner requested this focused branch covering policy, calculation, UI and replay.

## Confirmed owner choices

- Offer **5, 21, 63, 126 and 252** return windows.
- Let the user choose **annualized or non-annualized** volatility.
- Keep this work within FX Research. S01/S02 source, purpose and freshness
  approvals remain in force; these choices do not approve exposure/hedge use.

The delivery uses the reviewed method, defaults, history extension and bounds
below. The owner subsequently directed starting the complete volatility slice;
this does not approve broader FX research, export or hedge behavior.

## Calculation policy

For a window of N returns, require N+1 positive finite pair levels on consecutive
expected TARGET observation dates, ending at the selected common source date.
Construct direct, inverse and cross levels from qualified same-date ECB legs.

```text
r[i] = ln(q[i]) - ln(q[i-1]), i = 1..N
mean = sum(r[i]) / N
dailySigma = sqrt(sum((r[i] - mean)^2) / (N - 1))
annualizedSigma = dailySigma * sqrt(252)
displayPercent = 100 * selectedSigma
```

Use mean-centered **sample** standard deviation, not population standard
deviation or uncentered root-mean-square returns. Work in decimal log returns;
round only for display. Use numerically stable variance accumulation and log
differences to avoid avoidable ratio overflow. Nonfinite calculations fail with
an explicit metric reason.

**Non-annualized** means the standard deviation of a single observed daily log
return estimated from the selected window. It does not mean the volatility of
the total N-interval return. Do not multiply by sqrt(N). **Annualized** applies
the fixed sqrt(252) reporting convention to that same daily estimate; do not use
sqrt(N), the observed calendar span or a variable count of dates in that year.
This is descriptive scaling, not a forecast or a claim of independent returns.

| Window control | Returns required | Levels required |
| --- | --- | --- |
| 5 | 5 | 6 |
| 21 | 21 | 22 |
| 63 | 63 | 64 |
| 126 | 126 | 127 |
| 252 | 252 | 253 |

These are observed-return windows, not promises of exact calendar weeks/months
or years. A Friday-to-Monday move is one consecutive TARGET interval; retain its
actual dates and do not interpolate weekends or divide its return by elapsed days.
The shorter windows are more sensitive to individual observations; no confidence
interval or forecast is supplied by selecting a longer window.

## Availability and evidence

- Keep the same four pairs and three Gold legs. Preserve S01 latest-row guards
  before selecting historical observations; an older endpoint cannot repair a
  blocked latest leg.
- Require the full N-return window. Missing, invalid or conflicting observations
  block affected windows without filling, bridging, dropping rows or shortening
  the requested window. Other complete windows/pairs can remain available.
- Distinguish insufficient leading history, internal gaps, unsupported calendar,
  stale endpoint, source/retention failure and invalid arithmetic. A complete
  constant-return window can have measured zero volatility; missing data cannot.
- Follow S02's stale rule: current volatility is unavailable after endpoint
  freshness fails. Preserve the immutable captured value as dated historical
  evidence, separately from access-time current eligibility.
- Recompute cross returns from the derived cross series. Never add component
  volatilities or assume zero correlation. For exact inverse log-return series,
  returns change sign and volatility is equal within numerical tolerance.
- Every available value exposes requested N, actual return/level counts, first
  and last level dates, first and last return intervals, elapsed calendar span,
  pair direction, units, scaling mode/factor, estimator and method version,
  source cutoff, evidence identity and current-vintage limitation.

## History and replay policy

The delivered S02 contract captures only 90 dates, at most 320 projected rows,
using a reviewed 2026–2028 calendar. It cannot supply a 252-return window. The
longer-window work must therefore be explicit, rather than deriving a shorter
estimate under a 252 label.

- Add a **separately versioned volatility artifact** and bounded capture of the
  latest 253 expected observation dates for the same four-pair universe. Preserve
  existing level/history v1 identities, definitions, 90-date history display and
  deterministic replay unchanged.
- Review historical TARGET calendar coverage back through **2025** before
  admitting those older dates. Store the exact new calendar definition/version;
  never mutate the frozen S01/S02 policy definitions. Current freshness remains
  governed by its approved calendar; extra historical coverage cannot waive it.
- Capture cap: **1,024 projected source rows**, including the 759 nominal
  three-leg rows, latest guards and duplicate allowance. Preserve the existing
  32-row latest-guard cap. Query one extra row to detect overflow; never truncate
  a successful capture to fit. Keep the **1 MiB artifact cap** and verify that
  representative full-window manifests fit before calling long-window delivery
  complete. Oversized evidence fails explicitly; increasing byte limits would
  require a recorded policy revision.
- Preserve full projected source evidence, date outcomes and daily estimates
  for all five windows. Both reporting modes must reproduce from the same frozen
  input, with the scaling convention included in the artifact identity. Changing
  UI controls does not reread Gold or overwrite a retained artifact.
- Extend the existing shared **500-artifact / 30-day** retention budget to include
  volatility artifacts, rather than creating another independent allowance.
  Apply the same atomic publication, integrity verification, expiry and local
  access gates. New artifact handling cannot invalidate old supported replay.
- Replay recomputes recorded calculations from retained inputs/versions without
  today's Gold; expose immutable capture and current freshness assessment
  separately. Historical replay never authorizes current consumption. Unknown
  original clocks remain null. Research only; FX exports remain denied.

## UI behavior

Use a window selector with all five choices and a clearly labeled **Annualize**
toggle. Initial selection: **21 returns, annualized**. Keep the primary
window result and a comparison table of all five windows, using one shared
scaling mode. Controls should say returns, not calendar days; display **Daily
volatility (%)** or **Annualized volatility (%)** beside every value.

Unavailable long windows remain selectable with explicit counts/reasons; never
silently switch to a shorter window. Window and scaling changes reuse the frozen
capture. Reassess current eligibility at deadlines, focus and refresh, including
responses that expire in transit. Keep accessible table/evidence equivalents,
responsive controls and a verified replay action. A rolling volatility time-series
chart is a separate extension: this slice compares latest trailing windows.

## Independent acceptance cases

| Case | Required result |
| --- | --- |
| Every requested N with exactly N+1 qualified levels | Exactly N log returns and denominator N-1; correct dates/counts |
| Custom three-return oracle −0.01, 0, +0.01 | Daily sigma 0.01 (1%); annualized sigma 0.1587450787… (15.87450787…%); three is test-only |
| All returns equal, including a nonzero constant | Measured zero sample volatility; no assumed zero mean |
| Switch annualization on/off for the same window | Annualized = daily × sqrt(252); same observations and frozen evidence |
| 252 returns requested with only 252 levels | Unavailable: 253 levels required; no 251-return substitute |
| Gap only inside the 126/252 windows | Affected long windows unavailable; complete shorter windows remain available |
| Direct versus exact inverse series | Equal volatility within tolerance; inverse log returns change sign |
| Cross whose component moves offset | Derived-series volatility reflects covariance; not the sum of leg volatilities |
| Stale endpoint or delayed response crossing deadline | No current figure restored; immutable captured value remains historical only |
| Source revision, restart, corruption, expiry, unsupported version | Original valid replay reproduces; invalid replay fails explicitly |
| Older reviewed calendar coverage absent | Long window unavailable with calendar reason; no guessed dates |
| Capture or byte budget exceeded | Explicit failure; no truncated successful selection |

## Delivery sequence and verification

1. Review this policy, particularly estimator/defaults, 252 scaling, historical
   calendar extension and versioned capture/retention bounds.
2. Add independent arithmetic/state tests, then a pure five-window calculator.
3. Implement bounded Gold capture, reviewed calendar evidence, typed artifact,
   immutable storage and deterministic replay, retaining v1 compatibility.
4. Connect window/scaling controls, comparison table, source evidence and replay;
   prove responsive and deadline/failure behavior in a real browser.
5. Run focused and serial full tests, typecheck/build, policy/pin checks and a
   read-only Gold capture/restart/replay check; update the handoff before publishing.

Use the existing scripts: `npm test -- --reporter=dot --no-file-parallelism`,
`npm run typecheck`, `npm run build`, `npm run check:gold-policy` and
`npm run check:agent-skills-pin`. Generate ignored SQZ fixtures on a fresh
checkout with `npm run generate:squeeze-csv`. Numerical/browser cases must use
independent synthetic fixtures rather than requiring the live warehouse.

## Method references

[NIST sample standard deviation](https://www.itl.nist.gov/div898/software/dataplot/refman2/ch2/standevi.pdf)
defines the mean-centered N-1 estimator.
[ORTEX historical volatility methodology](https://docs.ortex.com/reference/bulk_historic_volatility_retrieve)
describes sample daily log-return dispersion and sqrt(252) annualization. These
references explain the implemented conventions; they do not certify ECB data,
source permission, FX forecasts or permission for broader financial use.
