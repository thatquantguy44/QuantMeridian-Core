# PORA Help & FAQ

## Quick start

1. Open PORA under Optimization.
2. Select either the SPY unadjusted close or the derived total-return index.
3. Choose **Inspect source history** to check the retained evidence and display coverage.
4. Use **Export source CSV** to save the returned series and source details.
5. In Multi-asset source comparison, select two to four candidate ETFs and choose **Check multi-asset history**. Export the aligned returns if needed.
6. Choose **Capture research snapshot** to recheck and freeze the selection, then export its JSON. To replay an export, use **Import snapshot JSON**; the file is checked locally.
7. Review the snapshot qualification report and export its JSON if needed. It lists checks and unresolved requirements for each asset; model admission remains blocked.

The page starts empty. It does not select a synthetic sample automatically.

## Screen guide

The source panel shows the selected basis, observation range, count, latest value, source check and latest warehouse ingestion. The multi-asset panel compares explicitly selected SPY, AGG, ACWI and BIL histories over 253 retained NYSE sessions and exports the 252 aligned derived returns per asset. The chart shows up to the latest 260 observations; the table shows the latest ten. The CSV includes all returned observations. The research snapshot panel shows the content ID, capture time and coverage. It can export the JSON and replayed returns. Its qualification report identifies internally checked coverage, return calculations and source references, as well as unresolved asset identity, currency, source rights and membership evidence. The exported report is tied to the snapshot ID. Version 2 snapshots also bind the available per-asset EcoMedallion catalog record, Tiingo manifest mapping, unit label and local update timestamps. The table flags missing, failed or conflicting catalog evidence. The portfolio and regime panels identify capabilities not yet available.

## Assumptions and defaults

The close excludes dividends. The derived total-return index uses retained Tiingo close, dividend and split inputs; it is not a published total-return index. The retained series is current-vintage history, not a point-in-time archive. Multi-asset checks use the warehouse NYSE calendar and the earliest selected latest date, disclose each asset’s latest date and future Gold exclusions, and reject missing or off-calendar records. Snapshots are held in the current browser session unless exported; they are not admitted to a model. Each capture records a fresh check time, so a later recapture has a different ID even if values are unchanged. No portfolio weights, costs, regime labels or forecasts are assumed.

## FAQ

### Does a successful check mean the provider is live?

No. It checks retained warehouse inputs and receipt records. Observation dates, warehouse ingestion and the time of the source check are different things.

### Does a snapshot hash prove the source is authentic?

No. SHA-256 checks whether the parsed content matches its ID. An imported file may have been altered and rehashed; its receipt payloads and origin are not rechecked. The replay is labeled as imported and unverified. Raw provider receipt payloads are not included in the export.

### What does snapshot qualification mean?

The report explains what was checked and what is still missing; it does not approve the snapshot for a model. A dated local investigation is shown separately: the reviewed upstream manifest labels the four ETFs USD, but that particular review is not bound to the snapshot. New version 2 captures independently include available local catalog labels and mapping timestamps in the hashed snapshot. These are current configuration records, not provider-verified currency, stable security identifiers, provider publication times or point-in-time evidence. Older version 1 snapshots remain importable and do not contain catalog records. Missing, failed and conflicting metadata remains explicit. Catalog records in imported files have not been independently rechecked. The reviewed local calendar misclassified two ad-hoc exchange closures; those examples were refreshed locally, and the local EcoMedallion runtime was updated to the merged fix. The catalog remains partial. The actual account's Tiingo rights remain unknown. These historical findings are not a live check of the current warehouse or of an imported file. Capture checks retained source records and receipts. Import checks file integrity and internal consistency but does not recheck origin or receipt contents, and a matching unkeyed hash is not proof of authenticity. The warehouse calendar is not independently verified. Current-vintage data does not establish point-in-time availability. Admission policy and a reviewed model binding remain unresolved.

### Can I optimize a portfolio or run a regime model?

Not yet. A qualified multi-asset snapshot, reviewed numerical model and independent checks are still needed.

## Troubleshooting

If a check fails, confirm the local warehouse connection and retained inputs and receipts. The single-SPY check also requires VIX evidence; the multi-asset check does not. The page clears old results and does not substitute another source. Changing basis cancels an in-flight check. An oversized, altered or malformed snapshot is rejected; no partial replay is shown.

## Glossary

- **Observation date:** date attached to a retained data point; not a publication timestamp.
- **Current vintage:** the revisions retained now, without proof they were available at an earlier decision date.
- **Source check:** time the server checked the retained evidence.
