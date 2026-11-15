/** Entirely invented values/lineage for offline tests; no provider payload. */
export function aaiiFixture() {
  return {source:"aaii",dataset:"aaii-investor-sentiment",survey_date:"2026-10-22",bullish:.4,neutral:.2,bearish:.4,
    bull_bear_spread_pp:0,previous_survey_date:null as string|null,gap_days:null as number|null,spread_change_pp:null as number|null,
    version_id:"a".repeat(64),previous_version_id:null as string|null,first_seen_at:"2026-10-30T12:00:00.000000Z",
    retrieved_at:"2026-10-30T12:00:00.000000Z",provider_published_at:null as string|null,
    content_hash:"c".repeat(64),raw_run_id:"invented-run",raw_sha256:"d".repeat(64),parser_version:"fictional/1"};
}
export function aaiiPair() {
  const older={...aaiiFixture(),survey_date:"2026-10-15",version_id:"e".repeat(64)};
  const latest={...aaiiFixture(),bullish:.5,bearish:.3,bull_bear_spread_pp:20,previous_survey_date:older.survey_date,
    gap_days:7,spread_change_pp:20,previous_version_id:older.version_id};
  return [older,latest];
}
