import { AAII_DATASET, AAII_MAX_HISTORY, AAII_SOURCE, AAII_SPREAD_TOLERANCE_PP, AAII_STALE_AFTER_DAYS, AAII_TOTAL_TOLERANCE,
  type AaiiObservation, type AaiiSelection } from "./contracts";

const fail=(code:string):never=>{throw new Error(code);};
function object(v:unknown):Record<string,unknown>{if(!v||typeof v!=="object"||Array.isArray(v))return fail("INVALID_ROW");return v as Record<string,unknown>;}
function text(v:unknown):string{if(typeof v!=="string"||!v.trim()||v.length>256)return fail("INVALID_LINEAGE");return v;}
function hash(v:unknown):string{const s=text(v);if(!/^[a-f0-9]{64}$/.test(s))return fail("INVALID_LINEAGE");return s;}
function number(v:unknown):number{if(typeof v!=="number"||!Number.isFinite(v))return fail("INVALID_NUMBER");return v;}
function date(v:unknown):string{
  if(typeof v!=="string"||!/^\d{4}-\d{2}-\d{2}$/.test(v))return fail("INVALID_DATE");
  const ms=Date.parse(v+"T00:00:00Z");
  if(!Number.isFinite(ms)||new Date(ms).toISOString().slice(0,10)!==v)return fail("INVALID_DATE");return v;
}
const day=(v:string)=>Date.parse(v+"T00:00:00Z")/86400000;
/** Upstream clocks are UTC ISO strings with up to six fractional digits. */
function micros(v:unknown):bigint{
  if(typeof v!=="string"||!/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,6})?Z$/.test(v))return fail("INVALID_TIMESTAMP");
  date(v.slice(0,10));const ms=Date.parse(v);if(!Number.isFinite(ms))return fail("INVALID_TIMESTAMP");
  const fraction=(v.match(/\.(\d+)Z$/)?.[1]??"").padEnd(6,"0");
  return BigInt(ms)*1000n+BigInt(fraction.slice(3));
}
export function normalizeAaiiRows(values:readonly unknown[],assessedAt:string):AaiiSelection{
  const cutoff=micros(assessedAt),asOfDate=assessedAt.slice(0,10);
  if(!Array.isArray(values)||!values.length)return fail("EMPTY_SOURCE");
  if(values.length>AAII_MAX_HISTORY)return fail("HISTORY_LIMIT");
  const rows=values.map(value=>{
    const r=object(value);
    if(r.source!==AAII_SOURCE||r.dataset!==AAII_DATASET)return fail("SOURCE_IDENTITY");
    const surveyDate=date(r.survey_date);if(surveyDate>asOfDate)return fail("FUTURE_REPORTED_DATE");
    const shares=[r.bullish,r.neutral,r.bearish].map(number);
    if(shares.some(v=>v<0||v>1))return fail("INVALID_SHARE_RANGE");
    // Upstream validates decimal values before DOUBLE PRECISION storage. Bound
    // only representational sum error; do not repair totals or rescale shares.
    if(Math.abs(shares.reduce((a,b)=>a+b,0)-1)>AAII_TOTAL_TOLERANCE+8*Number.EPSILON)return fail("INVALID_TOTAL");
    const spread=number(r.bull_bear_spread_pp);
    if(Math.abs(spread-(shares[0]-shares[2])*100)>AAII_SPREAD_TOLERANCE_PP)return fail("INVALID_SPREAD");
    const firstSeenAt=text(r.first_seen_at),retrievedAt=text(r.retrieved_at);
    const firstSeen=micros(firstSeenAt),retrieved=micros(retrievedAt);
    if(firstSeen>retrieved||firstSeen>cutoff||retrieved>cutoff)return fail("AFTER_CUTOFF");
    const providerPublishedAt=r.provider_published_at===null?null:text(r.provider_published_at);
    if(providerPublishedAt!==null&&micros(providerPublishedAt)>retrieved)return fail("AFTER_CUTOFF");
    const version=hash(r.version_id);hash(r.content_hash);hash(r.raw_sha256);text(r.raw_run_id);text(r.parser_version);
    const previousSurveyDate=r.previous_survey_date===null?null:date(r.previous_survey_date);
    const previousVersion=r.previous_version_id===null?null:hash(r.previous_version_id);
    const gapDays=r.gap_days===null?null:number(r.gap_days);
    const spreadChangePp=r.spread_change_pp===null?null:number(r.spread_change_pp);
    if(previousSurveyDate===null){
      if(previousVersion!==null||gapDays!==null||spreadChangePp!==null)return fail("INVALID_ADJACENCY");
    }else if(previousSurveyDate>=surveyDate||previousVersion===null||gapDays===null||!Number.isInteger(gapDays)||
      gapDays!==day(surveyDate)-day(previousSurveyDate)||spreadChangePp===null||Math.abs(spreadChangePp)>200+AAII_SPREAD_TOLERANCE_PP)return fail("INVALID_ADJACENCY");
    const observation:AaiiObservation={surveyDate,bullishPct:shares[0]*100,neutralPct:shares[1]*100,bearishPct:shares[2]*100,
      bullBearSpreadPp:spread,previousSurveyDate,gapDays,spreadChangePp,adjacentContext:previousSurveyDate?"UPSTREAM_ONLY":"NONE",
      versionToken:`aaii-version:${version}`,firstSeenAt,retrievedAt,providerPublishedAt};
    return {observation,version,previousVersion};
  }).sort((a,b)=>a.observation.surveyDate.localeCompare(b.observation.surveyDate));
  for(let i=1;i<rows.length;i++){
    const r=rows[i],prior=rows[i-1];
    if(r.observation.surveyDate===prior.observation.surveyDate)return fail("DUPLICATE_DATE");
    if(r.observation.previousSurveyDate!==prior.observation.surveyDate||r.previousVersion!==prior.version||r.observation.spreadChangePp===null||
      Math.abs(r.observation.spreadChangePp-(r.observation.bullBearSpreadPp-prior.observation.bullBearSpreadPp))>AAII_SPREAD_TOLERANCE_PP)return fail("INVALID_ADJACENCY");
    r.observation.adjacentContext="WITHIN_SELECTION";
  }
  const latest=rows[rows.length-1].observation,ageCalendarDays=day(asOfDate)-day(latest.surveyDate);
  return {schemaVersion:"aaii-research/1",methodVersion:"aaii-gold-normalization/1",assessedAt,observations:rows.map(r=>r.observation),
    provenance:{source:"AAII",dataset:AAII_DATASET,knowledgeBasis:"CURRENT_VINTAGE",dataState:ageCalendarDays>AAII_STALE_AFTER_DAYS?"STALE":"LIVE",
      latestSurveyDate:latest.surveyDate,ageCalendarDays,staleAfterCalendarDays:AAII_STALE_AFTER_DAYS,firstSeenAt:latest.firstSeenAt,
      retrievedAt:latest.retrievedAt,providerPublishedAt:latest.providerPublishedAt,freshnessBasis:"REPORTED_DATE_UTC_CALENDAR"}};
}
