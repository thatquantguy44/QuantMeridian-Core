# Trade-flow local research

Independent Python 3.12+ package for spec034. The core uses only the standard
library. The optional capture transport pins `websockets==16.1.1` (BSD-3-Clause).
It is an isolated research CLI, with no terminal route, API or warehouse writes.

From the repository root:

```sh
npm run test:trade-flow
npm run trade-flow -- curve contracts/trade_flow/sofr-curve-flow.sim.json
npm run trade-flow -- demo --output .data/trade-flow/fictional.tfi.json
npm run trade-flow -- replay .data/trade-flow/fictional.tfi.json --speed 4
npm run trade-flow -- prune .data/trade-flow
```

The demonstration contains fictional SIM buy 5, sell 2 and unknown 3 BTC. Its
final diagnostic is +3 BTC, with 7 classified and 3 unknown BTC. Replay stays
`REPLAY` with source mode `SIM`; it never represents these fixtures as market data.
Output paths are created exclusively, so choose a new filename for each capture.
Replay prints the comparison ledger and last snapshot, not the retained raw data.
Empty captures have no numerical/parity claim. Source failures return a nonzero
exit status with a reason code and no synthetic fallback.

For an extracted installation:

```sh
python3 -m venv .venv
.venv/bin/python -m pip install .
.venv/bin/trade-flow --help
```

To install the optional transport, use `pip install '.[capture]'`. The pure tests
work without it; the loopback transport test skips if it is absent. Socket tests
need permission to bind a temporary loopback port. They use fictional data and
do not contact Kraken. No dependency install or module import opens a socket.

## Observed-source gate

Real capture is currently **blocked** by
[the source register](../../docs/specs/spec034/SOURCE_REGISTER.md). The checked-in
permission record cannot enable it. Do not change its status merely to make a
command run. After actual scope and evidence are reviewed, an explicit private
permission record can be supplied to:

```sh
trade-flow capture --permission /private/path/reviewed-permission.json \
  --seconds 10 --max-events 1000 --output .data/trade-flow/private-capture.tfi.json
```

This record is an operator declaration, not software-generated provider consent.
It identifies accountable owner/operator, applicable terms and inspectable
authorization, exact source/pair, separate capture/raw/normalized/replay scopes,
validity and a retention deadline within 24 hours. Display, export and
redistribution remain disabled. Real captures and permission evidence must stay
out of Git. The command creates private mode-0600 files; expired captures cannot
replay. Invoke `prune` to physically remove expired recognized capture files;
there is no background cleanup service. Inspect the returned removed filenames.

See [diagnostic policy](../../docs/specs/spec034/DIAGNOSTIC_POLICY.md) for exact
arithmetic, event-time boundaries, completeness, limits and correction exclusions.
A fixed source cut and original prefix hash accompany every snapshot. Per-row
processing/publication clocks are unknown (`null`), not invented from receipt
times. No five-minute warm-up, complete venue coverage or source authenticity is
claimed. The SIM curve research below and production streaming are separate capabilities.

## SOFR curve-flow research

`curve` evaluates an explicitly fictional SR3 strip using definition
`sofr-curve-flow/1`: multiply each expiry's signed contracts by 25 USD/bp;
`level_flow` is the mean across all configured expiries; `slope_flow` is the
FAR mean minus the NEAR mean. Positive signs denote futures buying. The checked-in
four-expiry fixture gives **37.5** and **-25** USD/bp respectively. It also
compares every batch/stream prefix and prints the final snapshot and ledger.

The input is `tfi-curve-input/1` JSON with `source_mode: SIM`, `mapping` and
`deliveries`. Mapping requires a version, effective interval and explicit leg
IDs, reference starts and NEAR/FAR groups; see the checked-in fixture. Deliveries
carry per-contract IDs, event/receipt clocks, integer `quantity` in contracts and
BUY/SELL/UNKNOWN SIM labels. Inputs cap at 8 MiB and 10,000 deliveries.
`CurveFlow.push` emits each streaming prefix; `curve_batch` evaluates the same
kernel for a supplied sequence. The core has no transport or optional dependency.

Missing classified legs produce null factors with unchanged denominators;
UNKNOWN labels remain visible and make otherwise available values PARTIAL.
Other available values stay PROVISIONAL, with unverified completeness/warm-up.
Exit status is nonzero for malformed inputs, empty input, unavailable final
factors or a parity failure. A successful exit establishes local evaluation,
not data quality or source admission. Observed modes reject; this command does
not ingest Kraken or a real SOFR feed. The BTC diagnostic retains its own units
and definition. Real SOFR provider mapping, rolls and production streaming remain
future work. See [formula policy and primary sources](../../docs/specs/spec034/FORMULA_POLICY.md).

Protocol and transport references:
[Kraken trades](https://docs.kraken.com/exchange/api-reference/spot-websocket-v2/trade),
[Kraken connection guide](https://docs.kraken.com/exchange/guides/websockets/introduction),
[websockets 16 client](https://websockets.readthedocs.io/en/16.0/reference/sync/client.html),
[Python Decimal](https://docs.python.org/3.12/library/decimal.html).
