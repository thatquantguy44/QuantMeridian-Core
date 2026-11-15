# Spec024 — Presidential Impact Lab

- Stable module ID: `presidential-impact`; terminal mnemonic: **PRES**.
- Target repository: QuantMeridian, local directory `market_terminal`.
- Route: **`/presidential-impact`**, under Markets.
- Scope authority: the user requested a research-module spec and confirmed a
  runnable first version, alongside the replication and inherited-conditions work.
- Implementation status: see [validation](VALIDATION.md); this document specifies
  the product and scientific boundaries, not empirical findings.
- Local use: [run instructions](HANDOFF.md).

## Objective

Let the researcher load explicitly sourced observations, inspect political-control
comparisons and inherited conditions, test exclusions, and export figures and
replayable calculations for the Presidential Impact report. Keep the seed
article's claims, an independent reconstruction, original extensions and personal
opinion distinguishable.

The first version must perform useful descriptive analysis on imported data. It
must also work offline on explicitly selected fictional examples. A runnable
application is not a reproduced study: the original exhibit, definitions and
historical data are still missing from the research project.

## Inspected architecture and assumptions

The repository actually runs React 18, TypeScript, Tailwind, Vite 5 and React
Router. Its architecture document also describes a target Next.js system; that
target is not the implementation basis for this module. Existing installed
dependencies suffice. No new service, database schema, provider, key or package
is required for the first release.

Build in an isolated worktree, then apply only the reviewed presidential files
and necessary route/navigation changes to the active checkout. Preserve existing
FX work and do not modify Sources & Uses/spec012, pinned agent skills, credentials,
Gold data, or shared provider/provenance implementation.

The first version accepts browser-local JSON research datasets. CSV intake,
direct Gold connectors and public-data acquisition are follow-up capabilities;
the initial version exports CSV. No automatic simulated-data fallback is allowed.

## Functional requirements

| ID | Requirement |
| --- | --- |
| PRES-01 | Register gated `PRES` navigation and route. Append its nav entry so existing shortcut indices remain stable. Suppress the default streaming badge. |
| PRES-02 | Start empty. Permit a local JSON import up to 5 MiB, a downloadable fictional template, and an explicit illustrative-data action. Invalid input must not replace the last valid dataset. |
| PRES-03 | Validate the versioned [data contract](DATA_CONTRACT.md): sources, positive finite index levels, strict dates, unique IDs, consistent definitions and nonoverlapping dated political intervals. |
| PRES-04 | Distinguish `ILLUSTRATIVE` from `USER_SUPPLIED`. The latter means supplied observations, not independently verified history. Illustrative results remain visibly labeled in screen and figure exports. |
| PRES-05 | Keep calendar-year and presidential-period comparisons separate. Expose cumulative versus annualized return, partial-period inclusion and an explicit previous-observation endpoint tolerance. |
| PRES-06 | Calculate only from observed supplied endpoints. Show requested/actual dates, levels, basis and exclusions. No interpolation, null-to-zero behavior or total/price-return substitution. |
| PRES-07 | Classify at the supplied decision date using half-open control intervals. Preserve mixed-control diagnostics and unclassified states; missing/tied/other control is not split Congress. |
| PRES-08 | Display selectable political-configuration, president-party, House-control, Senate-control and unified/divided-government means, medians, ranges, window counts and distinct supplied administration IDs. Show unavailable/empty groups without inventing values. When at least two administrations are represented, show a clearly labeled descriptive administration-cluster resampling range for the mean; never present it as causal inference. |
| PRES-09 | Provide a signed, zero-axis return comparison; valuation-return and policy-rate-return scatterplots; and a dated political timeline. Preserve readable labels, units and source provenance. |
| PRES-10 | Use only supplied fundamentals observed and available no later than the decision date. Unknown availability produces missing chart values. Make the day-level availability limitation explicit. |
| PRES-11 | Keep the full sample primary. Compare separate 2008/custom-year sensitivities consistently across categories; preserve excluded observations and reasons. A term overlapping an excluded year is removed as a whole, not recalculated as an invented crisis-free term. |
| PRES-12 | Export full-precision observation/analysis CSV, vector SVG, PNG and a self-contained JSON run manifest. Distinguish data precision from rounded display. Protect textual CSV cells from formula execution. |
| PRES-13 | Bind normalized input, configuration and method version to a stable SHA-256 run ID. Keep commentary and export time separate from numerical identity. Preserve sources, exclusions and limitations in replay exports. |
| PRES-14 | Provide a manually authored interpretation field, labeled author opinion. Never generate a conclusion or attribute a political view to the user. Notes persist only through explicit export. |
| PRES-15 | Clearly identify unimplemented inference/prediction and missing primary-source verification. No causal attribution, party-winner recommendation or exact-replication badge follows from importing data. |

