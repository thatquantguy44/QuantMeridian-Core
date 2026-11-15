# Spec027 — NAAIM delayed research artifact in SENT

- **ID:** `spec027-naaim-research-artifact`
- **Status:** Local source-artifact reader/API/SENT display implemented; not a
  production or public integration.
- **Updated:** 2026-11-02.
- **Module:** `SENT`, NAAIM Exposure tab.
- **Source owner:** MarketMedallion. QuantMeridian is a read-only local consumer.

## Approved scope

The owner confirmed NAAIM permission for daily delayed pulls, 365-day source
retention, research-report display and the required attribution. QuantMeridian
must show the data as three-month delayed and preserve this exact attribution:

> Source: NAAIM Exposure Index® (National Association of Active Investment Managers).

This is not current-week positioning, a NAAIM API integration, a data warehouse,
a public endpoint or an investment recommendation. The artifact is
current-vintage: it does not claim historical point-in-time knowledge.

## Exchange boundary

MarketMedallion writes `naaim-exposure-research/1` after a permitted capture.
The file contains validated current versions by `as_of_date`, decimal `value`,
the current version's `first_seen_at`, an opaque capture token, exact
attribution, delay metadata, `CURRENT_VINTAGE` basis and a nonsecret
authorization reference. It contains no raw provider payload or credential.

QuantMeridian only reads the configured local file. It never fetches NAAIM,
shares a database/schema/runtime configuration with MarketMedallion, or accepts
browser source/date overrides. An absent, malformed, oversized, symlinked or
unadmitted artifact produces **No data**; no cached, generated or SIM substitute
is permitted.

## Local runtime

In MarketMedallion, write the artifact after a successful capture:

```bash
.venv/bin/python -m market_data_pipeline.pipelines.naaim_exposure_public_delayed \
  --root data/naaim-exposure-public-delayed \
  --export-research data/naaim-exposure-public-delayed/research/naaim_exposure_research_v1.json \
  --research-use-reference 'user-confirmed-naaim-report-display-2026-11-02'
```

In QuantMeridian's ignored `.env.local`, set only:

```bash
NAAIM_RESEARCH_LOCAL_ENABLED=1
NAAIM_RESEARCH_ARTIFACT_PATH=/absolute/path/to/naaim_exposure_research_v1.json
```

Restart the local dev server, then open `/sentiment` and select **NAAIM
Exposure**. The server-only route is `GET /api/sentiment/naaim`; it requires a
verified loopback peer, local host, same-origin request, no query parameters and
never caches a previous result. Production/serverless execution is always off.

## Presentation requirements

- Show the NAAIM Number, observation `as_of_date`, current version's first-seen
  clock and terminal artifact-read clock separately.
- Show **3-MONTH DELAYED**, source attribution and the source delay notice on
  the NAAIM panel and history.
- Do not call the result current, apply a freshness label, fill gaps, compute a
  composite, percentile, contrarian signal or forward-return study.
- AAII, macro and social paths remain independent. Missing put/call, breadth and
  flow inputs remain No data.

## Verification

Offline tests use invented artifact values/lineage only. They cover schema,
attribution/delay identity, explicit authorization reference, malformed values,
duplicate dates, size/missing-file/symlink rejection, local-only configuration,
route boundary and sanitized failures. Run:

```bash
npm test -- --run src/lib/naaim src/lib/server/naaim src/app/api/sentiment/naaim
npm run typecheck
```

## Deferred work

Automating the export immediately after a daily capture, durable service
operation, external alerting, any broader NAAIM terms/API, public reporting,
historical point-in-time snapshots, composite methodology and deployment remain
separate decisions.
