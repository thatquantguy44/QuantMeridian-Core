# Spec026 capability map — Portfolio Optimization & Regime Analysis

**Status:** Capability design remains proposed, 2026-11-01. The owner accepted
`models/portfolio_regime/` as an independent model package and a separate API
package in this repository. The terminal has a source-inspection preview; the
service remains health-only with no numerical capability or operational binding.

One terminal module, **PORA**, route `/portfolio-regime`, under Optimization.
Its current preview inspects the retained SPY source and a bounded multi-ETF
comparison and a session-only snapshot/replay artifact; it does not admit data to a model. Five internal capabilities have separate contracts and acceptance
criteria; they do not imply five services or terminal modules.

| Stable capability ID | Responsibility / consumer | Depends on | Specification |
| --- | --- | --- | --- |
| `pr-data` | Admit versioned research snapshots and decision-time evidence for all calculations. | — | [Data](SPEC-pr-data.md) |
| `pr-portfolio` | Produce constrained portfolio candidates and independent numerical checks. | `pr-data` | [Portfolio](SPEC-pr-portfolio.md) |
| `pr-regime` | Produce causal statistical regime probabilities and signal features. | `pr-data` | [Regime](SPEC-pr-regime.md) |
| `pr-evaluation` | Compare allocation and signal experiments on aligned, cost-aware holdouts; export replay evidence. | `pr-data`, `pr-portfolio`, `pr-regime` | [Evaluation](SPEC-pr-evaluation.md) |
| `pr-assist` | Attended, evidence-bound explanation and review of completed research artifacts. | `pr-data`, `pr-evaluation` | [Assistance](SPEC-pr-assist.md) |

Build order: `pr-data` → a thin `pr-portfolio` workflow → a thin `pr-regime`
workflow → `pr-evaluation` integrating both → optional `pr-assist`.
Portfolio-only and regime-only evaluation adapters can ship before their combined
experiment. Provider contracts live in the corresponding capability specification
and [shared transport contract](DATA_CONTRACT.md); consumers cannot redefine them.

App, service and model boundaries follow [the existing service standard](../../services.md)
and [spec016](../spec016/SPEC.md): React/Vite presentation → same-origin Node
composition → one Python adapter → separately versioned model package. No service
calls another service. The terminal assembles eligible inputs. QuantSmith
orchestration and Agent-Skills engineering workflows have distinct roles, defined
in [AGENT_WORKFLOW.md](AGENT_WORKFLOW.md).

Approve this map before implementing any capability. Review the whole proposed
suite first; approval of one capability does not approve later stages or defaults.
