# Spec026 proposed data, run and service contract

**Status:** Numerical/transport design draft. No run schemas or generated types
exist yet; the separate API scaffold exposes only unconfigured health (HTTP 503).
Provider semantics are defined in the [capability specs](CAPABILITY_MAP.md).
Review D02–D08 before implementation. Contract namespace proposed:
`contracts/portfolio_regime/v1/`, major version `portfolio-regime/1`.

## Source of truth and transport

Versioned JSON Schemas would own the browser/Node/Python transport; generate
TypeScript and Pydantic definitions and run shared acceptance/rejection fixtures.
Use explicit named units, finite JSON numbers and camelCase DTO fields; any native
snake_case model mapping belongs solely in the adapter. Reject unknown semantic
configuration fields rather than ignoring them. Breaking semantics require a new
major; additive optional descriptive fields require conformance tests.

| Object | Required meanings |
| --- | --- |
| `Snapshot` | Schema version; immutable snapshot ID/content hash; source mode/knowledge basis; sources/permissions/owner; one currency/calendar; membership; observations; caps/views/benchmark/cash series when required; coverage/exclusion ledger. |
| `Asset` | Stable `assetId`, display ticker, venue, instrument type, currency, effective symbol/membership intervals, optional sector/group with classification as-of. A ticker alone is not a stable identity. |
| `Observation` | Unique `(assetId, sessionDate, field, revisionId)`; finite value/unit; observation/session close time; publication/availability time when known; source retrieval/first-seen and snapshot receipt separately. |
| `PriceSeries` | Explicit price/total-return basis, adjustment convention/revision, corporate-action treatment. Execution OHLC must be consistently adjusted and economically compatible with the return series; `low ≤ open,close ≤ high`. |
| `View` | Stable view ID, author/source, effective/available/expiry times, absolute/relative `P`, `Q`, annual horizon, total/excess convention, confidence/uncertainty. No timeless hard-coded forecast. |
| `Profile` | Method/version, objective/horizon, estimator/window, constraints/cash/costs, risk-free convention, seeds, numerical limits, HMM/refit/filter policy, execution timing and research protocol. Includes policy identities, never hidden defaults. |
| `Fold` | Train/selection/test boundaries, availability cutoff, embargo/gap, estimator/scaler hashes, label/filter initialization, selected parameters, eligible universe, excluded inputs and attempted candidates. |

ISO session labels refer to the declared exchange calendar/time zone; instants
are UTC RFC3339. `availableAt = null` remains unknown. Calendar session equality
is not proof a publication preceded execution. Date-only availability cannot
support an intraday timing assertion. Point-in-time selection must satisfy both
effective and known-before constraints; vendor revisions cannot rewrite old runs.

Simple asset return is `P_t/P_(t−1) − 1`; log return is `log(P_t/P_(t−1))`.
Never compound log returns as simple returns. Prices must be positive; return
series must respect their basis. A data gap cannot become a multi-session return
labeled daily. Missing required cash or execution observations makes that path
unavailable. Fully fictional templates may explicitly supply cash assumptions.

## Request and result envelopes

`RunRequest` includes schema/operation, submitted snapshot or bounded artifact,
effective profile, expected binding ID, request/correlation ID and optional parent
experiment ID. The server creates a unique attempt ID. An identical computation
may have many attempts; content identity does not claim exactly-once processing.

`RunResult` includes:

- Immutable computation/experiment identity; unique attempt ID; request and
  correlation IDs; wall-clock start/end; snapshot/config/method hashes.
- Binding manifest identity: source repository/full reviewed revision/package
  subdirectory (initially QuantMeridian `models/portfolio_regime`), package
  version, reviewed source digest, wheel/dependency-lock/installed-file digests,
  adapter version and native/transport contract versions. Unknown pin is
  `UNCONFIGURED`; do not fill with a candidate hash or moving branch name.
- Operation-specific candidate/metrics/probabilities/ledger references and units,
  exclusion/failure counts and coverage. Large bounded tables have row counts and
  page/display policy; export retains every eligible row within admitted limits.
- Independent verification report: check IDs, recomputed/residual values,
  tolerances, failed rows and verifier identity. No candidate on infeasible,
  nonfinite or failed-verification states. Exploratory partial diagnostics are
  separated from consumable candidate fields.
- Runtime evidence: Python/platform/BLAS/numerical-library/solver versions,
  thread limits, seeds, estimator settings, actual timings/iterations and warnings.
- Knowledge/source mode and research limitations, plus distinct research and
  deployment gates. Assistance output is a separate evidence-linked artifact.

Never collapse these axes into one success flag:

