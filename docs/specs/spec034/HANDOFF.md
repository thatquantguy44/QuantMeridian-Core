# Trade-flow pickup

**Updated:** 2026-11-15. **Branch:** `feat/trade-flow-kraken-diagnostic`.
Local worktree: `/private/tmp/quantmeridian-trade-flow-spec`.

The first bounded experimental slice is implemented in `models/trade_flow`:
strict normalized trades, separately named signed-BTC-quantity diagnostic,
bounded source-gated capture, private hashed artifacts, exact replay/comparison,
SIM demo and explicit expiry cleanup. See [README](../../../models/trade_flow/README.md),
[policy](DIAGNOSTIC_POLICY.md) and [validation](VALIDATION.md).

The source-backed formula proposal is now integrated as **`sofr-curve-flow/1`**:
`level_flow` is mean signed SR3 BPV flow across explicit expiries; `slope_flow`
is FAR mean minus NEAR mean. User-directed integration resolves research D03.
The kernel and CLI accept explicitly fictional SIM inputs only, with fixed
denominators, null missing legs, visible UNKNOWN quantities and per-prefix
batch/stream comparison. See [formula policy](FORMULA_POLICY.md) for sources,
units, signs, exact boundary math and scope.

Start here:

```sh
npm run test:trade-flow
npm run trade-flow -- curve contracts/trade_flow/sofr-curve-flow.sim.json
npm run trade-flow -- demo --output .data/trade-flow/fictional.tfi.json
npm run trade-flow -- replay .data/trade-flow/fictional.tfi.json --speed 4
```

Source selection is Kraken public spot `BTC/USD`. **Real capture is blocked**:
the source register does not establish applicable automated capture, retention
and replay rights for this application. Resolve accountable owner/operator,
applicable agreement and exact permissions before supplying an actual reviewed
permission record. Do not flip the checked-in blocked example to bypass review.
The operator declaration is never independent legal/source authentication.

The user confirmed **personal, non-commercial research** on 2026-11-15 and
declined the optional second-model review. Preserve those answers. The original
chart's author/link and factor-defining code are still unidentified. Our formula
is a separately defined research adaptation, not recovered screenshot code.

Next: finish that source admission and ownership record (TFI-T01), execute a
bounded authorized real sample and independently reconcile expected facts
(TFI-T10/TFI-T07). Separately qualify a SOFR futures source, effective contract
mapping, provider side/condition semantics, sessions/rolls, corrections and
finality (TFI-T02/TFI-T05/TFI-T06) before an observed factor adapter. The Kraken
diagnostic stays separately named. Current windows always disclose unverified warm-up
and source completeness. Quotes, production recovery, UI/API and warehouse
integration remain unbuilt. No push, PR, source activation or deployment has been
performed in this implementation slice.

Implementation commits: `7cee1b78` (source evidence, trade contract and diagnostic)
and `8d10aa22` (bounded capture/replay, CLI and regression tests). The validation
records those earlier checks. The research definition gate was subsequently
resolved by user-directed formula integration; source admission remains open.

Formula integration commits: `b543aa2d` adds the shared kernel and mathematical
contract; the following CLI/documentation slice adds the runnable SIM fixture
and updates pickup. Current package verification: **48 tests pass**, installed
wheel curve command passes, skill pin passes. Real-source admission and
production source-specific policies remain open.
