# SOFR curve-flow research definition

**Version:** `sofr-curve-flow/1`. **Decision:** User requested integration on
2026-11-15 of the proposed mean-level and far-minus-near formulas. This approves
the local research definition below, not recovery of the screenshot's code or
admission of a real SOFR source. The first implementation accepts **SIM only**.

## Sources and adaptation

- Brandt and Kavajecz (2004), *Price Discovery in the U.S. Treasury Market:
  The Impact of Orderflow and Liquidity on the Yield Curve*, Journal of Finance
  59(6), 2623–2654, DOI `10.1111/j.1540-6261.2004.00711.x`.
  [Publication](https://scholars.duke.edu/publication/762010),
  [paper](https://static1.squarespace.com/static/5e6033a4ea02d801f37e15bb/t/5f615423242abe11d0f5fdef/1600214051476/brandt_et_al_price_discovery_jf.pdf).
  Printed pp. 2628 and 2631–2632 define signed volume by maturity and analyze
  factor structure; Table V examines yield factors against orderflow. This is
  Treasury-bond evidence, not validation of five-minute SOFR futures signals.
- [CME, A Practitioner's Guide to Three-Month SOFR Futures Contract Notional](https://www.cmegroup.com/articles/whitepapers/a-practitioners-guide-to-three-month-sofr-futures-contract-notional.html),
  price convention and Contract Risk sections: SR3 has a $25 per basis point
  contract value and price equals 100 minus its implied annual interest rate.

Sources checked 2026-11-15. The means, maturity grouping and five-minute rule
below are **our research adaptation**, not formulas published by these sources.
They are trade-flow measures, not PCA yield factors, investor positions, book
order-flow imbalance, or calibrated predictions of yield changes.

## Formula and signs

At common cut `t`, for each configured three-month SOFR expiry `j`:

```text
q_j(t) = sum(epsilon_i * contracts_i), t - 300 seconds < event_at_i <= t
epsilon = +1 for BUY, -1 for SELL; UNKNOWN excluded and reported
r_j(t) = 25 * q_j(t)
level_flow(t) = sum_j(r_j(t)) / number_of_configured_legs
slope_flow(t) = mean_far(r_j(t)) - mean_near(r_j(t))
```

Units are USD/bp of signed contract flow, averaged per configured expiry.
Positive level means net futures buying; positive slope means more buying per
far expiry than per near expiry. Since futures price is 100 minus rate, these
signs must not be relabeled rate increases or steepening. Contract BPV is fixed
at 25 for this SR3-only definition; $1 million notional and maturity length are
not additional weights.

## Bounded implementation conventions

- Mapping explicitly supplies a version, effective `[from, until)` interval,
  and 2–10 unique SIM leg identifiers with reference-period start clocks and
  `NEAR`/`FAR` groups. Both groups are nonempty and every NEAR reference start
  precedes every FAR reference start. No implicit `SFR1`–`SFR10`, calendar,
  continuous contract or rolling group membership is inferred.
- Only integer contract quantities from 1 through 1e12, explicit SIM aggressor labels, event IDs
  scoped by leg, and offset-aware event/receipt clocks are accepted. Receipt
  clocks cannot decrease or precede their event clocks. Corrections/cancels and
  observed-source modes are unsupported and reject.
- One shared kernel emits one snapshot per received delivery prefix. The cut
  is the greatest event clock in that prefix, endpoints are `(t-300s,t]`, and
  simultaneous trades stay distinct. Duplicates add no contracts; conflicting
  duplicate economics reject. Receipt time is delivery metadata and is excluded
  from duplicate economics, but repeated deliveries remain in cursor/hash lineage.
  At most 10,000 deliveries are admitted.
- Cuts never decrease. Late trades change future prefixes only, without
  rewriting earlier outputs. Prefix, mapping and definition hashes identify
  the comparison basis. Processing/publication clocks are null; source mode is
  always SIM, warm-up and completeness always UNVERIFIED, finality never asserted.
- Every configured leg needs at least one classified trade in the current
  window. Otherwise both factor values are null with missing-leg diagnostics;
  denominators never shrink. Classified balanced trades give a real numeric
  zero. UNKNOWN quantity/count is exposed per leg; when every leg is classified
  but UNKNOWN also occurs, factors are PARTIAL classified-subset values.
  Other available values are PROVISIONAL. An absence of trades cannot establish
  complete zero flow without qualified feed coverage.
- The full window must lie within one effective mapping interval:
  `cut - 300s >= effective_from` and `cut < effective_until`.
  Otherwise factors are UNAVAILABLE. No session reset,
  holiday, halt or roll behavior is guessed; a new mapping starts a new run.
- Integer sums are exact. Means and the far-minus-near difference are computed
  before rounding, in an isolated 80-digit decimal context. Each final factor
  rounds once to 12 decimal places, half-even; maximum absolute display error
  is 0.5e-12 USD/bp. Canonical decimal strings carry values, never binary floats.

## Hand oracle

Four fictional expiries have signed contracts `+3, +1` (NEAR) and `-2, +4`
(FAR). Their risk flows are `+75, +25, -50, +100` USD/bp.
`level_flow = 150/4 = 37.5`; `slope_flow = 25 - 50 = -25` USD/bp.
Adding UNKNOWN contracts preserves those classified-subset numbers and marks
PARTIAL. Removing any leg's classified trades makes both factors unavailable.

Real-source qualification, provider aggressor semantics, trade-condition filters,
corrections, production watermark/finality, effective SOFR contract mappings and
roll/session rules remain separate admission work in [DECISIONS.md](DECISIONS.md).