## Scientific rules

### Returns and periods

For positive index levels, cumulative return is `end / start - 1`. Annualized
return is `(end / start) ** (365.2425 / elapsed_days) - 1`, using actual selected
endpoint dates. This is a documented method choice, not the seed's confirmed
annualization convention. Returns are decimal fractions internally and in CSV;
policy-rate inputs use percent units and are labeled separately.

A complete calendar-year window requests preceding December 31 through the
following December 31. The preceding-year endpoint is necessary. A missing 1935
endpoint must not silently become the first 1936 observation. Presidential-period
windows are explicit supplied dates, not assumed completed four-year terms.

Default endpoint tolerance is zero days. The user may explicitly allow a previous
observation up to 31 calendar days earlier. Future observations are never selected,
and unmatched endpoints remain excluded. Partial windows are excluded by default.
Nominal total-return and nominal price-return datasets are supported separately;
real returns require a later inflation/availability contract and are unavailable.

### Political classification and inherited conditions

The MVP uses supplied, normalized combined control intervals: split an interval
whenever the presidency, House or Senate control changes. Classification is at
`decisionDate`; actual subsequent changes appear only as descriptive diagnostics.
The source article's annual assignment convention is unknown. Consequently all
results are **independent reconstruction**, not automatically exact replication.

Derive the six D/R-president × D-congress/R-congress/split-congress categories only
when the supplied control labels support them. Retain `OTHER`, `TIED` and `UNKNOWN`
without coercion. Count distinct administration IDs without calling repeated
annual windows independent presidential trials.

Inherited-condition joins require `date <= decisionDate` and a non-null
`availableDate <= decisionDate`. Same-day availability is an operator-supplied
day-level assertion: it does not verify that a release preceded an intraday
decision. Use earlier dates conservatively when that assertion cannot be made.
The first version does not validate external release timestamps or vintages.
Never silently mix P/E with CAPE or other valuation definitions.

### Scope of the additional angle

The first version supplies inspectable inherited-condition scatterplots,
matched-window inputs and a deterministic descriptive administration-cluster
resampling range for grouped arithmetic means. The range preserves repeated
windows within a supplied administration, but is not a causal confidence
interval, hypothesis test or forecast evaluation. The module does **not** fit
conditional models, estimate a causal presidential effect, or run chronological
forecasts. Those capabilities require a separate approved method and adequate
effective sample. They must not appear as working controls or be approximated by
an unlabeled regression line.

## Visual and export contract

Figures must retain sign and a visible zero baseline where applicable. Each
export carries figure title, sample/window kind, return metric and basis,
currency/nominal status, inclusion and assignment conventions, source IDs,
included count and run identity. SVG and PNG use a readable paper background and
captions that are not clipped. Illustrative exports have an unmistakable DEMO
watermark. Missing chart data produces an explanatory state, not a fabricated dot.

Paginate the ledger at 100 rows; retain all rows in exports. To bound browser
rendering, scatters above 2,000 eligible points and timelines above 2,000 intervals
show explicit unavailable figures instead of sampling or truncating the data.

The JSON manifest contains canonical input observations, configuration, numerical
analysis, source metadata, method version, stable run ID and separately labeled
author text. Its time is a local-clock claim. Raw-upload byte hash and embedded
code revision may remain explicitly null; the canonical normalized dataset hash
must not be described as either. Preserve module source for replay. Local exports
are not an external publication or a source-permission determination.

