# PORA local source-evidence investigation — 2026-11-12

This is a dated investigation of **one local EcoMedallion checkout and its
configured PostgreSQL warehouse**, not a check attached to a PORA snapshot and
not a claim about another installation or a later warehouse state. No warehouse
writes, live Tiingo requests, provider account inspection or simulated data were
used. The investigation does not grant use or export rights, approve inputs for
models, or establish point-in-time availability. The review included the four
explicit candidate tickers SPY, AGG, ACWI and BIL, not their underlying holdings.

## Identity and currency

The local EcoMedallion checkout was at commit
[`7b26d1e9d0e27313e7e367e47d59605ce8db6f7d`](https://github.com/thatquantguy44/EcoMedallion/tree/7b26d1e9d0e27313e7e367e47d59605ce8db6f7d).
Its [Tiingo manifest](https://github.com/thatquantguy44/EcoMedallion/blob/7b26d1e9d0e27313e7e367e47d59605ce8db6f7d/manifests/equity_tiingo.yml)
contains all four ticker names, `units: USD`, `source: tiingo` and
`vintage_enabled: false`. These are pipeline configuration labels, not a
provider-signed or versioned identity, proof of historical currency, or
metadata that was included in and reconciled to a PORA snapshot. The local
`gold.dim_series` query returned **zero** rows for the four bare tickers and
four corresponding `:close` series. The four assets' retained Gold total-return
rows identify them by ticker; that table has no stable instrument or currency
column. A name or ticker alone cannot resolve a security through symbol changes.

| Tiingo Silver close series | Retained rows | First–latest observation | Populated base / quote currency |
| --- | ---: | --- | ---: |
| SPY | 8,504 | 1993-01-29–2026-11-10 | 0 / 0 |
| AGG | 5,818 | 2003-09-26–2026-11-10 | 0 / 0 |
| ACWI | 4,686 | 2008-03-28–2026-11-10 | 0 / 0 |
| BIL | 4,895 | 2007-05-30–2026-11-10 | 0 / 0 |

For each ticker, the local Bronze inventory contained only the Tiingo daily
`/prices` endpoint, with 16–17 receipts per ticker. The **latest** receipt for
each had a ticker and a list of price/action observations; those sampled
observation keys did not contain currency, ISIN, FIGI or another permanent
identifier. This is not an inspection of every historical payload. Tiingo
[documents a separate metadata endpoint](https://www.tiingo.com/documentation/end-of-day),
but finding documentation is not evidence that metadata was retrieved,
retained or matched to these observations. No account or API key was used to
fetch it in this review. PORA therefore keeps **ticker-only identity** and
**currency unknown** for captured and imported v1 snapshots.

## Source rights

The local [licensing register](https://github.com/thatquantguy44/EcoMedallion/blob/7b26d1e9d0e27313e7e367e47d59605ce8db6f7d/config/data_licensing.yml)
classifies Tiingo as provisional, with redistribution and commercial use marked
false under its recorded personal-use policy. This is not a verified record of
the account or an individual contract. Tiingo's [published documentation](https://www.tiingo.com/documentation/)
distinguishes internal/personal and commercial use from redistribution and
states that separate redistribution licensing is needed under the listed plans.
The actual account tier, agreement, local export permissions and intended uses
were not inspected. They remain unknown; a local file export is not evidence of
permission to share, publish or use commercially. The report does not interpret
the account contract or mark rights as approved.

## Calendar and fixed universe

The local `gold.market_calendar` marked both **2018-12-05** and **2025-01-09**
as business days with no holiday name. NYSE Group independently announced
closures on [2018-12-05](https://ir.theice.com/press/news-details/2018/New-York-Stock-Exchange-to-Honor-President-George-H-W-Bush/default.aspx)
and [2025-01-09](https://ir.theice.com/press/news-details/2024/The-New-York-Stock-Exchange-Will-Close-Markets-on-January-9-to-Honor-the-Passing-of-Former-President-Jimmy-Carter-on-National-Day-of-Mourning/default.aspx).
The Gold total-return table had no observations for any of the four tickers on
those dates. The two targeted checks demonstrate errors; they do not establish
whether other dates are correct. EcoMedallion's
[calendar builder](https://github.com/thatquantguy44/EcoMedallion/blob/7b26d1e9d0e27313e7e367e47d59605ce8db6f7d/src/fred_pipeline/writer/terminal_views.py)
accepts manual closures, but the reviewed Gold and local-store calls invoke it
without them. This is a code observation, not proof of which revision populated
the inspected database. No calendar was repaired in this slice.

The previously validated 253-session capture, 2025-11-07–2026-11-10, starts
after both examples. It remains checked against the *warehouse* calendar, not
an independent exchange schedule. PORA rejects a missing selected session;
therefore a window crossing one of these misclassified closures can fail rather
than interpolate. Today the capture selects its latest common window and has
no historical-date control; the risk matters if an old latest date or a future
historical-window feature crosses an affected date. A separate upstream fix and
refresh should cover ad-hoc closures and independent regression cases.

The four ETF choices are an explicitly selected fixed universe, not an archive
of historical holdings or eligibility. Such a selection can introduce
survivorship and selection bias. `CURRENT_VINTAGE` observations and capture time
do not demonstrate what was available at a historical decision time.

## Follow-up local refresh and verification — 2026-11-12

The two NYSE dates were subsequently refreshed in the configured **local**
PostgreSQL warehouse after an isolated rollback rehearsal. The scoped update
recomputed 62 affected NYSE rows and fields, including neighboring-day and
monthly-count fields; a post-commit read found no remaining differences from
the corrected generator for those fields. Before-images were saved outside the
repository. No price table or other market calendar was written. This does not
qualify the rest of the calendar. The EcoMedallion fix was later merged in
[PR #101](https://github.com/thatquantguy44/EcoMedallion/pull/101), and the
local runtime checkout was updated to merge commit `4f962c6`. Two isolated
SQLite Gold rebuilds using retained Tiingo Silver observations verified the
closures and neighboring sessions. A full PostgreSQL Gold rebuild was not run;
the separately corrected local PostgreSQL rows were rechecked read-only.

The NYSE notices above independently establish the closures. Nasdaq's trading
notices document the surrounding trading dates for [2018](https://www.nasdaqtrader.com/TraderNews.aspx?id=ETA2018-99)
and [2025](https://www.nasdaqtrader.com/TraderNews.aspx?id=ECA2024-632).
Read-only PORA checks reconciled retained Gold, Silver and Tiingo receipt values
for all four ETFs on each immediately preceding and following session. These are
source-evidence checks around the two dates, not a complete exchange-calendar
audit or a historical-window UI. The full PORA capture and offline replay also
passed against the refreshed local warehouse.

The `t2_settle_date` field is the chosen calendar's next-business-day operation
applied twice, not an independently verified clearing date. Nasdaq identifies
both closure dates as valid settlement days; the 2025 notice describes T+1
settlement. No settlement schedule was repaired or qualified here.

## Reproducible read-only checks

The following SQL was run in a repeatable-read, read-only transaction against
the configured local PostgreSQL warehouse. It returns catalog metadata and
aggregates only; it does not expose connection strings or raw receipts.

```sql
SELECT series_id, title, source, frequency, units
FROM gold.dim_series
WHERE series_id IN ('SPY','AGG','ACWI','BIL',
                    'SPY:close','AGG:close','ACWI:close','BIL:close');

SELECT series_id, COUNT(*) AS rows,
       COUNT(base_currency) AS base_currency_populated,
       COUNT(quote_currency) AS quote_currency_populated,
       MIN(observation_date) AS first_date, MAX(observation_date) AS latest_date
FROM silver.fred_observation
WHERE source = 'tiingo'
  AND series_id IN ('SPY:close','AGG:close','ACWI:close','BIL:close')
GROUP BY series_id ORDER BY series_id;

SELECT series_id, endpoint, COUNT(*) AS receipts
FROM bronze.fred_api_response
WHERE source = 'tiingo' AND series_id IN ('SPY','AGG','ACWI','BIL')
GROUP BY series_id, endpoint ORDER BY series_id, endpoint;

SELECT calendar_date, is_business_day, is_holiday, holiday_name
FROM gold.market_calendar
WHERE calendar_name = 'NYSE' AND calendar_date IN ('2018-12-05','2025-01-09');

SELECT ticker, observation_date FROM gold.equity_total_return_index
WHERE ticker IN ('SPY','AGG','ACWI','BIL')
  AND observation_date IN ('2018-12-05','2025-01-09');
```

The receipt-shape check additionally parsed the latest retained JSON for each
ticker and listed field names only. Its wrapper had `format`, `ticker`, and
`data`; its observations held price, volume, dividend, split and adjusted-price
fields. It did not save the payload or print credentials.
