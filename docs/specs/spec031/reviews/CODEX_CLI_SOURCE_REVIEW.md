# Codex CLI source-research review

Date: 2026-11-05. Status: CLI review completed; three findings reconciled and
corrected afterward, with offline regression and regeneration checks. No second
CLI review of the corrections is claimed.

## Invocation and scope

- Codex CLI 0.160.0; model `gpt-6.1-sol`; existing ChatGPT sign-in.
- Read-only, ephemeral independent review of the proposal, research catalog,
  normalized examples and local public evidence. No source refresh or activation.
- Reviewed archive SHA-256: `f7bbae5ecf5a12d23e8c88ac3d08d858cc496f6f19954ae9496985c133b891fb`.
- Prompt SHA-256: `ee32ee21acaa9d742889137d5baf203e95d18d3486de07fd116ad9551f82bab5`.
- The initial host-sandbox launch failed to initialize. The same confirmed
  command completed with host startup permission; the reviewer retained its
  read-only sandbox.

```sh
codex exec --sandbox read-only --ephemeral -C . \
  -o /private/tmp/spec031-codex-review-result.md \
  - < /private/tmp/spec031-codex-review.md
```

## Reconciliation

| Finding | Classification | Correction and evidence |
|---|---|---|
| LCH Australia inflation-linked maximum term omitted | Valid and actionable | All twelve Australia examples now retain the page-4 maximum-term condition: 25 years for inflation-linked, 30 years for conventional. Printed buckets and base values remain intact. Offline checks cover every row and its source-context locator. |
| ICE FX initial-margin scope omitted | Valid and actionable | All 342 rows now retain the initial-margin/currency-mismatch condition and document lineage to the captured landing-page paragraph. |
| Archived preparation tool depends on missing input and repository layout | Valid and actionable | Preparation now consumes the archived capture manifest, defaults to the archive's review/ directory, and supports an explicit --review-dir. A clean extraction is regenerated from an unrelated working directory and compared byte-for-byte with the archive. |

CME web-only references and uncaptured provider-terms pages remain material
offline-validation limits. No rights approval or live ingestion is inferred.
The report's final cross-model-skip sentence refers to a further nested review
inside the non-interactive CLI session; the requested Codex CLI review did run.

## Original CLI findings

1. **P2 — LCH’s explicit 25-year limit is lost.** The [normalized record](</Users/<you>/Documents/Quant Sandbox/platforms/market_terminal/.data/spec031/collateral-sources/2026-11-05/normalized/pdf-rule-examples.jsonl:18>) gives 8.75% for Australian inflation-linked bonds in the `>11yrs <=30yrs` bucket. The captured PDF’s page-4 qualification caps Australian ILBs at **25 years** ([source text](</Users/<you>/Documents/Quant Sandbox/platforms/market_terminal/.data/spec031/collateral-sources/2026-11-05/extracted/lch-haircuts.txt:339>)). Generic wording that “limits” apply does not retain that boundary. **Repair:** preserve the published bucket and attach the explicit 25-year restriction and page-4 locator.

2. **P2 — ICE FX records omit their initial-margin scope.** The [captured landing page](</Users/<you>/Documents/Quant Sandbox/platforms/market_terminal/.data/spec031/collateral-sources/2026-11-05/raw/ice-page.html:18>) describes these haircuts as applying when collateral currency differs from the **initial margin liability** currency. The [normalized records](</Users/<you>/Documents/Quant Sandbox/platforms/market_terminal/.data/spec031/collateral-sources/2026-11-05/normalized/ice-fx.jsonl:1>) retain only generic asset/liability currencies, without this qualification. **Repair:** retain the initial-margin condition across all 342 records, with lineage to the landing-page statement.

3. **P2 — The handoff archive cannot reproduce normalization using its included tool.** [prepare.py](</Users/<you>/Documents/Quant Sandbox/platforms/market_terminal/.data/spec031/collateral-sources/2026-11-05/prepare.py:17>) requires `downloads.json`, which is absent from the ZIP. It also assumes repository-relative output directories rather than the archive’s `review/` layout. **Repair:** include the required input and explicit path configuration, or make preparation consume the archived manifest and directory structure.

Material limits: CME’s web-only evidence and the uncaptured provider terms could not be independently checked offline. Cross-model review was skipped under the non-interactive scope.
