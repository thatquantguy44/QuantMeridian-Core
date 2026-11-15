# Trade-flow source register

**Reviewed:** 2026-11-15. **Register version:** 1.

**Admission status: RIGHTS_UNRESOLVED. No real capture approved by this register.**
Kraken spot `BTC/USD` is the selected test source. Its published protocol supports
a bounded trade capture technically; the reviewed terms do **not** establish an
unconditional right for this application to capture, retain and replay it.
Source selection and implementation authorization do not establish provider
permission. This is an evidence register, not legal advice or a rights grant.

Review was limited to official documentation/terms and read-only companion source
inspection. No market-data socket or data-endpoint request, account, provider acceptance,
database, warehouse or historical download was used. No real sample or
independently verified real-trade expected facts are admitted yet.

**Confirmed intended use (2026-11-15):** The user states this is personal,
non-commercial research. Commercial use is not the requested scope. This records
purpose, while applicable personal-use automation, raw retention and local replay
terms still need to be resolved in the scoped admission evidence. No commercial
permission requirement is inferred merely from the project's existence.

## Source inventory

| Source | Coverage and intended use | Qualification / rights state |
|---|---|---|
| Kraken production Spot WebSocket v2, public `trade`, initially `BTC/USD` | Venue-specific crypto spot executions; bounded signed-quantity diagnostic input. BTC base quantity and USD per BTC price; not USD cash flow, SOFR futures or a strip proxy. | Protocol reviewed; actual pair availability and connectivity untested. Raw retention, application use and derived display/export rights unresolved. |
| Kraken public `book` v2 | L2 aggregated price-level quantities, snapshots and updates. | Candidate quote source only; no quote capture, quote/trade join, classifier or cross-channel sequence admitted in these slices. [Book reference](https://docs.kraken.com/exchange/api-reference/spot-websocket-v2/book). |
| Kraken REST public trades / historical CSV | Candidate historical trade evidence and separately reviewed recovery source. | No files fetched, dates independently verified, backfill implemented or retention rights approved. See historical evidence below. |
| EcoMedallion companion | Existing HTTP observation pipeline and daily analytical outputs. | No implemented Kraken or market-tick source found in the reviewed checkout; not an admitted intraday source. |
| SOFR futures trades/quotes | Separate dataset, venue, point-in-time contracts and rights required. | No source or entitlement identified. FRED `SOFR` is an overnight rate observation, not a futures trade feed. |

## Official protocol evidence

All links below were read on 2026-11-15. Pages without a displayed revision date
are identified by that retrieval date, not an invented publication/version date.

| Topic | Documented fact | Diagnostic / capture constraint |
|---|---|---|
| Access | Public market-data endpoints need no API key. [Exchange overview](https://docs.kraken.com/exchange/guides/overview). | Public transport access is separate from permitted use. |
| Production endpoint | Primary v2 public URL is `wss://ws.kraken.com/v2`; TLS/SNI and JSON are required. | No private credentials or trading endpoint needed. [WebSocket introduction](https://docs.kraken.com/exchange/guides/websockets/introduction). |
| Events and batches | Trades may be batched across taker orders. | Preserve each data element. [Trade reference](https://docs.kraken.com/exchange/api-reference/spot-websocket-v2/trade). |
| Side | `side`: taker-order side; `ord_type`: taker order type. | Sign uses provider side; never infer investor identity/intent. [Trade reference](https://docs.kraken.com/exchange/api-reference/spot-websocket-v2/trade). |
| Identity | `trade_id`: sequence number unique per book. | Key includes provider, spot book/symbol and ID. [Trade reference](https://docs.kraken.com/exchange/api-reference/spot-websocket-v2/trade). |
| Clock | `timestamp`: RFC3339 book order update timestamp. | Preserve source precision and local receipt time separately. [Trade reference](https://docs.kraken.com/exchange/api-reference/spot-websocket-v2/trade). |
| Snapshot | Optional snapshot: latest 50 trades; default false. | Forward capture requests `snapshot:false`; snapshots cannot prove recovery. [Trade reference](https://docs.kraken.com/exchange/api-reference/spot-websocket-v2/trade). |
| Numeric precision / timestamps | Kraken says engine precision can be preserved by decimal/string decoding; timestamps are not unique transaction identifiers. | Preserve decimal tokens and distinct IDs at equal times. [WebSocket introduction](https://docs.kraken.com/exchange/guides/websockets/introduction). |
| Symbols / units | The instrument channel supplies base/quote assets, pair status and quantity/price increments/precision; minimum quantity is in base currency. | Qualify `BTC/USD` and units explicitly. Order-entry minimums are not a license to discard smaller observed executions. [Instrument reference](https://docs.kraken.com/exchange/api-reference/spot-websocket-v2/instrument). |
| Unit convention | Kraken's trade-history field guide defines volume in base units and price in quote currency per base unit. | BTC quantity and USD/BTC price for `BTC/USD`; preserve that mapping. [Trade-history fields](https://support.kraken.com/articles/360001184886-how-to-interpret-trades-history-fields). |
| Connections | About 150 connection/reconnection attempts per IP per rolling 10 minutes; exceeding the limit causes a 10-minute IP ban. Inactive connections close after about a minute. | Bound attempts; do not retry aggressively or evade limits. [WebSocket introduction](https://docs.kraken.com/exchange/guides/websockets/introduction). |
| Liveness | Heartbeats are automatic after any channel subscription, about once per second when other updates are absent, and cannot be directly subscribed to. | Use receipt of any message for liveness; a heartbeat does not prove trade completeness. [Heartbeat reference](https://docs.kraken.com/exchange/api-reference/spot-websocket-v2/heartbeat). |
| Disconnects | Maintenance/network/load-balancer events disconnect sessions; reconnect requires resubscription. | A bounded first capture can stop on disconnect and disclose incomplete coverage. [Reconnection guide](https://docs.kraken.com/exchange/guides/websockets/reconnection). |

The trade schema documents no separate contiguous delivery sequence, correction
or cancellation message, replay cursor, or guaranteed complete/sequential
delivery. A per-book sequence identifier does not establish increment-by-one
delivery, absence of corrections, or a known missing-trade count. These are
**unverified guarantees**, not claims that Kraken never supplies them elsewhere.
Do not mark a sampled window complete from timestamps, heartbeats, adjacent IDs
or a successful subscription. Exact batch/replay agreement can establish parity
only for the same retained event prefix and cut, not all venue trades.

One official documentation discrepancy affects implementation: the reconnection
guide illustrates a direct heartbeat subscription, while the channel reference
says that operation is unavailable. Follow the channel-specific reference;
do not send the illustrated heartbeat subscription. This review did not test
either operation against the provider.

## Historical availability and recovery boundary

The [historical-data guide](https://docs.kraken.com/exchange/guides/general/historical-data)
describes public REST `Trades`, up to 1,000 rows per call and `last`/`since`
pagination. It does not supply a WebSocket trade replay service. No call or
cross-interface identity reconciliation was performed here.

The [official time-and-sales download page](https://support.kraken.com/articles/360047543791-downloadable-historical-market-data-time-and-sales-),
updated 2026-10-12, advertises per-pair public-trade history from each market's
first trade through 2026-09-30 and quarterly updates. It lists timestamp, price,
volume, side, order type, miscellaneous and trade ID columns. These advertised
dates are not inspected archive coverage. The historical-data guide's statement
that no bulk dump exists conflicts with this support page; resolve that
discrepancy before selecting an archive. Neither page by itself settles this
application's retention or redistribution rights.

## Terms, retention and admission gate

| Evidence, reviewed 2026-11-15 | Relevant constraint |
|---|---|
| [Terms selector](https://www.kraken.com/legal) | Applicable terms depend on residence; Canada, EEA and Brazil have separate terms. Operator/entity, jurisdiction and any existing agreement remain unrecorded. |
| [Global Terms](https://www.kraken.com/legal/global-terms), displayed update 2026-11-06, §§8–9 | Limited revocable own-benefit permission; restrictions cover copying, extraction, automation, third-party/commercial availability and third-party applications without prior written consent. No specific raw spot-market-data retention duration or bounded capture/replay exception was identified. |
| [Official legacy API notice](https://docs-legacy.kraken.com/api/docs/guides/global-intro/#notices) | API use is subject to applicable terms; prior permission is required for certain uses, explicitly including non-personal commercial use of public endpoint data. It names `marketdata@kraken.com` for permission requests. This remains a published official notice; the current overview's public-access description does not establish its supersession. |

**Conclusion for this implementation:** a real bounded local capture is
technically supported, but **not established as permitted for this application
by the reviewed evidence**. The relationship between intended public API use and
the broad Global Terms restrictions needs applicable authorization, rather than
an inferred exception. No legal conclusion that all personal captures are
prohibited or allowed is made here. A time/byte bound reduces operational scope;
it does not resolve rights. No provider contact was made.

Before real-data admission, record the accountable source/rights owner, operator
and applicable terms/agreement; permitted automated capture and local replay;
raw/normalized and derived-output retention/deletion periods; allowed users,
internal display and exports; attribution and redistribution conditions; and
the actual permission evidence/date/scope. If prior permission applies, obtain
it through an authorized owner. Do not invent a legal approval from a CLI flag,
test run or this register. Until resolved, keep real capture disabled and use
clearly identified SIM protocol fixtures. No raw real ticks should enter Git,
logs, exports, a shared site or a warehouse under this review.

### Runtime permission record

The capture command must require an explicit current record **before opening a
socket**. The status vocabulary is `BLOCKED` or `REVIEWED_AUTHORIZATION`.
The latter records an operator declaration supported by scoped evidence; it is
not legal proof, provider consent generated by software, or a replacement for
the applicable terms/agreement. A statement that use is personal does not by
itself resolve the automation/third-party-application restrictions.

Required record fields and validation:

| Field / scope | Required evidence or check |
|---|---|
| `schema_version`, `status` | Recognized contract version; only `REVIEWED_AUTHORIZATION` may pass the real-source gate. Missing, malformed or `BLOCKED` records fail closed. |
| `provider`, `venue`, `endpoint`, `channel`, `symbols` | Explicit `kraken`, `spot`, reviewed production public v2 URL, `trade`, and exact allowed pairs. Requested scope must be a subset; no wildcard or unrelated-feed authorization. |
| `purpose` | Local research capture/replay only for these slices; no trading, production service or external distribution admission. |
| `owner`, `operator`, `evidence_ref` | Accountable reviewer/owner and acting operator; a nonempty inspectable reference recording actual authorization and applicable operator/entity/jurisdiction. An arbitrary reference string is not evidence that permission exists. |
| `terms_ref`, `reviewed_at`, `expires_at` | Applicable current terms/agreement and review instant; timezone-aware validity with review no later than now and expiry strictly after now. Re-review if terms or scope changes. |
| `capture`, `retain_raw`, `retain_normalized`, `local_replay` | Separate affirmative scopes supported by the evidence. Capturing without retention permission cannot enable a retained-capture/replay command. |
| `retention_until`, `storage_scope` | Explicit permitted deletion deadline and local storage/access boundary, covering both raw and normalized artifacts. Do not confuse permission expiry with indefinite data retention. |
| `display`, `export`, `redistribute` | Separate scopes; absent or false means disabled. Local capture approval does not imply these rights. |

A blocked record can document progress without enabling provider access. For
example (deliberately unusable for a real capture):

```json
{
  "schema_version": "kraken-source-permission-v1",
  "status": "BLOCKED",
  "provider": "kraken",
  "venue": "spot",
  "endpoint": "wss://ws.kraken.com/v2",
  "channel": "trade",
  "symbols": ["BTC/USD"],
  "purpose": "local-research-capture-replay",
  "owner": null,
  "operator": null,
  "evidence_ref": null,
  "terms_ref": null,
  "reviewed_at": null,
  "expires_at": null,
  "capture": false,
  "retain_raw": false,
  "retain_normalized": false,
  "local_replay": false,
  "retention_until": null,
  "storage_scope": null,
  "display": false,
  "export": false,
  "redistribute": false
}
```

SIM fixtures can exercise gate success/failure with fictional authorization
records; they do not establish real-source rights. The current source admission
remains `BLOCKED` until the above evidence is actually supplied and reviewed.

## EcoMedallion capability and ownership evidence

Read-only inspection of the local `fred-bronze-to-gold-pipeline` companion on
2026-11-15: HEAD `2412e6ad671e1b81121e854dd869b879687feef9`, initially clean
working tree. No companion files were changed by this review. Paths below are
relative to that repository; no database was opened.

| Evidence path | Observed capability / limit |
|---|---|
| `README.md`; `src/fred_pipeline/pipeline.py` (`SOURCE_FACTORIES`) | Sixteen registered providers: FRED, BLS, EIA, ECB, OECD, IMF, Treasury, World Bank, BIS, BEA, Census, SEC, Stooq, iShares, Tiingo and French. No Kraken source factory. |
| `src/fred_pipeline/sources/base.py` | `get_observations`/`normalize` contract and retrying/rate-limited HTTP transport; not a market-tick streaming contract. |
| `sql/30_bronze.sql`; `sql/40_silver.sql` | Raw HTTP payload retention, date-grained normalized observations and revision history. Observation identity is `(source, series_id, observation_date, realtime_start)`; no exchange trade ID, taker side or trade quantity/price envelope. An ingestion timestamp does not convert a daily observation into a tick. |
| `manifests/rates.yml` (`SOFR`) | Daily percent overnight-rate observations, not SOFR contract executions or quotes. |
| `src/fred_pipeline/sources/tiingo.py`; `manifests/equity_tiingo.yml` | Daily close/dividend/split/adjusted-close extraction and daily manifests; does not establish a Tiingo intraday entitlement or implemented tick path. |
| `config/data_licensing.yml`; `src/fred_pipeline/governance/licensing.py` | Source-specific licensing/review machinery exists; no Kraken entry or transferable tick permission found. Existing provider permissions do not extend to Kraken. |
| `manifests/rates.yml`; `AGENTS.md` | Existing rate metadata includes role labels `quant-macro` and `data-eng`; these do not appoint an accountable owner for new tick ingestion, capture storage or licensing. |

Searches of `src`, `manifests`, `sql`, `README.md` and `docs` found no implemented
Kraken/WebSocket/aggressor/trade-ID market-tick ingestion path. Scheduler
references to missed ticks describe job scheduling, not exchange events.
This is a source-code capability finding, not proof about all deployed systems
or actual warehouse contents. New tick ingestion/retention ownership remains
**unassigned**. QuantMeridian remains the consuming application under the
existing spec; this review authorizes no companion schema or warehouse writes.
