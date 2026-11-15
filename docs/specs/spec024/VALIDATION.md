# Presidential Impact validation record

Date: October 31, 2026. Method: `presidential-impact/0.1.0`.

This records software verification and methodological boundaries. Software test
data are fictional; passing tests are not political or market research findings.

## Setup

- Built against QuantMeridian commit `3c9b14233ee965d2ea8dce8e9d05a40c016ac927`
  in an isolated worktree, using the existing installed dependencies.
- No packages, research data, credentials or provider connections were acquired.
- Browser verification used a separate local Vite port and cache. The module's
  test aborted external requests and asserted no external requests or page errors.
- The wider suite requires the repository's deterministic Squeeze Radar synthetic
  CSV generator. Those ignored fixtures were generated only in the test worktree;
  they are unrelated to Presidential Impact and are not copied to the target.
- Loopback server tests require sandbox escalation to bind a local port. The
  initial restricted run's `EPERM` failures do not diagnose application behavior.

## Checks

| Check | Final outcome |
| --- | --- |
| `npm test -- --maxWorkers=1 --minWorkers=1 --no-cache` | **PASS: 137 files, 1,509 tests**, with generated local fixtures and loopback-server permission |
| Numerical/contract regression tests | **PASS: 53 tests**, including endpoints, CAGR, unknown/gap diagnostics, sensitivities, vintage joins, extremes and a 10,000-window working set |
| Export regression tests | **PASS: 6 tests**, covering stable run identity, separate commentary identity, result reconciliation, precision and CSV formula handling |
| Chart render regression tests | **PASS: 6 tests**, including extreme finite inputs and explicit figure-size limits |
| Existing navigation, guide and badge integration tests | **PASS**, included in the full suite; no weakened assertions |
| `npm run typecheck` | **PASS** |
| `npm run build` | **PASS**, both client and server |
| Presidential Playwright suite | **PASS: 6 tests**, zero retries; desktop/mobile widths 320/768/1024/1440, imports, rejected-input preservation, controls, sensitivities, notes, pagination and downloads |
| Download inspection | **PASS**, CSV/manifest contents, SVG caption/identity/DEMO label and PNG signature checked; exported PNG visually inspected |
| `npm run check:agent-skills-pin` | **PASS**, immutable upstream snapshot unchanged: 188 paths, 24 skills |
| `npm run check:gold-policy` | **PASS** |

Browser tests used an isolated Vite server/cache at port 5187 with no API provider
middleware. The pre-existing terminal shell can therefore show unavailable Gold
services in screenshots; this is separate from the local research calculation.
Production builds retain warnings about the existing large application bundle
and `eval` in existing chart-template/market-manifest server files. Those files
were not changed.

The initial broad run found missing ignored Squeeze Radar fixtures, blocked local
test-server sockets, and three new integration failures (two guide headings and
badge coverage). The fixture generator, authorized loopback rerun, and actual
guide/badge corrections resolved these; the final full suite above passed.

## Target application

The application uses a guarded allowlist: four shared registration files plus new
presidential source, browser test, guides and `docs/specs/spec024` files. Shared
files must match their recorded baselines; existing different new-path contents
are never overwritten. No `.env`, `.data`, generated fixtures, build output or
dependency tree is copied.

**Applied to the actual `market_terminal` checkout:** 24 new files and four shared
registration/test files. All 28 contents matched the tested worktree by SHA-256;
all nine unrelated dirty files present at application were unchanged. Concurrent
FX development continues outside this module's write set.

Post-application verification in that checkout:

- **95 tests passed across six files:** presidential engine, exports, chart
  rendering, navigation, module guides and badge coverage.
- **Typecheck passed:** `npm run typecheck -- --incremental false`, avoiding an
  incidental write to the existing incremental cache. An earlier restricted
  invocation's cache-write `EPERM` was a filesystem-permission issue.
