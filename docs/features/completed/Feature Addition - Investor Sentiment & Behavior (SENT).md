# Feature Addition — Investor Sentiment & Behavior (`SENT`)

Date: 2026-06-21
Status: Completed — `SENT` is integrated with live-capable providers
Module code: **`SENT`** — Investor Sentiment & Behavior
Related: `docs/features/completed/Feature Addition - NEWS Terminal Module (Market News & Signal Intelligence).md`, `docs/features/completed/Feature Addition - Desk Pulse (Funding & Squeeze Radar).md`, `docs/features/Feature Addition - Intelligence Layer (SEC Edgar, Stocktwits, X, and News).md`

---

## 1. Objective & thesis

Build a dedicated **Investor Sentiment & Behavior** module that fuses **survey-based sentiment** (the slow, high-signal read of what investors *say* they think) with **social-media sentiment** (the fast, noisy read of what they're *actually saying right now*) into one behavioral picture.

The edge is behavioral and largely **contrarian**: sentiment extremes mark turning points. Retail euphoria (AAII bulls » bears, manic WSB activity) tends to precede pullbacks; capitulation (extreme bearishness, fear spikes) tends to precede rallies. No single source captures this — surveys are weekly and lag; social is real-time but noisy and crowd-prone. Combining them, and watching where they **diverge**, is the product.

The module answers:

> "Are investors fearful or greedy right now — and how extreme is it historically?"
> "What is retail saying vs what active managers are *doing*?"
> "Which tickers/sectors/themes is the crowd piling into or capitulating on?"
> "When sentiment has looked like this before, what happened next?"
> "Is social mood diverging from the survey data (a warning)?"

### How this differs from existing modules

| Module | Focus | Relationship |
|---|---|---|
| `NEWS` → Social Intelligence (NEWS-3) | News-driven *buzz / mention volume* by ticker | `SENT` is about *investor mood & positioning*, not headline flow. Shares the social-ingestion plumbing. |
| `SQZ` | Borrow demand / squeeze microstructure | `SENT` cross-links per-ticker (crowded longs + heavy social + high short interest = squeeze/​unwind risk). |
| `REGIME` / `SNAP` | Macro & cross-asset regime | `SENT` is the *behavioral* regime layer (fear/greed), complementary. |

One-liner: **`NEWS` tells you what's happening; `SENT` tells you how investors feel and are positioned about it.**

---

## 2. Who it's for

- **Traders / PMs** — contrarian timing, crowding risk, fear/greed regime.
- **Risk & desk heads** — positioning extremes, retail-vs-institutional divergence.
- **Account managers** — client-facing "market mood" color and behavioral context.
- **Securities-lending / prime** — crowded-long + heavy-short names (cross-link to `SQZ`).

---

## 3. Data sources

### Tier 1 — Survey & positioning (slow, high-signal)

| Source | What | Cadence | Access |
|---|---|---|---|
| **AAII Investor Sentiment Survey** | % individual investors **bullish / neutral / bearish** (next 6 months); the bull-bear spread | Weekly (Thu) | Free; AAII publishes a downloadable historical series (CSV). The canonical retail-sentiment contrarian gauge. |
| **NAAIM Exposure Index** | Active managers' mean equity exposure (−200…+200) | Weekly | Free download. What managers are *doing*, not saying. |
| **Investors Intelligence Bull/Bear** | Newsletter-writer sentiment | Weekly | Paid (optional). |
| **Market-based fear/greed inputs** | Put/call ratio, VIX, breadth, safe-haven demand, junk-bond demand | Daily | Already available via the FRED/econ layer (`VIXCLS`) + market snapshots; the rest computed. |

### Tier 2 — Social sentiment (fast, noisy)

| Source | What | Access |
|---|---|---|
| **X (Twitter)** | Cashtag ($TICKER) post volume + sentiment, theme chatter | X API (paid tiers) or an aggregator; reuse `NEWS` ingestion. |
| **Reddit** | r/wallstreetbets, r/stocks, r/investing, r/options, r/stockmarket — mention volume, sentiment, award/upvote engagement, "diamond hands" behavior | Reddit API (PRAW); free tier with rate limits. |
| **StockTwits** | Native bull/bear tags per cashtag | StockTwits API. |

NLP: **VADER**/**FinBERT** for social sentiment scoring; surveys are already structured. Entity extraction maps posts → tickers/sectors/themes (reuse `NEWS` NLP layer).

---

## 4. Core views

### SENT-1 — Sentiment Dashboard (headline)
A **Fear ↔ Greed gauge** (0–100, "Extreme Fear → Extreme Greed") as the hero, built from a composite index (§5). Below it: the component breakdown (survey, social, positioning, volatility, breadth) each as a mini-gauge, plus the current **regime label** and a one-line behavioral read-through.

### SENT-2 — AAII Survey Monitor
Bullish / neutral / bearish over time (stacked), the **bull–bear spread** with ±1σ contrarian bands, the historical **percentile** of today's reading, and shaded "euphoria" / "capitulation" zones. Table of recent weeks.

### SENT-3 — Social Sentiment
X + Reddit combined: most-discussed **tickers / sectors / themes**, **net sentiment** and **mention velocity** per name, trending topics, and a bull/bear ratio. Platform breakdown (X vs Reddit vs StockTwits) with per-platform mood.

### SENT-4 — Behavior & Positioning
**NAAIM** active-manager exposure trend, **put/call** ratio, equity **fund flows**, and the **retail-vs-institutional divergence** (AAII retail bulls vs NAAIM exposure) — the classic "dumb money vs smart money" read.

### SENT-5 — Contrarian Signals & Historical Analogs
When sentiment hits an extreme, surface the signal (e.g. "AAII bull–bear in top 5% historically — contrarian caution") with **confidence, direction, and a forward-return study** (SPY/QQQ over 1W/1M/3M after similar readings) — same engine shape as `NEWS-4`/`NEWS-7`.

### SENT-6 — Survey vs Social Divergence
Track where the **weekly survey disagrees with real-time social mood** (e.g. survey neutral but social euphoric, or vice-versa) — an early-warning that one cohort is about to capitulate or chase.

### SENT-7 — Ticker Sentiment Drill
Per-name behavioral card: social mention trend + net sentiment, StockTwits bull/bear, options put/call & skew, and a **cross-link to `SQZ`** (short interest / utilization) — crowded long + heavy short = unwind/squeeze risk.

---

## 5. The Sentiment Index (composite, 0–100)

A transparent, CNN-Fear-&-Greed-style composite so the hero gauge is explainable. Inputs, each normalized to its own history (0–100) then weighted:

| Input | Source | Weight | Note |
|---|---|---|---|
| AAII bull–bear spread (inverted) | AAII | 0.20 | high bullishness → greed |
| NAAIM exposure | NAAIM | 0.15 | managers all-in → greed |
| Social net sentiment | X + Reddit | 0.20 | crowd mood |
| Social mention velocity | X + Reddit | 0.10 | mania detection |
| Put/Call ratio (inverted) | options | 0.10 | low p/c → greed |
| VIX (inverted, percentile) | `VIXCLS` (FRED) | 0.10 | low vol → complacency |
| Market breadth / momentum | market snapshots | 0.10 | strong breadth → greed |
| Safe-haven / junk demand | cross-asset | 0.05 | risk appetite |

Output 0–100 with regime bands: **Extreme Fear (<20) · Fear (20–40) · Neutral (40–60) · Greed (60–80) · Extreme Greed (>80)**, plus a 1-day/1-week delta and the direction of travel.

---

## 6. Data architecture (medallion)

- **Raw:** `raw_aaii_survey`, `raw_naaim`, `raw_social_posts` (reuse `NEWS`), `raw_reddit_posts`, `raw_stocktwits`.
- **Silver:** `normalized_sentiment` (date, source, scope[market|ticker|sector|theme], bull_pct, bear_pct, neutral_pct, net_sentiment, mentions, engagement).
- **Gold:** `analytics_sentiment_index` (composite + components), `analytics_social_sentiment` (per ticker/sector/theme), `analytics_contrarian_signals`, `analytics_sentiment_divergence`.

Same medallion / DuckDB / Polars / FastAPI structure as the rest of the pipeline.

---

## 7. Reuse cheat-sheet (existing pipelines & structure)

| Need | Reuse |
|---|---|
| Social ingestion + NLP (X/Reddit/StockTwits) | `NEWS` module's Tier-2 social plumbing & entity extraction |
| VIX / put-call / macro context | FRED/econ layer (`VIXCLS` now catalogued), `/api/chart/series` |
| Market breadth / cross-asset risk | `/api/market/[view]`, `marketLens` engine, `SNAP` |
| Per-ticker squeeze cross-link | `SQZ` (`src/data/squeeze.ts`) |
| Forward-return / historical-analog study | the `NEWS` impact engine shape |
| Charts | `LineChart`, `Sparkline`, `BarChart`, gauge pattern, `Matrix/HeatGrid` |
| Determinism / fallback / badges | `Rng`, `ProvenanceBadge` (`SIM` until live feeds wired) |
| Alerts | `ALRT` — sentiment-extreme & divergence alerts stream in |

No new ingestion pattern: `SENT` sits on the social layer `NEWS` already defines + the FRED/market layers that exist.

---

## 8. Provenance & fallback

Consistent with the whole terminal: a **deterministic seeded engine** renders the full module instantly (SSR-safe), badged `SIM`. Each source upgrades independently when wired:

- **AAII / NAAIM** → `SURVEY` (live) once the weekly CSV ingest is configured.
- **X / Reddit / StockTwits** → `SOCIAL` (live) behind the `NEWS` social feeds.
- **VIX / put-call / breadth** → already `FRED` / `DB` via existing layers.

Nothing silently fakes live data; the composite shows which components are live vs simulated.

---

## 9. Phased delivery

- **Phase 1 — `SENT` core (deterministic).** Sentiment Index + Dashboard (SENT-1), AAII Monitor (SENT-2), Social Sentiment (SENT-3), seeded engine + nav entry. Ships fully functional offline (`SIM`).
- **Phase 2 — Behavior & contrarian.** Positioning (SENT-4), Contrarian Signals + historical analogs (SENT-5), Survey-vs-Social Divergence (SENT-6).
- **Phase 3 — Drill & wiring.** Ticker drill (SENT-7) with `SQZ` cross-link, `ALRT` integration, `VIXCLS`/put-call live via the econ layer.
- **Phase 4 — Live ingestion (pipeline).** AAII/NAAIM weekly CSV ingest; X/Reddit/StockTwits behind the `NEWS` social feeds; FinBERT/VADER scoring in the Python pipeline. UI unchanged.

## 10. Risks & notes

- **API cost/limits:** X API is paid; Reddit has rate limits; budget and cache. AAII/NAAIM are free but have light usage/licensing terms — attribute and cache.
- **Social bias:** Reddit/X skew retail and can be manipulated/brigaded — weight surveys + positioning, flag manipulation (sudden velocity with thin account diversity).
- **Sentiment ≠ causation:** contrarian signals are probabilistic and timing-imprecise; present with confidence + historical base rates, never as certainties.
- **Scope discipline:** `SENT` is the *behavioral* layer — it cross-links to `NEWS`/`SQZ`/`SNAP` rather than duplicating them.

*Bottom line:* one behavioral-intelligence module that pairs the gold-standard retail survey (AAII) and manager positioning (NAAIM) with real-time X/Reddit mood, distilled into an explainable fear/greed index with contrarian signals and divergence alerts — built on the social, FRED, and market pipelines that already exist.
