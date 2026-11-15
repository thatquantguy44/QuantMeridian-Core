# Presidential Impact data contract — first version

The authoritative TypeScript shapes are `src/lib/presidential/contracts.ts` in
QuantMeridian. Import is one local JSON object with `schemaVersion: 1`; no runtime
source fetch or automatic simulation occurs. The downloadable template contains
fictional examples and must retain illustrative status until replaced with actual
user-supplied observations and source records.

| Field | Contract |
| --- | --- |
| `id`, `title` | Nonempty dataset identity and label |
| `kind` | `ILLUSTRATIVE` or `USER_SUPPLIED`; neither is independent source verification |
| `currency` | Explicit supplied currency; no conversion performed |
| `returnBasis` | `TOTAL_RETURN` or `PRICE_RETURN`; no substitution |
| `nominalReal` | Required `NOMINAL`; real-return input unsupported in this version |
| `sources[]` | Unique `id`, `title`, nullable `locator`, optional note; referenced IDs must exist |
| `levels[]` | Unique ISO date, positive finite `value`, `sourceId`; observed index levels only |
| `controls[]` | Unique `id`, half-open `startDate`/`endDate`, president ID/name, presidency/House/Senate labels, `sourceId` |
| `windows[]` | Unique `id`, label, `kind`, requested start/end, `decisionDate`, and explicit `complete` flag |
| `fundamentals[]` | Observation date, nullable availability date, nullable valuation and policy rate, valuation definition and source ID |

Dates are strict `YYYY-MM-DD`; rollover values are invalid. Numerical strings,
booleans, infinities and NaNs are not numbers. Empty/missing evidence is not zero.
The UI caps raw JSON at 5 MiB; the parser caps each record array at 100,000. Unknown source
references, duplicate identities/level dates, overlapping control intervals and
inconsistent valuation definitions are rejected with actionable messages.

## Window semantics

`kind` is `CALENDAR_YEAR` or `PRESIDENTIAL_PERIOD`. Requested start precedes end,
and decision date is no later than start. A complete annual window requests
December 31 of the prior year through December 31 of the labeled return year.
The preceding close is the starting level, not a first observation selected after
the return period began. Partial windows are separate and excluded by default.

An actual endpoint is the latest supplied date on or before the requested date,
within an explicit tolerance. Default tolerance zero means exact date matching;
the configurable bound is 0–31 calendar days. There is no interpolation. Both
actual dates and levels remain in every computed row. A nonpositive elapsed span,
missing endpoint or nonfinite calculated return cannot enter a valid summary.

The political state is selected at the supplied decision date. Normalized control
intervals split on any institution change and cannot overlap. Gaps are possible
but remain unavailable. Allowed labels are `D`, `R`, `OTHER`, `TIED`, `UNKNOWN`;
only eligible D/R combinations join the six-category comparison. Retain a mixed
control flag for changes over the selected actual return interval.

## Fundamentals and information availability

Select the latest supplied eligible record whose observation and non-null
availability dates are no later than the decision date. Unknown availability
does not pass this join. If no eligible record exists, returns can still be
analyzed while the corresponding scatter values stay missing.

This is a day-level supplied assertion, not verification of intraday release time
or a real-time data vintage. Same-day eligibility requires the user to have
established that it was known at the chosen decision cutoff. Do not label a modern
revised series point-in-time merely because its observation date is old.

Valuation is a ratio with an explicit definition. `policyRatePct` is in percent
units, while output returns are decimal fractions. The first version does not
mix different valuation definitions or use later rate changes as inherited inputs.

## Outputs

Each window result retains requested/actual dates, endpoint levels, cumulative
and annualized returns, selected metric, at-origin political labels,
configuration/government-structure category, mixed/partial flags, selected
fundamental metadata, inclusion status and reasons. Wrong-kind windows remain
labeled in the audit ledger, rather than being pooled with the chosen analytical
unit. The selected comparison can group included windows by configuration,
president, House, Senate or unified/divided government. A group with at least two
distinct supplied administrations receives a deterministic 2,000-resample,
95% administration-cluster range for its arithmetic mean. It is descriptive
only—not a causal confidence interval, hypothesis test or forecast result.

The on-screen ledger shows 100 rows per page; downloads retain all rows.
Scatters above 2,000 eligible observations and timelines above 2,000 intervals
display explicit figure-unavailable states. No plotting sample is substituted,
and normalized input remains complete in the manifest.

CSV labels both the selected comparison kind and each row's actual kind. Exported
numeric fields retain floating-point round-trip precision; display rounding is
separate. Text cells are formula-safe and quoted where required; negative numeric
returns remain numbers.

The run manifest contains normalized replay input, configuration, analysis,
sources and separately labeled author opinion. `runId` hashes canonical dataset,
config and method-version identities. Export time and commentary are outside
numerical identity. Unknown raw-file hash/code revision remain explicitly null;
the normalized-data hash cannot substitute for them.

Source S001's supplied prose, approximate returns and missing chart do not populate
an observed dataset. The original annual assignment, P/E and annualization
conventions remain unresolved. Every MVP output is an independent reconstruction,
pending a separate original-source reproduction/admission process.
