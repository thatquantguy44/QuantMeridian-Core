import { useCallback, useEffect, useRef, useState } from "react";
import { FX_PAIRS, type FxReason } from "./contracts";
import { VOLATILITY_ID_PATTERN, VOLATILITY_METHOD, VOLATILITY_WINDOWS, type FxVolatilityResponse } from "./volatilityContracts";

const date = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && Number.isFinite(Date.parse(v)) && new Date(v).toISOString().slice(0,10) === v;
const clock = (v: unknown): v is string => typeof v === "string" && Number.isFinite(Date.parse(v));
const reasons = (v: unknown): v is FxReason[] => Array.isArray(v) && v.every(r => r && typeof r.code === "string" && typeof r.message === "string");
export function decodeVolatility(value: unknown): FxVolatilityResponse {
  const d = value as FxVolatilityResponse;
  if (!d || !Array.isArray(d.pairs) || d.pairs.length !== 4 || !clock(d.assessedAt) || d.nextCheckAt !== null && !clock(d.nextCheckAt) ||
    d.error !== null && (!d.error || !reasons([d.error]))) throw new Error("INVALID_VOLATILITY_RESPONSE");
  if (d.volatility !== null && (!d.volatility || d.volatility.contractVersion !== "fx-reference-volatility/1" ||
    !VOLATILITY_ID_PATTERN.test(d.volatility.volatilityId) || d.volatility.methodVersion !== VOLATILITY_METHOD ||
    d.volatility.policyVersion !== "ecb-volatility253/1" || d.volatility.annualizationFactor !== 252 ||
    d.volatility.estimator !== "SAMPLE_CENTERED_LOG_RETURNS" || d.volatility.knowledgeBasis !== "CURRENT_VINTAGE" ||
    d.volatility.exportDisposition !== "DENIED" || d.volatility.allowedPurposes?.join() !== "RESEARCH" ||
    !clock(d.volatility.cutoffAt) || !clock(d.volatility.goldReadStartedAt) || d.volatility.knownByAt !== d.volatility.cutoffAt ||
    d.volatility.receiptAt !== null || d.volatility.goldAvailableAt !== null || d.volatility.publishedAt !== null)) throw new Error("INVALID_VOLATILITY_RESPONSE");
  if (d.retained !== null && (!d.retained || !VOLATILITY_ID_PATTERN.test(d.retained.volatilityId) || !clock(d.retained.cutoffAt))) throw new Error("INVALID_VOLATILITY_RESPONSE");
  const capture = d.volatility ?? d.retained, schedule = capture?.schedule, evidence = capture?.evidence ?? [];
  if (capture && (!schedule || schedule.requestedObservations !== 253 || typeof schedule.calendarTruncated !== "boolean" || !reasons(schedule.reasons) ||
    !Array.isArray(schedule.dates) || schedule.dates.length > 253 || schedule.dates.some((v,i,a)=>!date(v) || i>0 && v<=a[i-1]))) throw new Error("INVALID_VOLATILITY_RESPONSE");
  if (!Array.isArray(evidence) || evidence.length > 759 || evidence.some(e => !e || !/^[a-f0-9]{64}$/.test(e.evidenceId) ||
    !date(e.observationDate) || typeof e.sourceLevel !== "number" || !Number.isFinite(e.sourceLevel) || e.sourceLevel <= 0 ||
    typeof e.seriesId !== "string" || typeof e.sourceUnit !== "string" || typeof e.revisionId !== "string" || !clock(e.upstreamRecordedAt))) throw new Error("INVALID_VOLATILITY_RESPONSE");
  const ids = new Set(evidence.map(e=>e.evidenceId));
  d.pairs.forEach((p,i) => {
    if (!p || p.baseCurrency !== FX_PAIRS[i].baseCurrency || p.quoteCurrency !== FX_PAIRS[i].quoteCurrency ||
      !["ELIGIBLE","MISSING","BLOCKED","DEGRADED"].includes(p.endpointState) || !reasons(p.endpointReasons) ||
      !["DIRECT","INVERSE","CROSS"].includes(p.derivation) || !Array.isArray(p.points) || p.points.length !== (schedule?.dates.length ?? 0) ||
      !Array.isArray(p.metrics) || p.metrics.length !== 5 || !Array.isArray(p.historicalMetrics) || p.historicalMetrics.length !== 5) throw new Error("INVALID_VOLATILITY_RESPONSE");
    p.points.forEach((point,j) => {
      if (point.observationDate !== schedule!.dates[j] || !reasons(point.reasons) || !Array.isArray(point.evidenceIds) || point.evidenceIds.some(id=>!ids.has(id)) ||
        (point.state === "OBSERVED" ? typeof point.displayLevel !== "number" || !Number.isFinite(point.displayLevel) || point.displayLevel <= 0
          : !["MISSING","BLOCKED"].includes(point.state) || point.displayLevel !== null)) throw new Error("INVALID_VOLATILITY_RESPONSE");
    });
    if (p.validObservations !== p.points.filter(point=>point.state === "OBSERVED").length) throw new Error("INVALID_VOLATILITY_RESPONSE");
    p.metrics.forEach((m,j) => {
      if (m.window !== VOLATILITY_WINDOWS[j] || m.levelsRequired !== m.window+1 || !reasons(m.reasons) ||
        !Number.isInteger(m.levelsAvailable) || m.levelsAvailable<0 || m.levelsAvailable>m.levelsRequired ||
        !Number.isInteger(m.returnsAvailable) || m.returnsAvailable<0 || m.returnsAvailable>m.window ||
        m.startDate !== null && !date(m.startDate) || m.endDate !== null && !date(m.endDate)) throw new Error("INVALID_VOLATILITY_RESPONSE");
      if (m.state === "AVAILABLE") {
        if (!d.volatility || d.error || !d.nextCheckAt || p.endpointState !== "ELIGIBLE" || typeof m.dailySigma !== "number" || !Number.isFinite(m.dailySigma) || m.dailySigma<0 ||
          m.annualizedSigma !== m.dailySigma*Math.sqrt(252) || m.levelsAvailable !== m.levelsRequired || m.returnsAvailable !== m.window ||
          m.endDate !== d.volatility.observationDate || !date(m.startDate) || !m.firstReturn || !m.lastReturn ||
          !date(m.firstReturn.startDate) || !date(m.firstReturn.endDate) || !date(m.lastReturn.startDate) || !date(m.lastReturn.endDate) ||
          typeof m.calendarDays !== "number" || !Number.isFinite(m.calendarDays) || m.calendarDays<=0) throw new Error("INVALID_VOLATILITY_RESPONSE");
      } else if (m.state !== "UNAVAILABLE" || m.dailySigma !== null || m.annualizedSigma !== null) throw new Error("INVALID_VOLATILITY_RESPONSE");
    });
    p.historicalMetrics.forEach((m,j) => {
      if (m.window !== VOLATILITY_WINDOWS[j] || m.levelsRequired !== m.window+1 || !reasons(m.reasons) ||
        !Number.isInteger(m.levelsAvailable) || m.levelsAvailable<0 || m.levelsAvailable>m.levelsRequired ||
        !Number.isInteger(m.returnsAvailable) || m.returnsAvailable<0 || m.returnsAvailable>m.window ||
        m.startDate !== null && !date(m.startDate) || m.endDate !== null && !date(m.endDate)) throw new Error("INVALID_VOLATILITY_RESPONSE");
      if (m.state === "AVAILABLE") {
        const lastPoint = p.points.at(-1)?.observationDate;
        if (typeof m.dailySigma !== "number" || !Number.isFinite(m.dailySigma) || m.dailySigma<0 ||
          m.annualizedSigma !== m.dailySigma*Math.sqrt(252) || m.levelsAvailable !== m.levelsRequired || m.returnsAvailable !== m.window ||
          !date(m.startDate) || m.endDate !== lastPoint || !m.firstReturn || !m.lastReturn ||
          !date(m.firstReturn.startDate) || !date(m.firstReturn.endDate) || !date(m.lastReturn.startDate) || !date(m.lastReturn.endDate) ||
          typeof m.calendarDays !== "number" || !Number.isFinite(m.calendarDays) || m.calendarDays<=0) throw new Error("INVALID_VOLATILITY_RESPONSE");
      } else if (m.state !== "UNAVAILABLE" || m.dailySigma !== null || m.annualizedSigma !== null) throw new Error("INVALID_VOLATILITY_RESPONSE");
    });
  });
  return d;
}

