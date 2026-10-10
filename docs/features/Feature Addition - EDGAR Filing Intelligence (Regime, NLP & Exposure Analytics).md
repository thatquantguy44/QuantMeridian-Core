# Feature Addition — EDGAR Filing Intelligence (Regime, NLP & Exposure Analytics)

Date: 2026-06-20
Status: Plan / proposal
Owner module code: **`EDGR`** (parent), with sub-views `RADAR`, `TONE`, `RISK`, `REGIME`, `EXPO`, `COHORT`, `CO`
Related docs: `docs/MARKET_TERMINAL_ROADMAP.md`, `docs/features/Feature Addition - Intelligence Layer (SEC Edgar, Stocktwits, X, and News).md`, `docs/features/completed/Feature Addition - Market Lens Studio.md`

---

## 1. Executive Summary

This plan adds a **filing-intelligence layer** to the terminal that turns the raw stream of
SEC EDGAR filings (10-K, 10-Q, 8-K, and friends) into regime-aware, machine-readable signals:

- **Regime detection** over filing language and the structured financials inside filings
  (Gaussian HMM latent states → "calm / cautionary / stressed" disclosure regimes).
- **NLP on disclosures** — sentiment/tone, uncertainty and litigation intensity, readability,
  risk-factor diffing, embeddings, and topic-drift clustering of emerging themes.
- **Exposure analytics** — both *thematic* exposure mined from text (supply chain, FX, rates,
  cyber, AI, geopolitics, refinancing/covenant language) and *financial* exposure pulled from
  the XBRL financial facts already attached to each filing.
- **Filing alerts** — push notifications into the existing **`ALRT`** Alert Center the moment a
  watched company (or a watched index/sector/industry) drops a new filing, with an importance
  score (P0–P3) and a one-line "why this matters."
- **Tone trends & evolution** — per-company and per-cohort time series showing how tone, risk
  language, and themes have evolved filing-over-filing and year-over-year.
- **Cohort aggregation** — roll filings up by **index, sector, or industry** to see where tone is
  deteriorating, where risk language is spreading, and which names diverge from their peers.

**The single biggest accelerator:** a large share of the hard engineering already exists, working,
in the sibling repo **`unstructured_signal_fusion`** (a.k.a. *SignalFusion*). That repo already
ingests EDGAR, extracts sections, embeds text, runs an HMM regime model, scores importance, and
clusters topic drift. This plan **reuses those modules wholesale** and wraps them in a service +
API + terminal UI rather than rebuilding ML from scratch. Section 4 maps every reusable file.

This is consistent with the roadmap's stated direction: move from deterministic demo generators
toward a **local, adapter-driven data and analytics layer** with clear provenance badges
(`LIVE`, `ETL`, `SIM`) and clean upgrade paths to paid vendors.

---

## 2. Why this belongs in the terminal

The terminal already has a strong *macro* and *securities-finance* spine (FRED rates/credit/curve,
regime playbooks `REGIME`, ML applications `EML`, sec-finance economics `SFE`). What it lacks is a
**bottom-up, issuer-level fundamental-text signal** that complements the top-down macro view.

EDGAR filing intelligence plugs directly into existing desks:

| Desk / module | How filing intelligence helps |
|---|---|
| `CRDT` Credit Spreads | Covenant / refinancing / going-concern language is a leading indicator of credit stress and spread widening. |
| `SLAB` Securities Lending | Risk-factor escalations and 8-K events on hard-to-borrow names feed borrow-demand and recall risk. |
| `COLL` / `HCT` Collateral & Haircuts | Issuer-level disclosure regime can drive dynamic haircut overlays and eligibility re-review. |
| `PB` Prime Finance | Counterparty / large-holding disclosure tone informs concentration and wrong-way risk. |
| `REGIME` Macro Regime Playbook | Aggregated cohort filing tone becomes a bottom-up confirmation/divergence signal for the macro regime. |
| `EML` ML Applications | Adds a real, locally-trained HMM + NLP model family to the model registry. |
| `ALRT` Alert Center | New-filing radar and P0–P3 importance escalations stream straight into the existing alert rail. |

---

## 3. What we reuse from `unstructured_signal_fusion`

