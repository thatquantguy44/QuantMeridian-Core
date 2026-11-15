# FXR-S01: Gold reference snapshot and Research overview

**Scope approved:** 2026-10-30; [admission policy](ADMISSION_POLICY.md) and [shared contract](DATA_CONTRACT.md).
**Branch:** `feat/fx-gold-snapshot-adapter`, based on merged PR #199 (`342dcc4`).
**Review PR:** [#200](https://github.com/thatquantguy44/QuantMeridian/pull/200).

## Delivered path

Gold → one consistent bounded read of three ECB legs/catalog mappings → validation and four explicit pair outcomes → immutable local retention → Research overview and Evidence.

The four pairs are EUR/USD, USD/EUR, USD/JPY and GBP/USD. Levels are daily informational references for research only. Direct/inverse/cross direction and unrounded calculations are preserved; display rounding never feeds arithmetic. Unsupported/missing/invalid legs remain explicit outcomes. No source/date blending, synthetic fallback or external source fetch occurs.

Freshness uses the approved TARGET calendar and inclusive 17:00 Europe/Berlin deadline. Stale values are dated display-only evidence; they have no consumable referenceLevel. The browser rechecks at the deadline and on focus/visibility/manual refresh, and rejects an eligible response that expired in transit. A failed source/retention refresh cannot reuse an old eligible level as current. Retained evidence keeps its original cutoff.

Exact projected rows, value tags (including invalid/nonfinite values), read clocks, selected revisions, outcomes and approved policy/calendar contents are retained. Unknown original receipt/publication/first Gold availability remain null. Replay verifies the digest, dispatches the retained approved version and recomputes the original result; it is explicitly historical evidence and grants no current consumption permission. The current exposure workspace remains a shell; reporting conversion, hedge calculations, private input and exports are disabled.

## Local operation

The existing ignored `.env` on the owner's workstation has these two non-secret FX settings enabled. New checkouts can copy them from `.env.example`:

```dotenv
FX_RESEARCH_LOCAL_ENABLED=1
FX_RESEARCH_SNAPSHOT_DIR=.data/fx-reference-snapshots
```

Keep the existing MACRO_DB_URL configuration for the local macro_medallion PostgreSQL database. PostgreSQL and SQLite single-statement reads are supported; Databricks admission is not qualified by this slice. Start from the repository root:

```bash
npm run dev -- --host 127.0.0.1
```

Open `/fx/research`. Both HTTP endpoints require a loopback socket peer recorded by the Node adapter, a loopback hostname and a same-origin request when Origin is present. Host/forwarding headers do not establish the peer. Production/serverless runtimes remain gated off; this local gate does not introduce user authentication or approve deployment.

- GET `/api/fx/research/snapshot`: captures the fixed universe, no caller query parameters. Returns the frozen snapshot plus a separate current assessment; 503 has explicit four-pair unavailable outcomes.
- GET `/api/fx/research/snapshots/{encoded snapshotId}`: verified retained replay, no query parameters. IDs contain slashes and must be URL-encoded as a single path segment. Absent/expired replay is 404; corruption or unsupported retained version is 409. All responses are no-store.

Retention is capped at 500 manifests or 30 days. Files live outside Git in the configured immediate child of `.data/`; no raw HTTP payloads, credentials or private inputs are retained. Durable file/directory sync and atomic publication precede successful admission. Unique process-owned writer claims fail busy while a live writer is choosing/publishing; dead-process claims can be removed without reusing a new owner's path. A failed write blocks publication. Expired replay is denied immediately; physical cleanup runs on access/startup and minutely while the local app runs, and resumes when a stopped app restarts. Lost disk/eviction cannot be repaired by pretending today's Gold rows are the old snapshot.

Changing approved v1 semantics requires a new policy/contract version. Preserve the immutable v1 registry entry and its method/calendar dispatch for supported retained replay. Disabling local FX access also disables replay. Retention/replay success does not certify original source truth or historical point-in-time availability.

## Implementation and verification

- Shared types/calendar: `src/lib/fx/`; server admission, identity, retention and service: `src/lib/server/fx/`.
- API: `src/app/api/fx/research/`; page and view: `src/app/fx/research/page.tsx`, `src/components/fx/ResearchSnapshot.tsx`.
- Pure/service/storage/API tests exercise hand oracles, latest invalid rows, missing legs, conflicts, future dates/clocks, DST/holidays, nonfinite/malformed persistence, exact replay/corruption/expiry, the 500 cap, busy/dead writers and source/retention/configuration failure. The real SQLite reader is exercised with fictional data.
- `test/fx-research.spec.ts` and `test/fx-scaffold.spec.ts` verify real Chromium at 320/768/1024/1440 pixels, units, coverage, evidence, explicit derivations, stale/failed states, deadline/late-delivery behavior, keyboard navigation and the exposure shell.

```bash
npm test -- --reporter=dot --no-file-parallelism
npm run typecheck
npm run build
npm run check:gold-policy
npm run check:agent-skills-pin
npx playwright test test/fx-research.spec.ts test/fx-scaffold.spec.ts --retries=0 --workers=1
```

The live local smoke check read three current ECB Gold rows, returned four research-eligible results dated 2026-10-30, and preserved unknown original clocks as null. Retained replay matched exactly after a process restart; isolated Chromium displayed the actual Gold level and evidence without page errors. No warehouse rows were modified. Temporary live responses/screenshots and `.data/` manifests are not tracked fixtures. Test totals and final review are recorded in the master handoff.

Independent review corrections covered malformed value/coercion handling, replay version dispatch, orphan recovery, expiry housekeeping, Host spoofing, delayed/near-deadline responses and explicit derivation labels. No additional cross-model review was requested, per the owner's earlier preference. The existing large-bundle/eval build warnings and parallel SQZ fixture contention remain separate concerns; the full suite is run serially.

## Follow-on checkpoint: FXR-S02 pair history completed

The owner subsequently approved [HISTORY_POLICY.md](HISTORY_POLICY.md) and completed the reader, retained history, chart/table and 1/5/21 observed-interval changes in this same PR. See [HISTORY_IMPLEMENTATION.md](HISTORY_IMPLEMENTATION.md) for the current checkpoint and next scope. Volatility, five-year windows, briefs and broader currencies remain separate decisions.

For exposure/hedging, separately review reporting-conversion use and the spec023 valuation/attribution/counting/hedge allocation rules before private inputs or financial behavior. The confirmed cashflow/portfolio/category choices should not be asked again. The warehouse's invalid context rate keys, catalog omissions and historical interval-update limitation remain separate upstream work; SQZ-T11b remains an independent workstream.
