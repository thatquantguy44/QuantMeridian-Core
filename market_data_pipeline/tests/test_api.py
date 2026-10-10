"""API integration tests — full pipeline (offline) behind FastAPI."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient


@pytest.fixture(scope="module")
def client(tmp_path_factory, monkeypatch_module):
    # point the pipeline + service at a throwaway DB, force synthetic sources
    db = tmp_path_factory.mktemp("api") / "market.duckdb"
    monkeypatch_module.setenv("MDP_OFFLINE", "1")

    from market_data_pipeline.src.config import settings as settings_mod

    settings_mod._settings = None  # reset singleton
    s = settings_mod.get_settings()
    s.duckdb_path = db
    s.offline = True

    from market_data_pipeline.src.ingestion.pipeline import Pipeline

    Pipeline().run()  # seed the DB

    from market_data_pipeline.src.api.app import app
    from market_data_pipeline.src.api.service import MarketDataService
    import market_data_pipeline.src.api.app as app_mod

    app_mod.service = MarketDataService(str(db))
    return TestClient(app)


@pytest.fixture(scope="module")
def monkeypatch_module():
    from _pytest.monkeypatch import MonkeyPatch

    mp = MonkeyPatch()
    yield mp
    mp.undo()


def test_health(client):
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"
    assert r.json()["normalized_rows"] > 0


def test_market_snapshot(client):
    r = client.get("/snapshot/market")
    assert r.status_code == 200
    cards = r.json()["cards"]
    assert len(cards) > 0
    c = cards[0]
    for k in ("series_id", "price", "ytd", "max_drawdown", "asof"):
        assert k in c


def test_rates_snapshot(client):
    r = client.get("/snapshot/rates")
    body = r.json()
    assert r.status_code == 200
    assert "curve" in body and "spreads" in body
    assert len(body["curve"]) >= 3


def test_inflation_snapshot(client):
    r = client.get("/snapshot/inflation")
    assert r.status_code == 200
    assert len(r.json()["cards"]) >= 1


def test_cross_asset(client):
    r = client.get("/snapshot/cross-asset")
    assert r.status_code == 200
    assert "equities" in r.json()


def test_regime(client):
    r = client.get("/dashboard/regime")
    body = r.json()
    assert r.status_code == 200
    assert -100 <= body["composite"]["score"] <= 100


def test_series_and_404(client):
    assert client.get("/series/SPY").status_code == 200
    assert client.get("/series/SPY").json()["observations"]
    assert client.get("/series/DOES_NOT_EXIST").status_code == 404


def test_manifest(client):
    r = client.get("/manifest/latest")
    assert r.status_code == 200
    assert len(r.json()["manifest"]) > 0


def test_serving_table_has_all_views(client):
    """The pipeline materializes total and price-basis terminal views."""
    import json as _json

    import market_data_pipeline.src.api.app as app_mod
    from market_data_pipeline.src.storage.duckdb_store import DuckDBStore

    with DuckDBStore(app_mod.service.db_path) as s:
        rows = s.query("SELECT view, payload_json FROM analytics_api_views")
    views = set(rows["view"].to_list())
    assert views == {
        "market", "cross-asset", "rates", "inflation", "regime", "bilello", "index-returns",
        "market:price", "cross-asset:price", "regime:price", "bilello:price", "index-returns:price",
    }
    # every payload is valid JSON matching the API shape
    payloads = {r["view"]: _json.loads(r["payload_json"]) for r in rows.to_dicts()}
    assert len(payloads["market"]["cards"]) > 0
    assert -100 <= payloads["regime"]["composite"]["score"] <= 100
    assert payloads["market"]["return_basis"] == "total"
    assert payloads["market:price"]["return_basis"] == "price"
    assert payloads["index-returns"]["matrices"]["SPX"]["rows"]


def test_no_nan_in_payloads(client):
    import math

    def assert_finite(o):
        if isinstance(o, float):
            assert math.isfinite(o)
        elif isinstance(o, dict):
            for v in o.values():
                assert_finite(v)
        elif isinstance(o, list):
            for v in o:
                assert_finite(v)

    for ep in ("/snapshot/market", "/snapshot/rates", "/snapshot/inflation", "/dashboard/regime"):
        assert_finite(client.get(ep).json())