SignalFusion is a *"regime-aware decision intelligence framework that combines unstructured text
and structured quantitative signals to infer latent system states and prioritize events under
uncertainty."* Its EDGAR path is already built. The table below is the concrete reuse map — paths
are relative to `unstructured_signal_fusion/signalfusion/`.

### 3.1 Reuse map (lift-and-shift, light glue only)

| Capability | SignalFusion file(s) | Reuse verdict | Notes |
|---|---|---|---|
| SEC HTTP client (rate-limit, User-Agent, gzip) | `src/edgar_ingest/sec_client.py` | **Reuse as-is** | `data.sec.gov` + `/Archives`. Already honors SEC fair-access (`rate_limit_seconds=0.25`). |
| Ticker → CIK resolution | `src/edgar_ingest/cik_lookup.py` | **Reuse as-is** | Handles both Kaggle and SEC official mapping JSON shapes. |
| Recent-filings index from submissions JSON | `src/edgar_ingest/filings_index.py` | **Reuse as-is** | Filter by form set, sort newest-first — exactly what the Filing Radar needs. |
| Download primary documents | `src/edgar_ingest/download_docs.py` | **Reuse as-is** | Writes `raw/<cik>/<accession>/<doc>`; returns status frame. |
| HTML → clean text | `src/edgar_extract/parse_html.py` | **Reuse as-is** | BeautifulSoup strip + whitespace normalize. |
| Section detection rules | `src/edgar_extract/section_rules.py` | **Reuse + extend** | Has 10-K Item 1A/7/7A and 10-Q Item 2/1A/4. Extend with 8-K items + more 10-K items. |
| Section slicing engine | `src/edgar_extract/section_extract.py` | **Reuse as-is** | Heading-span detection and slicing. |
| Section embedding | `src/edgar_extract/embed_sections.py` + `src/nlp/embeddings.py` | **Reuse as-is** | `SentenceTransformer("all-MiniLM-L6-v2")`. |
| Period aggregation of embeddings | `src/nlp/text_aggregation.py` | **Reuse as-is** | Mean-pool embeddings per period (Q/A); core HMM feature builder. |
| **Regime model (HMM)** | `src/models/latent_state_model.py` | **Reuse as-is** | `GaussianHMM` with `fit / predict / predict_proba`. This is the regime engine. |
| Regime labeling by stress | `src/models/state_labeling.py` | **Reuse + reconfigure** | Swap the customer-ticket signal columns for filing signals (risk-term rate, uncertainty rate, etc.). |
| Importance scoring (P0–P3) | `src/decisioning/importance.py` + `config/edgar_importance.yaml` | **Reuse as-is** | Weighted recency / risk / uncertainty / litigation / novelty / length → 0–100 → P0–P3. Powers alerts. |
| Decision engine | `src/decisioning/decision_engine.py` | **Reuse as-is** | `ESCALATE / MONITOR / NORMAL / NO_ACTION` from state prob + confidence + thresholds. |
| Topic drift (KMeans + TF-IDF) | `src/nlp/topic_drift.py` | **Reuse as-is** | Emerging-theme clusters within each regime. |
| Explainability (top terms by state) | `src/nlp/explain_text.py` | **Reuse as-is** | TF-IDF top terms per regime — drives "what defines this regime" panels. |
| Entity / macro keyword flags | `src/features/entity_features.py` | **Reuse + extend** | Macro keyword hits per doc → thematic exposure tags. |
| Structured feature aggregation | `src/features/structured_features.py` | **Pattern reuse** | Adapt the period-aggregation pattern to XBRL financial facts. |
| Feature alignment | `src/features/align_features.py` | **Reuse as-is** | Concat text + structured features, dropna. |
| Confidence metrics | `src/monitoring/confidence_metrics.py` | **Reuse as-is** | Mean / low-confidence % gating for the decision engine. |
| End-to-end orchestration | `edgar_runner.py`, `updated_edgar_runner.py`, `edgar_ingest_runner.py`, `edgar_extract_runner.py` | **Reuse as templates** | These already wire ingest → extract → embed → PCA → HMM → importance → outputs (`features_matrix.csv`, `state_probabilities.csv`, `bi_table.csv`, `state_summary.csv`, `state_top_terms.csv`, `state_topic_clusters_summary.csv`, `top_important_*.csv`). |
| Config conventions | `config/edgar_ingest.yaml`, `config/run_edgar.yaml`, `config/edgar_importance.yaml` | **Reuse + extend** | Universe, forms, freq, model params, importance weights are all already parameterized. |

