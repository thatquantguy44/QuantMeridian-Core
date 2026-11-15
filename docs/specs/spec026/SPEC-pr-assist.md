# Capability specification: `pr-assist`

**Status:** Proposed and optional; depends on completed `pr-evaluation` artifacts
and `pr-data` provenance. Parent: [SPEC.md](SPEC.md).

## Objective and authority

Use QuantSmith's PM, construction and backtest-review instructions for attended
interpretation of a fixed research artifact. Inputs are allowlisted facts and
explicit questions. Output can explain a constraint, summarize an ablation or
list unresolved assumptions with evidence references. It cannot select or execute
trades, alter parameters, validate a model or approve deployment.

## Requirements

- **ASSIST-01:** capability readiness requires reviewed consumed QuantSmith code
  and assets, pin match, tested PORA dispatch/job support, shared schemas, module
  policy/context allowlist and approved profile/data classes. The current ECOIQ-only
  worker is insufficient. These are future tasks, not existing capabilities.
- **ASSIST-02:** numerical facts originate in independently checked artifacts.
  An agent references run ID plus stable table/metric/row IDs and units; the
  terminal checks citations and recomputes admissible numerical claims. No free-form
  LLM number is promoted into model facts. Unsupported claims remain unverified.
- **ASSIST-03:** use deterministic templates first. Proposed profile alternatives
  are existing `deterministic`, operator-configured `anthropic-direct`, or approved
  local/gateway profiles. No model identifier in current settings proves provider
  availability or quality. Select a frozen provider model only after capability,
  budget, privacy and fixture evaluations; no silent provider fallback.
- **ASSIST-04:** unavailable/disabled assistance does not block any numerical
  workflow. Prompts and imported notes are untrusted; no arbitrary tools, network
  access, code execution, credentials or private holdings in model context.
- **ASSIST-05:** record profile/provider/model/asset identities, input evidence
  hash, token use, latency and claim-verification status separately from numerical
  identity. Replaying stochastic narration does not imply identical wording.

## Acceptance and implementation boundary

- **ASSIST-AC01:** absent pin/capability, ECOIQ-only dispatch or disallowed data
  class refuses assistance before any provider call; research calculations remain
  available. A mismatched copy never gets a successful readiness badge.
- **ASSIST-AC02:** hostile imported instructions and fabricated performance claims
  cannot change weights, research facts or deployment status. Unsupported citations,
  wrong units and changed run IDs fail claim validation.
- **ASSIST-AC03:** deterministic output is available without an LLM. Provider
  timeouts/budgets show their real status and cannot switch profiles silently.

Future code: `services/agent_worker` PORA dispatch and contract tests;
`contracts/agent` versioned workflow/context extensions; terminal panel components.
Follow existing generated contract style, hosted/offline fixture tests and separate
local QuantSmith conformance verification. Commands: [PLAN.md](PLAN.md).
Resolve D09 before runtime integration. QuantSmith model-risk agents report
human governance status only; they never issue validation or investment approval.
