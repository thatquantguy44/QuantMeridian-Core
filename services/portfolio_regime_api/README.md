# Portfolio & Regime API

Separate installable service package for the portable `portfolio-regime-models`
distribution. The model is initially co-located at `models/portfolio_regime/`,
but this service consumes it as an installed dependency, never a relative import.

**Status:** health-only scaffold. `GET /health` returns HTTP 503 with
`UNCONFIGURED`, `ready: false`, installed package versions and no implemented
methods. Installed version metadata is not binding attestation. No run,
capabilities, authentication, numerical verifier, source connector, terminal
service registration or automatic launcher has been implemented. There is no usable
numerical binding manifest yet; none is fabricated by this scaffold.

The service will own HTTP/authentication, transport mapping, independent result
verification and process supervision. The model owns numerical methods and native
contracts. Terminal routes assemble eligible data; neither model nor API queries
Gold or invokes another service. Remaining numerical and operational policy is
defined in `docs/specs/spec026/` and still requires the recorded decisions.

## Development installation

From the repository root, in a dedicated Python 3.12+ virtual environment:

```sh
python3 -m venv /tmp/pora-service-venv
/tmp/pora-service-venv/bin/python -m pip install -e ./models/portfolio_regime -e './services/portfolio_regime_api[dev]'
/tmp/pora-service-venv/bin/python -m pytest services/portfolio_regime_api/tests -q
/tmp/pora-service-venv/bin/python -m uvicorn portfolio_regime_api.app:app --host 127.0.0.1 --port 8019
```

Development installation resolves the declared framework/test dependencies. A
reviewed production lock, source/wheel/installed-content attestation, authorization
and run supervision must precede numerical routes. Use the loopback host; `8019`
is the proposed local port and is not added to `dev:all` by this change.

## Artifact boundary and later extraction

Build model and service wheels separately. Integration tests must install the
wheels in an environment outside the checkout, without repository paths on
`PYTHONPATH`. For the initial co-located binding, future provenance records
`thatquantguy44/QuantMeridian`, its exact commit, model package subdirectory,
package version and reviewed source/wheel/lock/installed-content digests. Moving
the model to another repository changes that artifact source/pin, not this import
name or HTTP contract. Exact package version alone does not establish readiness.
