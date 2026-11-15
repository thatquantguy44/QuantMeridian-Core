import { describe, expect, it } from "vitest";
import { normalizeAaiiRows } from "./normalize";
import { aaiiFixture, aaiiPair } from "./testFixtures";
const at="2026-10-31T12:00:00.000000Z";
describe("AAII source contract and presentation normalization",()=>{
  it("converts fractions exactly once and preserves null publication and safe provenance",()=>{
    const d=normalizeAaiiRows([aaiiFixture()],at);
    expect(d.observations[0]).toMatchObject({surveyDate:"2026-10-22",bullishPct:40,neutralPct:20,bearishPct:40,bullBearSpreadPp:0,providerPublishedAt:null});
    expect(d.provenance).toMatchObject({source:"AAII",dataset:"aaii-investor-sentiment",dataState:"LIVE",ageCalendarDays:9,knowledgeBasis:"CURRENT_VINTAGE"});
    for(const key of ['raw_run_id','raw_sha256','content_hash','parser_version']) expect(JSON.stringify(d)).not.toContain(key);
  });
  it("sorts a bounded selection and preserves recorded multi-week gaps without filling",()=>{
    const [a,b]=aaiiPair();b.survey_date="2026-10-29";b.gap_days=14;
    const d=normalizeAaiiRows([b,a],at);
    expect(d.observations.map(r=>r.surveyDate)).toEqual(["2026-10-15","2026-10-29"]);
    expect(d.observations[1]).toMatchObject({gapDays:14,spreadChangePp:20,adjacentContext:"WITHIN_SELECTION"});
  });
  it("keeps a prior date outside the bounded selection as upstream-only context",()=>{
    const [,b]=aaiiPair();const d=normalizeAaiiRows([b],at);
    expect(d.observations[0]).toMatchObject({previousSurveyDate:"2026-10-15",adjacentContext:"UPSTREAM_ONLY",gapDays:7});
  });
  it("treats exactly ten UTC calendar days as current and eleven as stale",()=>{
    expect(normalizeAaiiRows([aaiiFixture()],"2026-11-01T23:59:59.999999Z").provenance.dataState).toBe("LIVE");
    expect(normalizeAaiiRows([aaiiFixture()],"2026-11-02T00:00:00.000000Z").provenance.dataState).toBe("STALE");
  });
  it("accepts the inclusive total tolerance through binary rounding, but not material violations",()=>{
    const row=aaiiFixture();row.bullish=.4;row.neutral=.2;row.bearish=.398;row.bull_bear_spread_pp=.2;
    expect(normalizeAaiiRows([row],at).observations[0].bearishPct).toBeCloseTo(39.8,10);
    row.bearish=.397999;row.bull_bear_spread_pp=.2001;
    expect(()=>normalizeAaiiRows([row],at)).toThrow("INVALID_TOTAL");
  });
  it.each([
    ['wrong source',{source:'AAII'}],['wrong dataset',{dataset:'other'}],['invalid date',{survey_date:'2026-02-30'}],
    ['future date',{survey_date:'2026-11-01'}],['numeric string',{bullish:'0.4'}],['nonfinite',{bullish:Infinity}],
    ['out of bounds',{bullish:-.1}],['total',{bullish:.9}],['spread',{bull_bear_spread_pp:10}],
    ['missing required spread',{bull_bear_spread_pp:null}],['missing first seen',{first_seen_at:null}],
    ['invalid clock',{retrieved_at:'not supplied'}],['unknown publication forged',{provider_published_at:'2026-11-01T00:00:00Z'}],
    ['future microsecond',{retrieved_at:'2026-10-31T12:00:00.000001Z'}],['lineage',{version_id:''}],
  ])("rejects %s without coercion or fabricated observations",(_label,override)=>{
    expect(()=>normalizeAaiiRows([{...aaiiFixture(),...override}],at)).toThrow();
  });
  it("rejects duplicate/conflicting dates, empty/oversized results and broken adjacency",()=>{
    expect(()=>normalizeAaiiRows([],at)).toThrow("EMPTY_SOURCE");
    expect(()=>normalizeAaiiRows([aaiiFixture(),aaiiFixture()],at)).toThrow("DUPLICATE_DATE");
    expect(()=>normalizeAaiiRows(Array.from({length:105},()=>aaiiFixture()),at)).toThrow("HISTORY_LIMIT");
    for(const override of [{gap_days:8},{previous_version_id:'f'.repeat(64)},{spread_change_pp:99},{previous_survey_date:'2026-10-01'}]) {
      const [a,b]=aaiiPair();expect(()=>normalizeAaiiRows([a,{...b,...override}],at)).toThrow("INVALID_ADJACENCY");
    }
  });
  it("keeps corrected current-vintage versions distinct without inferring archived knowledge",()=>{
    const before=normalizeAaiiRows([aaiiFixture()],at),row=aaiiFixture();
    row.version_id='b'.repeat(64);row.bullish=.45;row.bearish=.35;row.bull_bear_spread_pp=10;
    const revised=normalizeAaiiRows([row],at);
    expect(revised.observations[0].versionToken).not.toBe(before.observations[0].versionToken);
    expect(revised.observations[0].bullBearSpreadPp).toBe(10);
    expect(before.observations[0].bullBearSpreadPp).toBe(0);
    expect(revised.provenance.knowledgeBasis).toBe("CURRENT_VINTAGE");
  });
});