- Shared-file diff whitespace check passed. Pinned skills, provider code,
  credentials, local data and dependencies remain outside the write set.
- At initial application, the specification package in the research folder and
  QuantMeridian `docs/specs/spec024/` was identical and changes were uncommitted.
  The subsequent publication checkpoint below records the owner's later direction.

## Combined PR publication checkpoint — October 31, 2026

The owner explicitly requested committing and pushing all remaining changes into
[PR #200](https://github.com/thatquantguy44/QuantMeridian/pull/200). Presidential
Impact is included in that PR alongside the completed FXR snapshot/history slices,
with separate engine, export, UI/integration and documentation commits.

Reverification on the combined checkout passed **1,533 tests across 142 files**
serially and **27 browser flows** (21 FX and 6 Presidential Impact), with zero
browser retries. Typecheck, client/server builds, Gold policy and the immutable
skills pin also passed. Desktop/mobile screenshots and the exported PNG were
visually inspected. Existing build warnings remain. Generated browser output,
local configuration, credentials and data remain untracked.

## Review corrections

- Rejected JSON and oversized imports preserve the last valid dataset and notes.
- Numerical summaries stay finite at accepted extreme scales. Figure scaling
  and percentage labels must also remain finite for those inputs.
- Sensitivity removes the named annual return year or the whole overlapping
  presidential period; a starting baseline close alone is not an exposure year.
- Control-coverage gaps and unknown labels are distinguished from known changes.
  Indexed queries preserve those diagnostics, and fundamentals use an
  availability sweep with latest-observation/latest-eligible-vintage selection.
- Numerical receipt generation is separated from commentary hashing. A stale
  receipt cannot remain exportable after the dataset, config or notes change.
- CSV includes each row's actual kind separately from the selected sampling frame.
  Numeric signs/precision are retained; textual formula cells are protected.
- Figure captions include partial-window inclusion and previous-endpoint tolerance.
- The ledger is paginated; full calculations and downloads retain all windows.
- Scatters above 2,000 eligible points and timelines above 2,000 intervals show
  explicit unavailable figures; they never silently sample observations.
- Required guide sections and the application's provenance-badge convention are
  checked using the existing integration tests rather than bypassed.

These are assistant code-review and regression-test checks, not independent
historical source verification or human scientific peer review.

## Research boundaries

- The seed article's original exhibit, data, assignment and averaging rules remain
  unavailable. No historical replication has been completed.
- User-supplied input is unverified. The fictional template is explicitly labeled
  DEMO and uses invented executive names, observations and control intervals.
- Nominal total-return and price-return datasets are separate. Real returns,
  conditional models, causal identification and forecasts are not implemented.
  Version 0.2.0 adds a deterministic, 2,000-resample administration-cluster
  range for grouped arithmetic means. It is explicitly descriptive, not a
  causal confidence interval or hypothesis test.
- Availability uses supplied date-only metadata, not authenticated intraday
  publication times. Unknown availability is omitted from inherited joins.
- Run identity covers canonical normalized data/config/method, not original file
  bytes, a trusted timestamp or verified licensing. Embedded code revision and
  raw-upload hash remain explicitly null; preserve module source for replay.
- Browser state is temporary. Notes and inputs persist only through explicit
  export. Deployment remains outside this implementation; commits and pushes
  were subsequently authorized in the publication checkpoint above.

## Version 0.2.0 extension

Date: November 1, 2026. The module now offers five selectable descriptive
breakdowns: president × Congress, president party, House control, Senate control,
and unified/divided government. It retains non-D/R labels rather than coercing
them into a split-control category. The political-control chart and summary table
show the descriptive administration-cluster range only when two or more supplied
administrations support it; one-administration groups are explicitly unavailable.

Focused verification: TypeScript typecheck passed and 68 focused presidential
engine, export and chart tests passed. Those checks validate deterministic
arithmetic and rendering contracts, not the historical accuracy of a user-loaded
dataset or any causal claim.
