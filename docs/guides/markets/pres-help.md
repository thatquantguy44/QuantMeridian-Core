# Presidential Impact — Help & FAQ

## Screen guide

Compare nominal market-index returns across political-control labels, inspect the conditions available at a window's origin, and export figures and replay inputs for a research article. This first version is a local descriptive tool. It does not estimate causal presidential effects, forecast returns, or certify replication of a published chart.

## Quick start

Open **PRES** at `/presidential-impact`. The workspace starts empty. Choose **Load illustrative dataset** to test it with fictional data, or import a source-backed JSON file or select a published local pipeline snapshot. **Download JSON template** provides the complete fictional example and field structure. Replace observations, definitions, source references and `kind` before using your own evidence.

Imports are processed in the browser and capped at 5 MiB. No provider request or file upload is needed. Use `USER_SUPPLIED` for your own dataset; this label means unverified. `ILLUSTRATIVE` inputs and all their exports retain a DEMO label.

## Load a local pipeline snapshot

The optional MarketMedallion reader is disabled by default and is intended for
local use. Start QuantMeridian with `PRES_RESEARCH_LOCAL_ENABLED=1` and
`PRES_RESEARCH_ROOT` set to the absolute path of a published MarketMedallion
workspace. In PRES, explicitly check the local catalog and select a snapshot and
dataset. The reader does not fetch providers. A failed refresh retains your
current dataset and notes. Synthetic test bundles display DEMO/SIM. The frozen historical reconstruction
was independently compared with a fresh donor rebuild; inspect its sources and
limitations before drawing conclusions.

For a complete publication, paired views use the same audited years and show
symmetric sensitivity exclusions. Cycle views group by the president at
calendar year-end and identify transition/succession cases separately. Export
the pipeline run manifest to preserve the selected evidence and view; importing
that manifest can replay it offline. Keep exports with the accompanying source
and rights information.

## Assumptions and defaults

- Positive dated index levels, one declared currency and either total-return or price-return basis. The initial version accepts `nominalReal: "NOMINAL"` only.
- Normalized political-control intervals, split whenever the president, House or Senate control changes. Interval end dates are exclusive; return-window endpoint semantics are separate.
- Explicit calendar-year or presidential-period windows with a decision date and a completed/partial flag.
- Optional starting valuation and policy-rate observations with their source, observation date and availability date. An unknown or later availability date cannot establish knowledge at the window origin.
- Source IDs that resolve to the dataset's source registry, with definitions and access/reuse notes you can defend.

## How do controls affect the analysis?

Calendar-year and presidential-period windows are analyzed separately. Choose cumulative or annualized returns, whether partial windows are eligible, and the maximum permitted endpoint gap. The default gap is zero; the UI supports integer gaps through 31 days. Always inspect the actual endpoint dates and levels in the ledger.

The full sample remains the primary analysis. The 2008 switch and optional additional years create a separate sensitivity: annual windows are excluded by their return year, and whole presidential periods are excluded when their declared return interval `(startDate, endDate]` overlaps a selected year. The baseline day is not an extra exposure year. Exclusions apply consistently across categories. This may remove an entire presidential period containing 2008. Download that sensitivity's own CSV and manifest when citing it.

Political groups are classified at the supplied origin. A control change within a window remains flagged; the result is not continuous attribution to one party. Blank categories are unavailable, not zero-return outcomes.

## FAQ

### Why is a scatter point missing?

A window needs a valid return and an eligible at-origin fundamental. The observation and its recorded availability must precede or equal the origin. A missing fundamental does not invalidate a calculable return. The ledger retains omission reasons. Different valuation definitions are shown separately rather than pooled onto one axis.

## How do I save work?

Download the analysis CSV and run manifest. The manifest retains normalized inputs, configuration, method identity, computed results and your separately labeled opinion. Its run ID identifies the dataset, method and configuration. Your notes do not change that calculation identity.

Each figure has SVG and PNG exports containing its caption, source IDs, run identity and the input-quality label. Standalone figures should travel with the run manifest. A DEMO label must remain visible if illustrative numbers are used to explain the interface.

This browser session is temporary. There is no automatic save, remote workspace or durable archive in the initial version.

### Can I describe the result as a presidential effect?

These comparisons are descriptive associations among small, dependent sets of historical windows. Repeated years share administrations; political labels, inherited valuations, monetary conditions and shocks are not randomly assigned. A scatter alone does not show incremental explanatory value or causality. Keep published findings, your reconstruction and your opinion separate.

## Troubleshooting

Malformed, invalid or oversized imports show a validation error and preserve the last valid dataset, configuration and author notes. Correct the file before retrying. No new dataset is admitted until validation succeeds.

Scatters above 2,000 eligible observations and timelines above 2,000 intervals display an explicit figure-unavailable state. No points or intervals are silently sampled. All inputs remain in the run manifest; return results remain in the ledger and CSV. The ledger paginates rows for browser responsiveness.

Very large or small finite numbers use scientific notation where fixed percentages would overflow or lose precision. A nonrepresentable chart displays an explicit unavailable state rather than invalid vector coordinates. If export is disabled, allow local run identity creation to finish and inspect any error. Use a secure localhost browser context for Web Crypto.

## Glossary

- **Origin:** the supplied decision date used for political labels and fundamental availability checks.
- **Endpoint gap:** the permitted calendar-day distance from a requested endpoint to its selected observation on or before that date.
- **Nominal:** returns before adjusting for inflation. Real returns are outside this version.
- **Run manifest:** normalized replay inputs, method and configuration, results, calculation identity and separately identified author opinion.
- **Illustrative:** fictional software demonstration inputs, always labeled DEMO.