### 3.2 What we build new (thin layer)

1. **A packaged service** — promote the SignalFusion EDGAR scripts into an installable
   `edgar_intelligence` package (or a `market_data_pipeline` sub-module) with a stable function
   API and a FastAPI surface, instead of standalone runner scripts.
2. **XBRL financial-facts ingestion** — SignalFusion focuses on text; we add the
   `companyfacts`/`companyconcept` API (`data.sec.gov/api/xbrl/...`) for structured exposure
   analytics. Reuses `sec_client.py` for transport.
3. **Cohort/universe layer** — index/sector/industry membership and roll-up logic (new).
4. **Incremental "radar" loop** — poll the daily filings feed and diff against state to detect
   *new* filings for alerting (new; SignalFusion runs as a batch).
5. **Risk-factor diff engine** — section-vs-prior-filing semantic + textual diff (new, but built on
   the existing section extractor + embeddings).
6. **Snapshot exporter** — write gold-layer JSON/Parquet that the Next.js app consumes via API
   routes, matching the terminal's existing `src/data/etl/*.json` + provenance-badge pattern.
7. **Next.js API routes + terminal pages** (new UI; see Sections 7–8).

---

## 4. Architecture

```
                         ┌──────────────────────────────────────────────────────────┐
                         │  edgar_intelligence service  (Python; reuses SignalFusion) │
                         │                                                            │
 SEC EDGAR ── sec_client │  INGEST   filings_index · download_docs · cik_lookup       │
 (data.sec.gov,          │  EXTRACT  parse_html · section_rules · section_extract     │
  /Archives,             │  NLP      embeddings · text_aggregation · topic_drift ·    │
  XBRL companyfacts)     │           explain_text · entity_features                   │
                         │  XBRL     companyfacts → structured financial features (NEW)│
                         │  MODEL    PCA → latent_state_model (HMM) → state_labeling   │
                         │  SCORE    importance (P0–P3) · decision_engine · confidence │
                         │  COHORT   index/sector/industry roll-ups (NEW)             │
                         │  EXPORT   gold JSON/Parquet snapshots + DuckDB (NEW glue)   │
                         └───────────────┬──────────────────────────────────────────┘
                                         │  FastAPI  +  gold snapshots
                                         ▼
        ┌────────────────────────────────────────────────────────────────────┐
        │  Next.js app (market_terminal)                                       │
        │   /api/edgar/*  route handlers (provenance-aware: LIVE | ETL | SIM)  │
        │   src/data/edgar*.ts  typed adapters + deterministic SIM fallback    │
        │   src/app/edgar/*  terminal pages (RADAR · TONE · RISK · REGIME ·    │
        │                    EXPO · COHORT · CO)                                │
        │   → streams into ALRT Alert Center, links into CRDT/SLAB/REGIME/EML  │
        └────────────────────────────────────────────────────────────────────┘
```

### 4.1 Storage (medallion, matching the roadmap)

- **Raw**: downloaded primary docs + raw submissions/XBRL JSON (already produced by
  `download_docs.py` → `raw/<cik>/<accession>/`).
- **Silver**: parsed sections (`sections.parquet`), per-doc embeddings (`embeddings.parquet`),
  per-doc NLP metrics, normalized XBRL facts. (`run_edgar.yaml` already names
  `outputs/edgar/sections.parquet` and `outputs/edgar/embeddings.parquet`.)
- **Gold**: regime state probabilities, importance/alerts table, tone time series, cohort
  roll-ups, exposure matrices — exported as compact JSON for the app
  (`src/data/etl/edgar/*.json`), mirroring the existing `src/data/etl/*.json` convention.

### 4.2 Provenance & resilience (reuse the existing pattern)

Every API response carries a `source` field (`LIVE` = fresh SEC pull, `ETL` = gold snapshot,
`SIM` = deterministic generator) so the UI renders uniformly even with no network — identical to
`/api/econ/series` today. Deterministic `SIM` generators live in `src/data/edgar*.ts` so the
pages are demo-able offline, exactly like `src/data/macroRegime.ts`.