| Axis | Proposed examples |
| --- | --- |
| Attempt lifecycle | `RUNNING`, `COMPLETED`, `FAILED`, `TIMED_OUT`, `ABORTED` (local transient states). |
| Solver / fit termination | `OPTIMAL`, `LOCAL_CANDIDATE`, `INFEASIBLE`, `INACCURATE`, `NONCONVERGED`, `ERROR`, `NOT_APPLICABLE`. |
| Numerical verification | `PASSED`, `FAILED`, `NOT_RUN`; scoped checks, not validation of alpha or global optimality. |
| Research validity | `SYNTHETIC_TEST`, `EXPLORATORY_CURRENT_VINTAGE`, `PIT_EVALUATED`, `INVALID`, `NOT_EVALUATED`. |
| Deployment authority | `NOT_APPROVED`, future owner-recorded approval reference; never set by an LLM or solver. |

`PIT_EVALUATED` means the prescribed point-in-time tests were performed, not that
a model outperformed. Local numerical candidates are research previews only.

## API proposal and execution lifecycle

Browser prefix `/api/portfolio-regime`; service binds loopback on proposed port
**8019**, subject to operator conflict check. Proposed service URL/token variables:
`PORTFOLIO_REGIME_API_URL`, `PORTFOLIO_REGIME_API_TOKEN`; server-only. No tokens,
provider URLs, local filesystem paths or SQL appear in browser DTOs.

| Service route | Same-origin proxy | Meaning |
| --- | --- | --- |
| `GET /health` | `GET /api/portfolio-regime/health` | Binding readiness, safe capability/version state; no market/source access. |
| `GET /v1/capabilities` | `GET /api/portfolio-regime/capabilities` | Supported operations, methods, constraints, limits and statuses. |
| `POST /v1/validate` | `POST /api/portfolio-regime/validate` | Validate input/profile, report coverage and effective configuration; no solve. |
| `POST /v1/runs` | `POST /api/portfolio-regime/runs` | Synchronous bounded snapshot/regime/evaluation attempt; HTTP 200 only for a completed envelope, not a stored resource. |
| `POST /v1/artifacts/verify` | `POST /api/portfolio-regime/artifacts/verify` | Bounded batch artifact parsing, lineage and independent numerical checks; imported claims never inherit trust. |

First local runtime has no background queue, durable run list, polling URL,
schedule or advertised cancellation endpoint. The UI can abort its active request.
A service-owned transient map ties attempt ID to request, deadline and child
process group; one active child/service and no waiting queue. Browser abort →
Node upstream abort → service disconnect cancellation → terminate/reap child group.
The earliest deadline/disconnect wins. After abort/timeout, discard late results;
the parent alone arbitrates the terminal state. Bound supervision and cleanup to
two seconds and test actual PID exit. No disconnect may orphan work.

Proposed limits: 10 MiB request **and** 50 assets/5,000 sessions/20 frontier points/
3 states/100 fits maximum, whichever fails first; 20-second total service deadline
including validation; terminal proxy deadline 25 seconds. Reject before work when
the declared operation cannot fit; timeout does not silently switch execution
mode. One BLAS thread; child RSS budget proposed 1 GiB with tested OS-specific
enforcement and parent watchdog. Return `429 BUSY` when occupied. Exact limits
remain D06 proposals, not current guarantees.

A restart ends transient attempts; a client that loses its connection must treat
the outcome as unknown unless it received a verified envelope. Manual retry
creates a new attempt ID. No automatic retry or idempotency promise in this local
profile. No numerical job has a trading or publication side effect.

Common sanitized error envelope: `{ error: { code, message, issues }, correlationId }`.
Located issues use safe field/row IDs. Proposed HTTP mapping: 400 malformed JSON,
413 size/work cap, 422 semantic input, 409 incompatible expected binding,
429 busy, 503 unconfigured/down, 504 deadline. Solver infeasibility is a completed
domain result with null candidate, not an internal server error. Abort can leave
no response; metadata-only diagnostics record it. Production/private requests
are denied before work until the separate identity/data policy exists.

## Replay and persistence boundary

Computation hash binds canonical normalized snapshot, effective profile, fold
protocol, method/binding/verifier identity and numerical settings/seeds. Define
canonical ordering/numeric serialization in the shared conformance fixtures;
exclude attempt IDs, export timestamps and narration. Raw upload-byte hash and
normalized snapshot hash are separate. Source metadata affects provenance identity.

Export self-contained versioned JSON with normalized observations, membership,
profiles, complete fold/attempt/failure ledger, binding/runtime evidence, metrics,
verification and optional commentary reference. CSV exports retain precision,
units, identifiers and formula-safe text; charts retain source mode and limitations.
Untrusted JSON imports cannot refer to arbitrary local paths or deserialize pickle.
Independent re-verification/replay is required for uploaded batch output, bounded
by service limits; larger jobs are verified offline before any separate admission.

This proposes a **local research profile exception** to spec015 OC-006's durable
operational run record: session results plus explicit exports only, no recovery,
audit/history guarantee or OPT registration. It requires D07 approval. Operational
integration must later satisfy OC-006 and the spec015 identity/storage/retention
decisions; an exported file is not an immutable centrally governed run registry.
