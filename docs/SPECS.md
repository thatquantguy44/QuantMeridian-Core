# Spec index

Every QuantMeridian spec lives in `docs/specs/<id>/`, as `SPEC.md` plus, where written,
`PLAN.md`, `TASKS.md` and `HANDOFF.md`. The **Status** column quotes the spec's own status line
when its index row was last updated. A spec's own files are authoritative; update this index when a status changes.
For the current work queue, start at [`handoff.md`](handoff.md), "▶ STOPPING POINT — 2026-10-20".

| Spec | Title | Status (from its `SPEC.md`) | Current state / pickup |
|---|---|---|---|
| [spec001](specs/spec001/) | Expand CPI component coverage | No status line; see the spec | — |
| [spec002](specs/spec002_news_live_intelligence/) | NEWS live intelligence expansion | No status line; see the spec | — |
| [spec003](specs/spec003/) | Market volatility module | No status line; see the spec | — |
| [spec004](specs/spec004/) | Daily market publishing suite | No status line; see the spec | — |
| [spec005](specs/spec005/) | QuantSmith integration layer | No status line; see the spec | — |
| [spec006](specs/spec006/) | Material-change detector (MPUB candidate feed) | No status line; see the spec | — |
| [spec007](specs/spec007/) | Inventory optimizer (IBAL) integration | Approved for local and protected-staging implementation; production separately gated | The base integration; spec013 extends it |
| [spec009](specs/spec009/) | Module agent workflows | Draft, pending owner review | Not approved |
| [spec010](specs/spec010/) | Warehouse explorer | Draft, pending owner review | Not approved |
| [spec011](specs/spec011/) | Money market execution optimizer (`MMKT`) | Approved 2026-10-18 | SIM module runs end to end. Open: Gold rates, positions feed, latency MM-012. [HANDOFF](specs/spec011/HANDOFF.md) |
| [spec012](specs/spec012/) | Configurable sources and uses optimizer (`SXU`) | Approved 2026-10-18 | Contracts only (SU-002). Next: production LP, verifier and API (SU-003 onward). [HANDOFF](specs/spec012/HANDOFF.md) |
| [spec013](specs/spec013/) | IBAL showcase | Approved 2026-10-17 | IBAL-001 to IBAL-007 done; IBAL-008 (as-built evidence) open. [TASKS](specs/spec013/TASKS.md) |
| [spec014](specs/spec014/) | Liquidity forecasting, shortfall and anomaly oversight | Draft; all owner questions resolved 2026-10-18 | **Awaits owner approval** before any code |
| [spec015](specs/spec015/) | Pluggable money market and collateral Optimization Center (`OPT`) | Draft | OPT hub and session run log built; the durable registry is open |
| [spec016](specs/spec016/) | InventoryBallast collateral optimizer binding (`COLL`) | Draft for review | Local SIM integration implemented; production activation blocked on spec015 and governed sources. [TASKS](specs/spec016/TASKS.md) |
| [spec020](specs/spec020/) | Borrower default and indemnification risk (`INDEM`) | Phase 1 approved 2026-10-20 | Phase 1 merged (PR #188) and validated (`VALIDATION.md`). Next: IND-T15a, long reported runs through the terminal. Phase 2 awaits decision 10. [HANDOFF](specs/spec020/HANDOFF.md) |
| [spec025](specs/spec025/) | AAII PostgreSQL integration and source-only SENT | Private local read/API/UI verified; NO SIM in SENT | AAII history/dates plus seven verified macro Gold series and histories live locally; missing sources show No data. Next: real NAAIM source admission. [HANDOFF](specs/spec025/HANDOFF.md) |
| [spec026](specs/spec026/) | Portfolio Optimization & Regime Analysis (`PORA`) | Source-inspection preview and package scaffolds; numerical plan remains draft | PORA source review and session-only research snapshot/replay plus an independently installable model and health-only API; no numerical binding or run route. Next: source admission, runtime and dependent policy decisions. [PLAN](specs/spec026/PLAN.md) / [TASKS](specs/spec026/TASKS.md) |
| [spec032](specs/spec032/) | Platform performance and visual responsiveness | Draft for review | SXU-first profiling, loading/interaction budgets, shared visual and dense-view optimization, and regression gates. [Spec](specs/spec032/SPEC.md) / [Tasks](specs/spec032/TASKS.md) |
| [spec034](specs/spec034/) | Trade-flow imbalance data and signal | SIM curve formulas and local diagnostic built; real sources open | Source-backed SOFR mean-level / far-minus-near flow kernel and SIM CLI, plus bounded gated Kraken diagnostic capture/replay. Observed sources, effective mapping/rolls and production policies remain open. [Formula](specs/spec034/FORMULA_POLICY.md) / [Handoff](specs/spec034/HANDOFF.md) / [Validation](specs/spec034/VALIDATION.md) / [Spec](specs/spec034/SPEC.md) / [Tasks](specs/spec034/TASKS.md) |

Cross-repository program: InventoryBallast `specs/0018-live-poc-showcase/` (the live
proof-of-concept) is the parent of spec011 to spec014.
