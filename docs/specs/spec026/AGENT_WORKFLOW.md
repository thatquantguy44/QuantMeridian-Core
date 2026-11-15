# Spec026 QuantSmith and Agent-Skills workflow

**Status:** Domain-informed documentation now; proposed runtime assistance later.
No QuantSmith runtime or provider call was executed to produce this suite.

## Distinct library roles

**Agent-Skills:** immutable engineering workflow snapshot under `.agents/`, pinned
to `thatquantguy44/agent-skills` commit
`f63ec56a3cc936408d792956ae583c3c96a825bd`. Use it for specification, task slicing,
tests, independent review, browser verification and release discipline. It is not
a portfolio optimizer or runtime dependency to install into the model container.

**QuantSmith:** locally supplied domain/persona library selected at
`../../agentic_workflows/qf_workflow_sdk_public`. Inspected instructions and
reference numerics inform this suite; [REFERENCE_MODELS.md](REFERENCE_MODELS.md)
records source fingerprints and limitations. The existing content pin's code and
assets differ from that local copy. The pin currently lists `agents/analytics`,
one macro summarizer, securities-financing and selected knowledge assets; it
does not admit PM/construction/backtest agents merely because their files exist.

Do not modify either pin as part of documentation work. Review exact consumed
code/assets and dependencies, intentionally extend the asset manifest, and run
startup/conformance tests before future execution. A passing pin-record consistency
script with advisory source drift is not strict runtime readiness.

## Domain handoffs grounded in inspected QuantSmith instructions

These are proposed roles, not a claim that every persona was invoked. PM subgroup
selection follows its inspected README and shared portfolio-management instructions.

| Stage | QuantSmith persona / instruction path | Expected artifact / authority |
| --- | --- | --- |
| Mandate and scope | `agents/portfolio_management/pm_orchestrator`, `mandate_objectives`, `universe_selection`; `instructions/portfolio_management.md` | Mandate, benchmark, universe/rights and capability handoff; D01–D03 proposals. |
| Input admission | `agents/portfolio_management/data_signal_intake`; `agents/data_quality/instructions.md` | Grain, availability, membership/corporate-action and missingness findings; DATA acceptance tests. |
| Allocation design | `agents/portfolio_management/allocation_policy`, `construction_oversight`; `agents/optimization/portfolio_construction/instructions.md` | Objective/constraint/model recommendation, baseline and PORT fixtures. Math remains in the separately reviewed model package. |
| Risk and diagnostics | `agents/portfolio_management/risk_budgeting`, `compliance_constraints` | Concentration/exposure/risk-budget findings; no legal compliance certification. |
| Experiments | `agents/backtest_review/instructions.md` | Severity-ordered findings, required tests, assumptions, production blockers and recommendation; EVAL leakage/cost/fold evidence. |
| Interpretation | `agents/portfolio_management/performance_attribution`, `monitoring_governance` | Evidence-linked comparison and monitoring proposals; no invented causality or provider data. |
| Governance inventory | `agents/enterprise_risk/model_risk_management/instructions.md` | Caller-supplied inventory/finding status, tier/age and denominators; explicitly no SDK runtime or model approval by this persona. |

The existing `macro_regime_classifier` persona is a macro-context candidate only;
it is not the HMM engine. Do not imply persona descriptions implement causal
filtering, numerical verification, alpha validation or a live execution system.

## Engineering gates for each approved implementation slice

1. Read [using-agent-skills](../../../.agents/skills/using-agent-skills/SKILL.md),
   the accepted spec/capability, open decisions and minimal relevant source context.
2. Follow [spec-driven-development](../../../.agents/skills/spec-driven-development/SKILL.md)
   and [planning-and-task-breakdown](../../../.agents/skills/planning-and-task-breakdown/SKILL.md).
   The user requested all documents now; all generated phases remain drafts until
   human review. Repository `SPEC.md`/`PLAN.md`/`TASKS.md` naming takes precedence
   over the toolkit's generic `tasks/` output defaults.
3. Use [api-and-interface-design](../../../.agents/skills/api-and-interface-design/SKILL.md)
   for transport/model boundaries and
   [source-driven-development](../../../.agents/skills/source-driven-development/SKILL.md)
   against exact selected dependencies. Current proposals reference official docs,
   but no unreviewed package version is accepted.
4. Use [incremental-implementation](../../../.agents/skills/incremental-implementation/SKILL.md)
   and [test-driven-development](../../../.agents/skills/test-driven-development/SKILL.md)
   for each behavioral slice: independent failing calculation/rejection test →
   smallest implementation → verifier → full UI/export path. Do not write tests
   that merely mirror solver code. This documentation task adds no runtime behavior.
5. Apply [doubt-driven-development](../../../.agents/skills/doubt-driven-development/SKILL.md)
   to nontrivial boundary/causality claims with a fresh reviewer given artifact and
   contract, not the author's conclusion. Classify actionable findings and record
   fixes. Offer optional cross-model review per that skill; no external CLI without
   explicit authorization. Reviewers do not autonomously spawn more reviewers.
6. Use [frontend-ui-engineering](../../../.agents/skills/frontend-ui-engineering/SKILL.md)
   and the repository browser-testing workflow for actual UI changes. Verify real
   browser states/downloads against the new service; do not call documentation
   wireframes browser-tested. Apply security/observability skills when implementing
   intake, service credentials, supervision and production instrumentation.
7. Apply [code-review-and-quality](../../../.agents/skills/code-review-and-quality/SKILL.md)
   across correctness, clarity, architecture, security and performance; record
   checks and material limitations. Run immutable skill pin checks; do not edit
   the mirror. Owner approval governs merging/deployment, not reviewer sentiment.

## Runtime assistance proposal

PORA numerical jobs do not enter the LLM queue. Future attended explanation jobs
use a supported new PORA workflow/dispatch after D09; the present worker filters
claims to ECOIQ. Add schema and module-policy/context allowlist support before
exposing a panel. Do not widen ECOIQ dispatch implicitly.

First use deterministic evidence templates. Evaluate optional direct/gateway/local
profiles on claim accuracy, refusal of unknown facts, citation correctness,
latency, token use and approved data classes. The current `anthropic-direct`
configuration and its model string are observed configuration, not an availability
probe or recommendation. Select exact provider model and budget explicitly;
preserve fail-closed no-fallback behavior and profile identity.

Allowed context is bounded public/synthetic run facts and stable evidence IDs.
No raw private positions, account identifiers, credentials or arbitrary source
text become tools/instructions. Model changes create a new proposed profile that
needs validation; the agent cannot mutate the active run. Service or LLM failure
leaves existing numerical evidence unchanged and assistance visibly unavailable.
