# Run Presidential Impact in QuantMeridian

The module lives in the existing `market_terminal` repository. Start its normal
development server using the dependencies already installed:

```sh
cd "/Users/<you>/Documents/Quant Sandbox/platforms/market_terminal"
npm run dev
```

Open the local URL printed by Vite and select **PRES — Presidential Impact**
under Markets, or append `/presidential-impact` to that URL. The default is
`http://localhost:5173/presidential-impact`; Vite may choose another free port.
The module is enabled through the existing module configuration.

The owner directed publishing this module with the completed FXR work in
[PR #200](https://github.com/thatquantguy44/QuantMeridian/pull/200). See
[validation](VALIDATION.md#combined-pr-publication-checkpoint--october-31-2026)
for the combined checks and the master [handoff](../../handoff.md) for the
separate next scopes.

1. Choose **Load illustrative dataset** to exercise the workflow. Every number
   and political interval in that example is fictional.
2. Download the JSON template; replace its observations, intervals, windows and
   source metadata with your admitted research inputs. Set `kind` to
   `USER_SUPPLIED` only after replacing the fictional content. This label does
   not verify the data. Follow [the contract](DATA_CONTRACT.md).
3. Import the local JSON file (maximum 5 MiB). Choose annual or presidential
   periods, cumulative or annualized returns, and endpoint/partial-window rules.
   Inspect the ledger and missing-data explanations before interpreting a chart.
4. Compare a separate 2008/custom-year exclusion against the retained full sample.
   Presidential sensitivities remove whole overlapping periods.
5. Add your own interpretation in the author-opinion field. Download CSV and the
   run manifest, plus SVG or PNG figures for the report. Export the sensitivity
   manifest separately if used.

Inputs and notes are browser-memory only; refreshing or leaving the page clears
them. Export the manifest to preserve the normalized dataset, configuration,
calculations, sources and commentary for replay. Its local timestamp and hashes
are not independent source verification. Preserve the module source as well:
the embedded code revision and raw-upload hash are explicitly unknown.

No provider credentials or live data are needed for this workflow. Existing
terminal-wide services may display unavailable statuses when unconfigured; the
PRES calculation engine uses only the dataset you explicitly load.

The module does not independently acquire historical data, reproduce the seed article,
fit conditional models, estimate causal uncertainty or test forecasts. It does
show a deterministic descriptive administration-cluster resampling range for
group means, which is not causal inference. Those remain
research work, described in `docs/research/002_PresidentialImpact/research-brief.md`
in the research repository. The original article's missing exhibit and conventions remain the
next source-admission dependency.

## Optional local pipeline integration

First publish a qualified local MarketMedallion snapshot, then start the local
application with:

```sh
PRES_RESEARCH_LOCAL_ENABLED=1 PRES_RESEARCH_ROOT=/absolute/path/to/workspace npm run dev
```

Choose **Check for pipeline snapshots** in PRES and explicitly select a snapshot
and dataset. The reader only accepts the local workspace and checks hashes and
source classification. The complete fixture supports matched comparisons, cycle
views, exports and offline run replay. The retained frozen historical snapshot
passed donor parity and browser replay checks; its `CAPTURED_SOURCE` label does
not independently authenticate the original sources. The separate checked-in
test publication is fictional. Source review, operator commands and recovery
are maintained in the [MarketMedallion spec 016](https://github.com/thatquantguy44/market-medallion/blob/main/specs/spec016/README.md)
runbook and acceptance tracker. The local reader is disabled in hosted Vercel
and AWS Lambda environments.
