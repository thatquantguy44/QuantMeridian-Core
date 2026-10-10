"""Macro / market regime dashboard.

Produces bounded scores in [-100, 100] with categorical labels for several
regime axes plus a composite, and a short text narrative. Every input is
optional: missing data falls back to a neutral 0 so the card never crashes.
"""

from __future__ import annotations

from typing import Optional

import polars as pl

from market_data_pipeline.src.analytics import _returns as R


def _clip(x: float) -> float:
    return max(-100.0, min(100.0, x))


def _has(df: Optional[pl.DataFrame], series_id: str) -> bool:
    if df is None or df.height == 0:
        return False
    return df.filter(pl.col("series_id") == series_id).height > 0


def _vals(df: Optional[pl.DataFrame], series_id: str):
    if df is None or df.height == 0:
        return [], []
    return R.to_series(df, series_id)


def _last(df: Optional[pl.DataFrame], series_id: str) -> Optional[float]:
    _, v = _vals(df, series_id)
    return v[-1] if v else None


def _label_three(score: float, pos: str, mid: str, neg: str, thr: float = 20.0) -> str:
    if score >= thr:
        return pos
    if score <= -thr:
        return neg
    return mid


def _risk_on_off(prices: Optional[pl.DataFrame]) -> float:
    """Equities (SPY) momentum vs safe havens (TLT/GLD) and VIX level."""
    score = 0.0
    contrib = 0
    # SPY 1y/3m momentum
    sdates, svals = _vals(prices, "SPY")
    if svals:
        r = R.pct_return(svals, R.TD_3M)
        if r is not None:
            score += _clip(r * 400.0)  # +25% over 3m -> +100
            contrib += 1
    # safe haven relative weakness is risk-on: subtract TLT momentum
    tdates, tvals = _vals(prices, "TLT")
    if tvals:
        r = R.pct_return(tvals, R.TD_3M)
        if r is not None:
            score += _clip(-r * 200.0)
            contrib += 1
    # VIX level: low VIX -> risk on. ~15 neutral, 30+ risk off
    vix = _last(prices, "VIX") or _last(prices, "VIXCLS")
    if vix is not None:
        score += _clip((15.0 - vix) * 5.0)
        contrib += 1
    if contrib == 0:
        return 0.0
    return _clip(score / contrib)


def _inflation_pressure(macro: Optional[pl.DataFrame]) -> float:
    """CPI / Core CPI YoY level and trend. Higher inflation -> positive score."""
    from market_data_pipeline.src.analytics.inflation import inflation_dashboard

    cards = inflation_dashboard(macro) if macro is not None else []
    if not cards:
        return 0.0
    score = 0.0
    contrib = 0
    for c in cards:
        if c["series_id"] not in {"CPIAUCSL", "CPILFESL"}:
            continue
        yoy = c.get("yoy")
        if yoy is None:
            continue
        # 2% target neutral; 6% -> +100, -2% deflation -> -100
        level = (yoy - 2.0) * 25.0
        prior = c.get("prior_yoy")
        trend = 0.0
        if prior is not None:
            trend = (yoy - prior) * 30.0
        score += _clip(level + trend)
        contrib += 1
    if contrib == 0:
        return 0.0
    return _clip(score / contrib)


def _growth_momentum(
    macro: Optional[pl.DataFrame], prices: Optional[pl.DataFrame]
) -> float:
    """Payrolls / claims / industrial production momentum; equity proxy fallback."""
    score = 0.0
    contrib = 0
    # Payrolls (PAYEMS) MoM positive -> growth
    pdates, pvals = _vals(macro, "PAYEMS")
    if pvals:
        m = R.mom(pvals)
        if m is not None:
            score += _clip(m * 100.0)
            contrib += 1
    # Initial claims (ICSA) rising -> negative growth
    cdates, cvals = _vals(macro, "ICSA")
    if cvals:
        ch = R.pct_return(cvals, min(4, len(cvals) - 1))
        if ch is not None:
            score += _clip(-ch * 200.0)
            contrib += 1
    # Industrial production (INDPRO) YoY
    idates, ivals = _vals(macro, "INDPRO")
    if ivals:
        y = R.yoy(ivals)
        if y is not None:
            score += _clip(y * 20.0)
            contrib += 1
    if contrib == 0:
        # equity-breadth / SPY momentum proxy
        _, svals = _vals(prices, "SPY")
        if svals:
            r = R.pct_return(svals, R.TD_1Y)
            if r is not None:
                return _clip(r * 200.0)
        return 0.0
    return _clip(score / contrib)


def _liquidity(
    macro: Optional[pl.DataFrame], prices: Optional[pl.DataFrame]
) -> float:
    """M2 YoY growth (positive) and credit spreads (wide -> negative)."""
    score = 0.0
    contrib = 0
    _, m2 = _vals(macro, "M2SL")
    if m2:
        y = R.yoy(m2)
        if y is not None:
            # ~6% normal; >10% ample, <0 tight
            score += _clip((y - 2.0) * 15.0)
            contrib += 1
    # BAML HY OAS (BAMLH0A0HYM2) wide -> tight liquidity
    _, oas = _vals(macro, "BAMLH0A0HYM2")
    if oas:
        last = oas[-1]
        if last is not None:
            # ~4% normal, 8%+ stressed
            score += _clip((4.0 - last) * 25.0)
            contrib += 1
    # HYG/LQD relative as a credit proxy from prices
    if contrib == 0:
        _, hyg = _vals(prices, "HYG")
        if hyg:
            r = R.pct_return(hyg, R.TD_3M)
            if r is not None:
                score += _clip(r * 400.0)
                contrib += 1
    if contrib == 0:
        return 0.0
    return _clip(score / contrib)


def regime_dashboard(
    prices_norm: Optional[pl.DataFrame], macro_norm: Optional[pl.DataFrame]
) -> dict:
    """Compute regime scores/labels and a narrative. Robust to missing inputs."""
    risk = _risk_on_off(prices_norm)
    infl = _inflation_pressure(macro_norm)
    growth = _growth_momentum(macro_norm, prices_norm)
    liq = _liquidity(macro_norm, prices_norm)
    composite = _clip((risk + growth + liq - infl) / 4.0)

    # asof = latest date across both frames
    asof = None
    for df in (prices_norm, macro_norm):
        if df is not None and df.height > 0:
            d = df.get_column("date").max()
            if d is not None and (asof is None or d > asof):
                asof = d

    risk_label = _label_three(risk, "RISK-ON", "NEUTRAL", "RISK-OFF")
    infl_label = _label_three(infl, "HIGH", "MODERATE", "LOW")
    growth_label = _label_three(growth, "EXPANSION", "STABLE", "CONTRACTION")
    liq_label = _label_three(liq, "AMPLE", "NEUTRAL", "TIGHT")
    comp_label = _label_three(composite, "RISK-ON", "NEUTRAL", "RISK-OFF")

    narrative = (
        f"Markets are {risk_label.lower()} with {growth_label.lower()} growth "
        f"momentum. Inflation pressure is {infl_label.lower()} and liquidity is "
        f"{liq_label.lower()}. Composite regime reads {comp_label}."
    )

    def axis(score: float, label: str) -> dict:
        return {"score": round(_clip(score), 1), "label": label}

    return {
        "asof": asof.isoformat() if asof is not None else None,
        "risk_on_off": axis(risk, risk_label),
        "inflation_pressure": axis(infl, infl_label),
        "growth_momentum": axis(growth, growth_label),
        "liquidity": axis(liq, liq_label),
        "composite": axis(composite, comp_label),
        "narrative": narrative,
    }
