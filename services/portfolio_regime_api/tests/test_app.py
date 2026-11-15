"""The scaffold must never advertise an executable numerical model."""

from fastapi.testclient import TestClient
from portfolio_regime_api.app import app


def test_health_reports_installed_packages_without_claiming_model_readiness():
    with TestClient(app) as client:
        response = client.get("/health")
    assert response.status_code == 503
    body = response.json()
    assert body["status"] == "UNCONFIGURED"
    assert body["ready"] is False
    assert body["bindingStatus"] == "UNCONFIGURED"
    assert body["implementedMethods"] == []
    assert body["modelVersion"]
    assert body["serviceVersion"]


def test_scaffold_exposes_no_run_or_documentation_endpoints():
    with TestClient(app) as client:
        assert client.post("/v1/runs", json={"snapshot": {}}).status_code == 404
        assert client.get("/v1/capabilities").status_code == 404
        assert client.get("/docs").status_code == 404
        assert client.get("/openapi.json").status_code == 404
