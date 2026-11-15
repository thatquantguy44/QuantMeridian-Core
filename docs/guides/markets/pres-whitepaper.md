# Presidential Impact — Research method

## Executive summary

What conditions did an administration inherit, and what market outcomes followed under the supplied measurement rules? The workspace supports the descriptive first stage of research project `002_PresidentialImpact`. Its purpose is to make definitions, data substitutions and excluded observations inspectable before narrative conclusions are written.

## Business problem

Political-return charts can obscure inherited market conditions, changing government control and inconsistent return windows. A researcher needs inspectable inputs and exclusion rules before presenting a comparison to an investment director. This module supports that reconstruction and export workflow without assuming a partisan conclusion.

## How it works

An analysis selects one family of explicitly supplied windows: calendar years or presidential periods. These families must not be pooled. Each run also specifies cumulative versus annualized return, partial-window admission, permitted endpoint gap and optional sensitivity-year exclusions.

For eligible positive index levels `L0` and `L1`, cumulative return is `L1 / L0 - 1`. Annualized returns depend on the actual selected endpoint interval under the versioned engine method. The ledger and exported run retain both requested and actual endpoints. A price-return index and a total-return index are distinct measurements; the first release accepts nominal returns only.

Political-control categories combine the president's party with unified Democratic, unified Republican or split congressional control at the supplied origin. Unknown classifications remain unclassified. Within-window changes remain visible. This convention is a labeling choice rather than attribution of every subsequent observation to the initial administration.

Category summaries contain arithmetic mean, median, range, window count and distinct administration count. Missing categories have no numerical outcome. Counts do not claim independence, and this version produces no confidence interval, p-value, regression or forecast comparison.

## Data and provenance

Valuation and policy-rate plots use only eligible observations with documented availability on or before the supplied origin. Unknown availability does not become historical knowledge by assumption. Values supplied by the researcher remain unverified even after schema validation. A current revised database series is not automatically a point-in-time historical predictor.

Different valuation definitions are shown separately. A change in valuation measure cannot be hidden behind one unlabeled x axis. A missing inherited condition excludes the affected scatter point while retaining an otherwise valid return and its ledger reasons.

### Local pipeline snapshots

MarketMedallion can publish an explicitly selected, immutable bundle for the
local reader. The consumer verifies byte hashes, the bound manifest and the
sample-level comparison evidence before rendering. Matched series comparisons
are recomputed from the shared sample; inherited conditions retain their own
assumed dates. Cycle research uses the president assigned at year-end, and its
first-year and succession treatments are descriptive views of the same ledger,
not a change to primary at-origin classification. Offline v2 replay embeds the
verified snapshot and selected view. Fictional fixtures are marked DEMO/SIM;
the archived frozen reconstruction has been matched against the donor pipeline.
It is a public-series reconstruction, not the seed article’s exact licensed
S&P 500 data, and does not independently authenticate the historical sources.

## Assumptions

Full-sample results remain primary. Optional year exclusions apply symmetrically: calendar-year windows are excluded by their return year; presidential periods are excluded in full if the declared return interval `(startDate, endDate]` overlaps a selected year. The first included day is the day after the starting baseline. This differs from removing one unfavorable event from one category. The separate sensitivity CSV and manifest pin its exact configuration.

## Outputs and how to read them

The run manifest carries normalized replay inputs, computed results, method version, configuration, sources and a stable calculation identity. Source revision and historical availability claims must come from supplied evidence; the interface does not invent them. Code-revision metadata is not certified by a browser-only run.

SVG and PNG exports retain method, currency, return basis, source IDs, included-window count, run identity and input-quality label. Fictional fixtures are explicitly marked DEMO. User-supplied data is explicitly unverified. Figure captions and the manifest support review; the existence of an export does not approve licensed-data redistribution.

The researcher's narrative is retained as separately identified author opinion. Original interpretation can discuss mechanisms, inherited conditions and competing explanations, but should not present calculated association as a causal effect or investable signal.

## Validation

Dataset validation enforces the declared schema, finite observations, positive index levels, date and interval rules, source references and supported nominal-return contract. Independent engine cases check return arithmetic, at-origin classification and availability, missing endpoints, partial windows and sensitivity rules. Browser verification covers local imports, retained valid state after rejection, explicit DEMO selection, definitions and exports.

Chart domains are normalized before padding and projection so accepted finite extremes do not produce overflowed coordinates. Percent labels use scientific notation when direct multiplication would overflow. A scatter above 2,000 eligible observations or timeline above 2,000 intervals is explicitly unavailable; no silent sampling occurs. All inputs remain in the manifest and calculated return rows remain in the paginated ledger and CSV.

## Limitations

Exact replication requires the seed article's original charts, data definitions and source entitlement. Incremental-information models require a separately frozen specification, parsimonious baselines and chronological evaluation with historical availability. Real-return analysis requires an explicit inflation-index and timing contract. These remain later research stages rather than hidden capabilities of this descriptive workspace.

## Status and governance

This is a local descriptive first version for `002_PresidentialImpact`. No historical dataset is bundled as verified evidence and no provider fetch occurs in this workflow. Researcher-supplied data remains unverified; synthetic fixture results remain DEMO. Browser code revision and local timestamps are not independent verification receipts. Preserve the method source and run manifest for review.

## References

- Presidential Impact module specification and data contract: repository `docs/specs/spec024/`.
- Research project: website repository `docs/research/002_PresidentialImpact/`.
- Inspectable implementation: `src/lib/presidential/` and `src/components/presidential/`.
- Seed-article findings and their definitions must be established through the research evidence matrix before being cited as reproduced results.
