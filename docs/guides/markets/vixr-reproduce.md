# Reproduce the VIXR results from CSV data

VIX Implied vs Forward Returns (VIXR) tests whether the VIX's 30-day implied
range matches subsequent SPY moves, whether it forecasts realized volatility,
and whether it predicts return direction. This command recomputes those
statistics from data you supply. It does not download market data.

## Inputs

Provide two UTF-8 CSVs, sorted by date with one row per trading day and no
duplicate dates:

```text
vix.csv: date,vix
spy.csv: date,close
```

Dates use `YYYY-MM-DD`. `vix` is the daily VIX close in annualized volatility
points (`20` means 20%). `close` is the **unadjusted SPY price close**, excluding
reinvested dividends. Values must be positive and finite. Rename FRED's
`DATE,VIXCLS` columns to `date,vix`; obtain SPY closes from a provider whose
access and redistribution terms permit your use. The script aligns available
dates and drops incomplete 30-day windows.

## Run

Install Python 3.10 or newer, NumPy, and SciPy. From the QuantMeridian-Core repository root:

```bash
python3 scripts/fixtures/vixr_reproduce.py \
  --vix vix.csv --spy spy.csv --cutoff 2026-10-06 \
  --out vixr_results.json
```

The command prints daily and non-overlapping results for range calibration,
realized versus implied volatility, regression fit, and expanding-window
forecast skill. The JSON file includes the fuller results, date coverage,
cutoff, and SHA-256 hashes of both input files. The default cutoff is October
6, 2026, but pass it explicitly when comparing with the published
[VIXR white paper](vixr-whitepaper.md).

The published 1993–2026 table used a Gold database snapshot that is not
bundled here. Exact agreement needs the same historical prices; vendor
adjustments, gaps, and later observations can change the numbers. The script
does not turn the observed VIX premium into a trading strategy.

## Check the public method without a full data history

The repository includes crisis and calm-market VIX/SPY excerpts. With Node,
Python, NumPy, and SciPy installed, run:

```bash
npm ci
npm test -- src/lib/vixImpliedForward.golden.test.ts src/lib/vixWalkForward.test.ts
python3 -m unittest discover -s scripts/fixtures -p 'test_vixr_reproduce.py'
```

The tests check the calculation on those excerpts. They do not reproduce the
full-history headline table. The separate
[`vixr_reference.py`](../../../scripts/fixtures/vixr_reference.py) regenerates
the golden JSON files from the committed excerpts and rewrites those files
when run.