/** No metrics survive a refresh, expired in-flight response or tab re-entry. */
export function useVolatility() {
  const [data,setData] = useState<FxVolatilityResponse|null>(null), [loading,setLoading] = useState(true), [error,setError] = useState<string|null>(null);
  const active = useRef<AbortController|null>(null);
  const refresh = useCallback(async () => {
    active.current?.abort(); const controller = new AbortController(); active.current = controller;
    setData(null); setLoading(true); setError(null);
    try {
      for (let attempt=0; attempt<2; attempt++) {
        const response = await fetch("/api/fx/research/volatility", { signal: controller.signal, cache: "no-store" });
        const result = decodeVolatility(await response.json());
        const expired = result.nextCheckAt && Date.parse(result.nextCheckAt)<=Date.now();
        if (expired && attempt === 0) continue;
        if (expired && result.pairs.some(p=>p.metrics.some(m=>m.state === "AVAILABLE"))) throw new Error();
        if (!controller.signal.aborted) setData(expired ? {...result,nextCheckAt:null} : result);
        break;
      }
    } catch { if (!controller.signal.aborted) setError("Volatility is unavailable. Try refreshing."); }
    finally { if (!controller.signal.aborted) setLoading(false); }
  },[]);
  useEffect(()=>{ void refresh(); return ()=>active.current?.abort(); },[refresh]);
  useEffect(()=>{
    const focus = ()=>{ if(document.visibilityState === "visible") void refresh(); };
    window.addEventListener("focus",focus); document.addEventListener("visibilitychange",focus);
    return ()=>{ window.removeEventListener("focus",focus); document.removeEventListener("visibilitychange",focus); };
  },[refresh]);
  useEffect(()=>{
    if(!data?.nextCheckAt) return;
    const timer=setTimeout(()=>{void refresh();},Math.max(0,Math.min(Date.parse(data.nextCheckAt)-Date.now(),2147483647)));
    return ()=>clearTimeout(timer);
  },[data?.nextCheckAt,refresh]);
  return {data,loading,error,refresh};
}