### 4.3 SEC fair-access compliance (already handled, keep it)

`sec_client.py` already sets a descriptive `User-Agent` and a `rate_limit_seconds` throttle.
We keep ≤10 req/s, set a real contact in `edgar_ingest.yaml: sec.user_agent`, cache aggressively,
and store raw responses. EDGAR data is public; redistribution-grade concerns are minimal, but we
keep the same "research/local-first, replaceable adapter" stance as Yahoo in the roadmap.

---

## 5. Core analytics capabilities (the product)

### 5.1 Filing Radar & Alerts — `EDGR/RADAR`
- Poll the SEC daily/recent filings feed for the watched universe (`filings_index.py`), diff
  against stored accession numbers to detect **new** filings.
- For each new filing: extract sections, compute NLP metrics, score importance
  (`decisioning/importance.py`), and run the decision engine.
- Emit an `Alert` into **`ALRT`** when importance ≥ threshold or decision = `ESCALATE/MONITOR`.
  New alert category `SEC_FILING` (extends the existing `AlertCategory` union) with severity mapped
  from P0→`CRITICAL`, P1→`HIGH`, P2→`MEDIUM`, P3→`LOW` (mirrors `src/data/alerts.ts`).
- Alert payload: company, form, filing time, importance score, top risk terms, and a one-line
  "why this matters" (e.g., "10-K adds *going concern* and *covenant* language not in prior year").

### 5.2 Tone & Sentiment Trends — `EDGR/TONE`
- Per-section and per-filing NLP metrics over time:
  - **Sentiment/tone** (finance-tuned lexicon, e.g., Loughran–McDonald positive/negative/litigious/
    uncertainty counts) — built as keyword-rate features in the same style as
    `entity_features.py` / `updated_edgar_runner.py:_keyword_rate`.
  - **Uncertainty & litigation intensity** — reuse `edgar_importance.yaml` keyword lists.
  - **Readability / complexity** (Fog/length proxies — `length` is already an importance component).
- Visualize as `LineChart` tone evolution per company, `Sparkline` deltas in the grid, and a
  filing-over-filing "tone tape." Show **how tone has evolved** YoY and vs. the most recent prior
  filing of the same form.

### 5.3 Risk-Factor Diff & Drift — `EDGR/RISK`
- For each company, diff **Item 1A Risk Factors** (and MD&A) against the prior same-form filing:
  - **Added / removed / materially changed** risk paragraphs (textual diff + cosine distance on
    paragraph embeddings via `nlp/embeddings.py`).
  - **Risk-factor churn score** = fraction of risk language that changed YoY (novelty component
    already exists in the importance overlay).
- Surfaces *new* risks the moment they appear (e.g., a freshly-added cyber/AI/tariff risk factor).

### 5.4 Filing Regime Detection — `EDGR/REGIME`
- Build features = `[PCA(aggregated section embeddings)] ⊕ [keyword-rate signals] ⊕ [XBRL deltas]`,
  aggregated per period (`text_aggregation.py`, freq `Q`/`A` from `run_edgar.yaml`).
- Fit `LatentStateModel` (Gaussian HMM, `n_states: 3` default) → state probabilities over time.
- Label states by stress (`state_labeling.py`) → e.g., `CALM / CAUTIONARY / STRESSED` disclosure
  regimes. Explain each regime with `explain_text.py` top terms and `topic_drift.py` clusters.
- Two granularities: **per-company** regime path and **aggregate/cohort** regime (Section 5.7).
- Plays directly into the existing `EML` model registry and `REGIME` playbook.

### 5.5 Thematic & Financial Exposure Analytics — `EDGR/EXPO`
- **Thematic exposure (from text):** score each company's exposure to themes — supply chain, FX,
  interest-rate sensitivity, cyber, AI, geopolitics/sanctions/tariffs, refinancing/covenant,
  litigation/regulatory — using extended `entity_features.py` keyword families normalized by
  document length. Output an **exposure matrix** (company × theme) → `Matrix`/`Treemap` heatmaps.
- **Financial exposure (from XBRL):** ingest `companyfacts` (debt maturities, leverage,
  liquidity, segment/geographic revenue where tagged) → structured exposure features and YoY
  deltas. Reuses `sec_client.py`; aggregated in the `structured_features.py` pattern.
