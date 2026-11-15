# Capability specification: `pr-data`

**Status:** Proposed; depends on no PORA capability. Provider to portfolio,
regime, evaluation and assistance. Parent: [SPEC.md](SPEC.md).

## Objective and boundary

Produce a validated, immutable research snapshot with explicit economic meaning
and knowledge basis. The terminal owns admission and source assembly; the Python
model consumes supplied data only. This capability does not build a market-data
pipeline, infer source permissions or repair unrelated Gold datasets.

## Requirements

| ID | Proposed contract |
| --- | --- |
| DATA-01 | Separate `SYNTHETIC`, `USER_SUPPLIED` and future `GOVERNED_SNAPSHOT` source modes from `SYNTHETIC`, `CURRENT_VINTAGE` and `POINT_IN_TIME` knowledge bases. Uploaded data is not automatically verified history. |
| DATA-02 | Require versioned asset identities, one currency/calendar per experiment, source IDs, return/adjustment basis, observation times, snapshot receipt time and selection policy. Reject conflicting duplicate keys and nonfinite values. |
| DATA-03 | Validate positive price levels, consistent OHLC adjustment basis and ordering, nonnegative volume, simple-return/log-return identity and actual session adjacency. No row dropping, interpolation or forward-fill without an approved explicit policy and exclusion ledger. |
| DATA-04 | Membership, benchmark, market caps, views, risk-free returns and corporate actions carry effective/available times and revisions. Backtest eligibility is evaluated at each decision, not at final snapshot creation. |
| DATA-05 | Unknown historical availability may be admitted as current-vintage exploratory research only. It cannot pass a point-in-time validation gate. Present-day adjusted prices/caps and present-day constituent lists do not establish historical availability. |
| DATA-06 | Default proposal is reject an incomplete aligned window; report missing asset/session and unavailable model paths. Do not silently use only surviving assets or shorten a holding interval across a missing session. |
| DATA-07 | Risk-free cash returns and costs must be supplied on the experiment calendar. An explicit fictional zero-cash-return assumption is allowed only in synthetic experiments, never as an unknown-to-zero conversion. |
| DATA-08 | Snapshot hashes bind normalized observations, source metadata, exclusion ledger and membership. Source revisions create new snapshots; provider-retrieval time is not publication time. |

## Acceptance

- **DATA-AC01:** conflicting duplicate, NaN/Infinity, price/total-return mismatch,
  mixed USD/INR, missing calendar session and future required availability fail
  with a row/field reason; null optional metadata remains explicitly unknown.
- **DATA-AC02:** a split/dividend fixture shows consistent return/OHLC treatment;
  changing source revision or membership changes snapshot identity.
- **DATA-AC03:** a delisting or ticker change never silently disappears from
  holdings or history. Missing proceeds/timing makes the affected simulation
  unavailable. An explicit fixed-universe study retains a survivorship limitation.
- **DATA-AC04:** future macro revisions, undated BL views and current caps cannot
  enter point-in-time folds; current-vintage research remains visibly qualified.

## Structure, verification and policy gates

Proposed contracts: `contracts/portfolio_regime/v1/`; Node normalization/admission:
`src/lib/server/portfolioRegime/`; typed UI DTOs: `src/lib/portfolioRegime/`.
Use existing TypeScript naming/test placement and generated TS/Pydantic contract
patterns from `contracts/agent/README.md`; validate at transport boundaries.
Use invented fixtures in Vitest and Python conformance tests, including rejection
parity. Commands and full source tree: [PLAN.md](PLAN.md).

Always expose coverage and knowledge limitations. Resolve [D01–D03 and D08](DECISIONS.md)
before admitting the corresponding real/private input. Never fetch Yahoo inside
the model, query Gold from Python service code or copy raw research data into logs.