## Existing patterns and boundaries

Use `PageHeader`, `Panel` and terminal styling. Reuse the *patterns* of validated
research intake, FX snapshot identities and VIXR precision-preserving exports.
Do not adopt domain-specific permissions or data behaviors wholesale.

In particular, do not reuse total-return/price fallback in `chartSeries`, seeded
paths/interpolation in Market Lens, or assume `goldStore().asOf()` provides the
required latest-known-before-cutoff join. Do not change these shared systems as
part of this module.

## Acceptance criteria

| ID | Independent check |
| --- | --- |
| AC01 | A clean visit is empty; explicit demo is fictional throughout; invalid JSON/oversize import leaves existing valid analysis intact. |
| AC02 | Known endpoint levels produce independently calculated positive and negative returns; CAGR uses actual selected dates. Nonfinite/overflow results are unavailable, never valid statistics. |
| AC03 | A requested total-return analysis cannot consume price-return input by fallback; missing endpoints are excluded unless the explicit previous-date tolerance admits them. |
| AC04 | Exact interval boundaries select one control state; overlapping intervals, gaps and unknown labels are diagnosed without inventing split control. |
| AC05 | Intra-window changes retain mixed-state flags; decision classification and retrospective timeline remain distinct. |
| AC06 | Annual/term and partial/complete outputs cannot silently pool. Wrong-kind rows remain identifiable in the ledger and CSV. |
| AC07 | Future/unknown-availability fundamentals never enter inherited-condition points; valuation definitions remain explicit and consistent. |
| AC08 | Full-sample results remain visible beside consistent 2008/custom sensitivities. Counts, administration IDs and exclusions reconcile to the ledger. |
| AC09 | Repeated identical normalized input/config/method produces identical numerical output and run ID; changed commentary alters its separate identity, not the numerical run. |
| AC10 | CSV preserves numerical precision, safe textual cells, row kind and selected kind; SVG/PNG preserve captions, sources, units, negative signs and demo status. |
| AC11 | Browser tests cover demo/import/controls/exclusions/author notes/downloads and confirm the module makes no data/provider requests. |
| AC12 | Typecheck, focused tests and client/server builds pass; existing navigation routes and shortcut ordering remain intact. Preserve unrelated dirty files in the target checkout. |

## Implementation paths and commands

```text
docs/specs/spec024/{SPEC,DATA_CONTRACT,PLAN,TASKS,VALIDATION,HANDOFF}.md
src/lib/presidential/{contracts,validation,engine,fixtures,exports}.ts
src/lib/presidential/*.test.ts
src/components/presidential/*
src/app/presidential-impact/page.tsx
src/App.tsx; src/lib/nav.ts; src/lib/nav.test.ts
settings/modules.config.json
test/presidential-impact.spec.ts
docs/guides/markets/pres-{help,whitepaper}.md
```

```sh
npm run typecheck
npm test -- --maxWorkers=1 --minWorkers=1 --no-cache
npm run build
npx playwright test test/presidential-impact.spec.ts --retries=0 --workers=1
npm run check:agent-skills-pin
npm run check:gold-policy
npm run dev
```

Use an isolated port/cache when another developer server or worktree is active.
Do not kill the user's server or install a browser/provider silently.

## Follow-up scope

New source acquisition and vintage admission; a validated original-article comparison;
CSV multi-file intake; inflation-adjusted returns; explicit intraday availability;
Gold connectors; conditional models and chronological prediction; PDF memo export.
Each needs its own data/method acceptance work. No full replication or market
finding is implied by delivery of the MVP.

## Local pipeline integration status ([MarketMedallion spec 016](https://github.com/thatquantguy44/market-medallion/blob/main/specs/spec016/README.md))

The optional local MarketMedallion reader, explicit snapshot selection, paired
comparison, year-end cycle view and offline provenance replay shipped in
[PR #220](https://github.com/thatquantguy44/QuantMeridian/pull/220). Frozen
historical data reproduces the retained donor output; live retrieval and exact
seed-article replication remain unqualified. See [handoff](HANDOFF.md) for
setup and limits. Original manual and illustrative inputs remain available.
