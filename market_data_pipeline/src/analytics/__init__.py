"""Analytics terminal-card layer for the market-data pipeline.

Public card builders consume the canonical normalized long-format frame and
return JSON-native structures suitable for a Bloomberg-style terminal UI.
"""

from market_data_pipeline.src.analytics.snapshot import market_snapshot
from market_data_pipeline.src.analytics.cross_asset import cross_asset_dashboard
from market_data_pipeline.src.analytics.rates import rates_dashboard
from market_data_pipeline.src.analytics.inflation import inflation_dashboard
from market_data_pipeline.src.analytics.drawdowns import (
    drawdown_table,
    rolling_return_percentile_table,
)
from market_data_pipeline.src.analytics.regime import regime_dashboard
from market_data_pipeline.src.analytics.bilello import (
    best_worst_ytd,
    asset_class_returns_by_year,
    current_drawdowns,
    rolling_return_percentiles,
    rate_moves_ranked,
    inflation_vs_policy_gap,
    unemployment_vs_longrun,
)
from market_data_pipeline.src.analytics.eda import (
    eda_dashboard,
    cross_correlation,
    lagged_ols,
    granger_causality,
    pearson_heatmap,
    cusum_changepoints,
    pelt_changepoints,
)

__all__ = [
    "market_snapshot",
    "cross_asset_dashboard",
    "rates_dashboard",
    "inflation_dashboard",
    "drawdown_table",
    "rolling_return_percentile_table",
    "regime_dashboard",
    "best_worst_ytd",
    "asset_class_returns_by_year",
    "current_drawdowns",
    "rolling_return_percentiles",
    "rate_moves_ranked",
    "inflation_vs_policy_gap",
    "unemployment_vs_longrun",
    "eda_dashboard",
    "cross_correlation",
    "lagged_ols",
    "granger_causality",
    "pearson_heatmap",
    "cusum_changepoints",
    "pelt_changepoints",
]
