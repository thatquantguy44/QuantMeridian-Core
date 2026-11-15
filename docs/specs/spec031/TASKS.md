# Relationship Intelligence Graph tasks

| Task | Deliverable / acceptance | Dependency | State |
|---|---|---|---|
| KGR-T01 | Capability map, scope, data contract and decision record | Owner direction | Complete |
| KGR-T02 | Deterministic synthetic graph/schedule/stress fixture with unit tests | T01 | Complete |
| KGR-T03 | Graph + scenario delta view with bounded scenarios | T02 | Complete |
| KGR-T04 | Schedule timeline, coupling matrix and evidence ledger | T02 | Complete |
| KGR-T05 | Navigation, responsive browser verification, typecheck and build | T03–T04 | Complete |
| KGR-T06 | Synthetic inventory graph and overlay: coverage, reuse, mobilization, conflicts and substitution | T02–T04 | Complete |
| KGR-T08 | Expand multi-book dataset and add custody, cutoff and compound scenarios | T02, T06 | Complete |
| KGR-T09 | Add graph/inventory drillthrough and impact-path explorer | T05, T06, T08 | Complete |
| KGR-T10 | Add bounded temporal graph mode and effective-date replay | T02, T08, T09 | Complete |
| KGR-T07 | Optional source admission and portable service proposal | Owner/source review | Research prepared; admission gated |
| KGR-T07a | Collect and assess all six public providers; provenance, normalized research records, examples and service proposal | Owner request, T01 | Complete for research scope; CME original capture unavailable |
| KGR-T07b | Approve rights, effective-date semantics, complete extraction scope and freshness before activating source adapters | T07a, owner/source review | Gated |

## Checkpoint: synthetic explorer

- [x] All six views derive from the same snapshot.
- [x] Focused unit tests pass.
- [x] `KGR` is visible only when its module flag is enabled.
- [x] The page is usable at narrow and desktop widths.

T07 is not part of the synthetic prototype and must not be marked complete by
rendering fictional data.

The six-provider research package and remaining admission criteria are in
[SOURCE_ADMISSION.md](SOURCE_ADMISSION.md) and [sources/README.md](sources/README.md).
T07a covers research, not complete production ingestion. Its 17 captured
originals and four CME web-only references are distinguished in the manifest.
