# Portfolio & Regime Models

Independently installable Python package, initially hosted in QuantMeridian at
`models/portfolio_regime/`. Distribution: `portfolio-regime-models`; import:
`portfolio_regime_models`; initial scaffold version: `0.1.0`; Python: 3.12+.

**Status:** packaging scaffold only. No portfolio solver, HMM, backtester, source
connector, CLI or numerical contract is implemented. There are no runtime
dependencies yet. Spec026's numerical methods and dependency choices remain open.

## Ownership and portability

This directory is the standalone project root: package metadata, source, tests,
and model documentation travel together. Future numerical inputs/results and
runtime schemas/resources belong inside this package. Future HTTP transport
contracts and the independent API verifier belong to the service/terminal.

Model code accepts supplied inputs. It must not import the API package, FastAPI,
terminal code or database/provider clients, read terminal environment variables,
or locate files outside this project. Package runtime resources with the wheel
and access them as package resources. Never depend on a repository-root path or
`PYTHONPATH` trick. An eventual CLI must work from the installed distribution.

To extract later, move this directory to its own repository, preserve the
distribution/import identity and native API, then update the service's reviewed
artifact source/pin. No numerical or HTTP interface rewrite should be required.
The repository/license decision for any external publication remains separate.

## Build and test

Run from this directory with Python 3.12+, pip, setuptools>=68 and wheel already
installed. An editable install is for development; built wheels are the service
integration boundary. Build requirements are not production dependency locks.

```sh
python3 -m pip wheel --no-deps --no-build-isolation --wheel-dir /tmp/pora-wheels .
python3 -m unittest discover -s tests -v
```

The portability test copies only this project into a temporary location, builds
without network/dependency resolution, installs its wheel in a clean temporary
virtual environment, removes the copied source and imports with Python isolated
mode. It verifies that neither FastAPI nor the service is required. It needs the
build tools in the invoking environment; it never downloads them automatically.

Future implementation areas are `portfolio/`, `regime/`, `evaluation/`, native
contracts, CLI and model cards. Their interfaces and financial behavior will be
added only through the accepted capability specs.
