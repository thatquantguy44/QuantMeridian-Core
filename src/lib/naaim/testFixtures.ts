/** Entirely invented artifact values and lineage for offline tests. */
export function naaimArtifactFixture() {
  return {
    schema_version: "naaim-exposure-research/1",
    generated_at: "2026-11-02T18:00:00.000000Z",
    provenance: {
      source: "NAAIM Exposure Index®",
      dataset: "naaim-exposure-index-public-delayed",
      attribution: "Source: NAAIM Exposure Index® (National Association of Active Investment Managers).",
      authorized_research_use_reference: "invented-approved-report-display",
      knowledge_basis: "CURRENT_VINTAGE",
      display_name: "NAAIM Exposure Index — 3-month-delayed public data",
      delayed_public_display: true,
      provider_delay_months: 3,
      delay_notice: "NAAIM delays this public feed by three months. The observation date is as_of_date; a recent capture does not mean current-week data. Internal research only.",
    },
    observations: [
      { as_of_date: "2026-07-01", value: "62.50", first_seen_at: "2026-10-01T18:00:00.000000Z", capture_id: "a".repeat(64) },
      { as_of_date: "2026-07-08", value: "71.25", first_seen_at: "2026-10-08T18:00:00.000000Z", capture_id: "b".repeat(64) },
    ],
  };
}