- Combined view answers "which names carry the most *rate / refinancing / FX / cyber* exposure,
  and is that exposure rising in their own words **and** in their numbers?"

### 5.6 Company Filing Workbench — `EDGR/CO`
- Single-issuer deep dive: filing timeline, regime path, tone evolution, risk-factor diff viewer,
  exposure radar (`Radial`), importance history, and links to the raw SEC document URLs
  (`download_docs.archive_url`).

### 5.7 Index / Sector / Industry Aggregation — `EDGR/COHORT`
- **Cohort definition:** map the universe to indices (e.g., S&P 500 via ETF-proxy membership per
  Market Lens Studio's proxy policy), GICS sector, and industry. New `universe` config extends
  `edgar_ingest.yaml`.
- **Roll-ups:** cohort-level mean/median tone, % of names in `STRESSED` regime, aggregate risk-term
  rate, theme-exposure breadth, and **dispersion** (how spread out names are).
- **Divergence detection:** flag names whose tone/regime diverges most from their cohort
  (z-score vs. cohort), and cohorts whose tone is deteriorating fastest (trend).
- **Trend views:** "sector tone over time" `LineChart`, "sector × theme" `Matrix`, cohort regime
  `Treemap`, and a leaders/laggards table — answering *"where is disclosure stress concentrating,
  by sector/industry/index, and how is it trending?"*

---

## 6. ML / NLP technique catalog

| Technique | Where | Library / source | Reused from SignalFusion? |
|---|---|---|---|
| Sentence embeddings | section & paragraph vectors | `sentence-transformers` (`all-MiniLM-L6-v2`) | ✅ `nlp/embeddings.py` |
| PCA stabilization | pre-HMM dimensionality reduction | `scikit-learn` | ✅ (in `edgar_runner.py`) |
| Gaussian HMM | regime / latent-state detection | `hmmlearn` | ✅ `models/latent_state_model.py` |
| Stress-based state labeling | name the regimes | z-score over signal cols | ✅ `models/state_labeling.py` |
| KMeans + TF-IDF | topic drift / emerging themes | `scikit-learn` | ✅ `nlp/topic_drift.py` |
| TF-IDF top-terms | regime explainability | `scikit-learn` | ✅ `nlp/explain_text.py` |
| Keyword-rate features | tone / risk / litigation / theme exposure | regex rate normalized by length | ✅ `entity_features.py`, `updated_edgar_runner.py` |
| Weighted importance scoring | P0–P3 alert prioritization | composite 0–100 | ✅ `decisioning/importance.py` |
| Confidence-gated decisions | ESCALATE/MONITOR/NORMAL | thresholds | ✅ `decisioning/decision_engine.py` |
| Embedding cosine diff | risk-factor YoY change | numpy/sklearn | 🔶 new, on existing embeddings |
| Finance sentiment lexicon | Loughran–McDonald tone | local lexicon | 🔶 new keyword lists (same mechanism) |
| XBRL structured features | financial exposure | `data.sec.gov` XBRL | 🔶 new ingestion, `structured_features.py` pattern |

> Upgrade paths (later, behind the same adapter): swap MiniLM → a finance-domain embedding model;
> swap keyword-lexicon sentiment → a fine-tuned/LLM classifier; add a fine-tuned regime classifier;
> wire the **`AI` Copilot** to RAG over filing sections (the embeddings already exist).

---

## 7. API surface (Next.js route handlers)

All under `src/app/api/edgar/`, all `force-dynamic`, all return a `source` badge field.

| Endpoint | Purpose |
|---|---|
| `GET /api/edgar/filings?ticker=AAPL&forms=10-K,10-Q&n=40` | Recent filings index (radar feed). |
| `GET /api/edgar/alerts?since=...` | New-filing alerts with importance + decision. |
| `GET /api/edgar/tone?ticker=AAPL&metric=sentiment&freq=Q` | Tone/uncertainty/litigation time series. |
| `GET /api/edgar/riskdiff?ticker=AAPL` | Risk-factor added/removed/changed vs. prior filing. |
| `GET /api/edgar/regime?ticker=AAPL` and `?cohort=XLK` | State probabilities + labels + top terms. |
| `GET /api/edgar/exposure?ticker=AAPL` and `?cohort=SP500` | Theme + financial exposure matrix. |
| `GET /api/edgar/cohort?type=sector&id=XLF&metric=tone` | Cohort roll-ups, dispersion, divergence. |
| `GET /api/edgar/company/[cik]` | Workbench bundle for one issuer. |
| `POST /api/cron/edgar-radar` | Scheduled incremental poll + alert generation (extends `api/cron/refresh`). |

---

## 8. Frontend / UX (matching the terminal)

New nav group **Filing Intelligence** in `src/components/shell/Sidebar.tsx`, with pages under
`src/app/edgar/*`, reusing existing primitives (`PageHeader`, `KpiStrip`, `Panel`, `Stat`, `Tag`,
`DataGrid`, `SourceBadge`) and charts (`LineChart`, `BarChart`, `Sparkline`, `Matrix`, `Treemap`,
`Radial/Gauge`, `NetworkGraph`, `ScatterPlot`). Design language unchanged: black canvas, amber
command accent, green/red tone semantics, tabular numerics.

| Page | Code | Key widgets |
|---|---|---|
| Filing Radar | `EDGR/RADAR` | Live filing stream `DataGrid`, P0–P3 badges, importance `Gauge`, "why it matters" detail. |
| Tone Trends | `EDGR/TONE` | Tone `LineChart`, per-name `Sparkline`s, YoY delta table. |
| Risk Diff | `EDGR/RISK` | Added/removed/changed risk panels, churn `ProgressBar`, paragraph diff viewer. |
| Filing Regime | `EDGR/REGIME` | State-probability `LineChart`, regime `Treemap`, top-terms panel, topic clusters. |
| Exposure | `EDGR/EXPO` | Company×theme `Matrix`, exposure `Treemap`, XBRL delta bars, exposure `Radial`. |
| Cohort | `EDGR/COHORT` | Sector tone over time, sector×theme `Matrix`, dispersion, leaders/laggards. |
| Company | `EDGR/CO` | Timeline, regime path, exposure radar, filing links. |

---

## 9. Data model (TypeScript types, `src/data/edgar.ts`)

```ts
export type EdgarForm = "10-K" | "10-Q" | "8-K" | "20-F" | "S-1" | "DEF 14A";
export type DisclosureRegime = "CALM" | "CAUTIONARY" | "STRESSED";
export type ImportanceBucket = "P0" | "P1" | "P2" | "P3";
export type ExposureTheme =
  | "SUPPLY_CHAIN" | "FX" | "RATES" | "CYBER" | "AI"
  | "GEOPOLITICAL" | "REFINANCING" | "LITIGATION" | "REGULATORY";

export interface Filing {
  cik: string; ticker: string; company: string;
  form: EdgarForm; filingDate: string; reportDate: string;
  accession: string; secUrl: string;
  importanceScore: number;      // 0–100  (decisioning/importance.py)
  importanceBucket: ImportanceBucket;
  decision: "ESCALATE" | "MONITOR" | "NORMAL" | "NO_ACTION";
}

export interface TonerPoint { period: string; sentiment: number; uncertainty: number; litigation: number; }
export interface RegimePoint { period: string; probs: number[]; mostLikely: number; label: DisclosureRegime; }
export interface RiskDiff { added: string[]; removed: string[]; changed: string[]; churn: number; }
export interface ExposureRow { ticker: string; company: string; theme: ExposureTheme; score: number; deltaYoY: number; }
export interface CohortSummary {
  cohort: string; type: "INDEX" | "SECTOR" | "INDUSTRY";
  meanTone: number; pctStressed: number; dispersion: number;
  topDivergent: { ticker: string; z: number }[];
}
```

Gold snapshots mirror these shapes in `src/data/etl/edgar/*.json`; SIM generators in
`src/data/edgar.ts` use `Rng` (as `macroRegime.ts` does) so pages render offline.

---

## 10. Phased delivery

**Phase 0 — Service extraction & snapshots (foundation).**
Package SignalFusion's EDGAR runners into `edgar_intelligence`; wire ingest→extract→embed→HMM→
importance for the seed universe in `edgar_ingest.yaml` (AAPL, MSFT, AMZN, JPM, GOOGL, NVDA, AMD);
export gold JSON. Deliver `EDGR/RADAR` + `EDGR/CO` reading from snapshots, plus `SEC_FILING` alerts.

**Phase 1 — Tone, risk diff, regime.**
`EDGR/TONE`, `EDGR/RISK`, `EDGR/REGIME` pages; tone time series; risk-factor diff engine; per-company
HMM regime with labels + explainability; register the model in `EML`.

**Phase 2 — Exposure & XBRL.**
Add `companyfacts` XBRL ingestion; thematic + financial exposure matrices; `EDGR/EXPO`.

**Phase 3 — Cohort aggregation.**
Index/sector/industry membership + roll-ups + divergence; `EDGR/COHORT`; feed cohort tone into the
macro `REGIME` playbook as a bottom-up signal.

**Phase 4 — Live & Copilot.**
Scheduled radar polling (`/api/cron/edgar-radar`), incremental updates, and RAG over filing sections
in the `AI` Copilot using the existing embeddings.

---

## 11. Risks, compliance & disclaimers

- **SEC fair access:** keep `sec_client.py` throttling + descriptive `User-Agent`; set a real
  contact in config; cache aggressively. Public data, but be a good citizen.
- **Model interpretability:** HMM states are unsupervised — always ship the `explain_text.py` top
  terms and `topic_drift.py` clusters next to any regime call so users see *why*.
- **Not investment advice:** carry SignalFusion's disclaimer — decision support / analysis only,
  not predictive guarantees.
- **Data quality:** section detection can miss non-standard layouts; track extraction success in
  `DATAOPS` (provenance + confidence via `monitoring/confidence_metrics.py`).
- **Universe drift:** index/sector membership uses ETF proxies for prototyping — label proxies per
  Market Lens Studio's `proxy_policy`; upgrade to licensed constituent data later.

---

## 12. Appendix — concrete reuse cheat-sheet

To stand up Phase 0, copy/import these from `unstructured_signal_fusion/signalfusion/` and wrap:

```
src/edgar_ingest/sec_client.py        # transport
src/edgar_ingest/cik_lookup.py        # ticker -> CIK
src/edgar_ingest/filings_index.py     # recent filings -> radar feed
src/edgar_ingest/download_docs.py     # fetch primary docs + sec_url
src/edgar_extract/parse_html.py       # html -> text
src/edgar_extract/section_rules.py    # (extend with 8-K + more items)
src/edgar_extract/section_extract.py  # section slicing
src/edgar_extract/embed_sections.py   # section embeddings
src/nlp/embeddings.py                 # SentenceTransformer
src/nlp/text_aggregation.py           # period mean-pool
src/nlp/topic_drift.py                # emerging themes
src/nlp/explain_text.py               # regime top-terms
src/features/entity_features.py       # keyword/theme flags (extend lexicons)
src/features/structured_features.py   # XBRL aggregation pattern
src/features/align_features.py        # text + structured join
src/models/latent_state_model.py      # Gaussian HMM
src/models/state_labeling.py          # stress labeling (reconfigure signal cols)
src/decisioning/importance.py         # P0-P3 scoring
src/decisioning/decision_engine.py    # ESCALATE/MONITOR/NORMAL
src/monitoring/confidence_metrics.py  # confidence gating
config/edgar_ingest.yaml              # universe + forms + paths
config/run_edgar.yaml                 # freq + model + text columns
config/edgar_importance.yaml          # importance weights + keyword lists
edgar_runner.py / updated_edgar_runner.py  # orchestration templates
```

Outputs already produced by these runners map cleanly to terminal views:

| SignalFusion output | Terminal consumer |
|---|---|
| `state_probabilities.csv` | `EDGR/REGIME` state path |
| `state_summary.csv`, `state_top_terms.csv` | regime labels + explainability |
| `state_topic_clusters_summary.csv` | topic drift / emerging themes |
| `top_important_*.csv` | `EDGR/RADAR` + `ALRT` alerts |
| `bi_table.csv`, `features_matrix.csv` | tone/exposure grids + `EML` features |

---

*Bottom line:* the ML is already built and proven in `unstructured_signal_fusion`. This plan is
mostly **packaging + a cohort layer + XBRL + terminal UI** — high leverage, low ML risk.
