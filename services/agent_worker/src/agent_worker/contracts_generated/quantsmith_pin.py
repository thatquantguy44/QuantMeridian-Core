# GENERATED from contracts/agent/quantsmith-pin.schema.json by scripts/generate-agent-contracts.mjs.
# Do not edit by hand; run `npm run generate:agent-contracts`.

from __future__ import annotations

from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, RootModel


class Package(BaseModel):
    model_config = ConfigDict(
        extra='forbid',
    )
    name: Literal['quantsmith']
    version: Annotated[str, Field(pattern='^[0-9]+\\.[0-9]+\\.[0-9]+$')]
    code_digest: Annotated[str, Field(pattern='^sha256:[0-9a-f]{64}$')]


class Path(RootModel[str]):
    root: Annotated[
        str, Field(min_length=1, pattern='^[A-Za-z0-9_][A-Za-z0-9_./\\-]*$')
    ]


class Assets(BaseModel):
    model_config = ConfigDict(
        extra='forbid',
    )
    digest: Annotated[str, Field(pattern='^sha256:[0-9a-f]{64}$')]
    paths: Annotated[list[Path], Field(min_length=1)]


class Reviewed(BaseModel):
    model_config = ConfigDict(
        extra='forbid',
    )
    on: Annotated[str, Field(pattern='^[0-9]{4}-[0-9]{2}-[0-9]{2}$')]
    source_commit: Annotated[str, Field(pattern='^[0-9a-f]{40}$')]
    note: str | None = None


class Reviewed1(BaseModel):
    model_config = ConfigDict(
        extra='forbid',
    )
    on: Annotated[str, Field(pattern='^[0-9]{4}-[0-9]{2}-[0-9]{2}$')]
    source_path: Annotated[
        str,
        Field(
            description='Optional local QuantSmith root, absolute or relative to the QuantMeridian repository root. No Git checkout or commit is required. Content fingerprints remain mandatory.',
            min_length=1,
            pattern='\\S',
        ),
    ]
    note: str | None = None


class Reviewed2(BaseModel):
    model_config = ConfigDict(
        extra='forbid',
    )
    on: Annotated[str, Field(pattern='^[0-9]{4}-[0-9]{2}-[0-9]{2}$')]
    source_commit: Annotated[str, Field(pattern='^[0-9a-f]{40}$')]
    source_path: Annotated[
        str,
        Field(
            description='Optional local QuantSmith root, absolute or relative to the QuantMeridian repository root. No Git checkout or commit is required. Content fingerprints remain mandatory.',
            min_length=1,
            pattern='\\S',
        ),
    ]
    note: str | None = None


class QuantSmithPin(BaseModel):
    model_config = ConfigDict(
        extra='forbid',
    )
    schema_version: Literal['quantsmith-pin/1']
    package: Package
    assets: Assets
    reviewed: Reviewed | Reviewed1 | Reviewed2
