import { useCallback, useEffect, useRef, useState } from "react";
import { FX_PAIRS, type FxReason } from "./contracts";
import { HISTORY_ID_PATTERN, HISTORY_INTERVALS, type FxHistoryResponse } from "./historyContracts";

function date(value: unknown) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
}
function reasons(value: unknown): value is FxReason[] {
  return Array.isArray(value) && value.every(v => v && typeof v.code === "string" && typeof v.message === "string");
}
function decode(value: unknown): FxHistoryResponse {
  const data = value as FxHistoryResponse;
  if (!data || !Array.isArray(data.pairs) || data.pairs.length !== 4 || !Number.isFinite(Date.parse(data.assessedAt))) throw new Error();
  if (data.error !== null && (!data.error || typeof data.error.code !== "string" || typeof data.error.message !== "string")) throw new Error();
  if (data.nextCheckAt !== null && !Number.isFinite(Date.parse(data.nextCheckAt))) throw new Error();
  if (data.history && (data.history.contractVersion !== "fx-reference-history/1" || data.history.knowledgeBasis !== "CURRENT_VINTAGE" ||
    data.history.dataClass !== "DESCRIPTIVE_HISTORY" || data.history.historyPolicyVersion !== "ecb-history90/1" ||
    data.history.methodVersion !== "ecb-simple-observed-changes/1" || !HISTORY_ID_PATTERN.test(data.history.historyId) || !Array.isArray(data.history.evidence))) throw new Error();
  if (data.retained && (!HISTORY_ID_PATTERN.test(data.retained.historyId) || !Number.isFinite(Date.parse(data.retained.cutoffAt)))) throw new Error();
  const evidence = data.history?.evidence ?? data.retained?.evidence ?? [];
  if (!Array.isArray(evidence) || evidence.length > 270 || evidence.some(e => !e || !/^[a-f0-9]{64}$/.test(e.evidenceId) ||
    e.sourceId !== "ECB" || typeof e.seriesId !== "string" || typeof e.sourceLevel !== "number" || !Number.isFinite(e.sourceLevel) || e.sourceLevel <= 0 ||
    typeof e.sourceUnit !== "string" || !date(e.observationDate) || e.receiptAt !== null || e.goldAvailableAt !== null ||
    typeof e.revisionId !== "string" || !Number.isFinite(Date.parse(e.goldReadStartedAt)) || !Number.isFinite(Date.parse(e.goldReadCompletedAt)))) throw new Error();
  const evidenceIds = new Set(evidence.map(e => e.evidenceId));
  const schedule = data.history?.schedule ?? data.retained?.schedule;
  if (schedule && (!Array.isArray(schedule.dates) || schedule.dates.length > 90 || !schedule.dates.every(date) || !reasons(schedule.reasons))) throw new Error();
  data.pairs.forEach((p, i) => {
    if (p.baseCurrency !== FX_PAIRS[i].baseCurrency || p.quoteCurrency !== FX_PAIRS[i].quoteCurrency ||
      !["ELIGIBLE", "DEGRADED", "BLOCKED", "MISSING"].includes(p.endpointState) || !reasons(p.endpointReasons) ||
      !["DIRECT", "INVERSE", "CROSS"].includes(p.derivation) || !Array.isArray(p.points) || p.points.length > 90 || !Array.isArray(p.changes) || p.changes.length !== 3) throw new Error();
    p.points.forEach((point, j) => {
      if (!date(point.observationDate) || j > 0 && point.observationDate <= p.points[j - 1].observationDate || !reasons(point.reasons) ||
        !Array.isArray(point.evidenceIds) || !point.evidenceIds.every(id => typeof id === "string" && evidenceIds.has(id))) throw new Error();
      if (point.state === "OBSERVED") {
        if (typeof point.displayLevel !== "number" || !Number.isFinite(point.displayLevel) || point.displayLevel <= 0) throw new Error();
      } else if (!["MISSING", "BLOCKED"].includes(point.state) || point.displayLevel !== null) throw new Error();
    });
    if (p.validObservations !== p.points.filter(point => point.state === "OBSERVED").length) throw new Error();
    p.changes.forEach((c, j) => {
      if (c.intervals !== HISTORY_INTERVALS[j] || !reasons(c.reasons) || c.observationsRequired !== c.intervals + 1 ||
        !Number.isInteger(c.observationsAvailable) || c.observationsAvailable < 0 || c.observationsAvailable > c.observationsRequired ||
        c.startDate !== null && !date(c.startDate) || c.endDate !== null && !date(c.endDate)) throw new Error();
      if (c.state === "AVAILABLE") {
        if (!data.history || data.error || !data.nextCheckAt || p.endpointState !== "ELIGIBLE" || typeof c.simplePercent !== "number" || !Number.isFinite(c.simplePercent) ||
          c.startDate === null || c.endDate !== data.history.observationDate || c.observationsAvailable !== c.observationsRequired) throw new Error();
      } else if (c.state !== "UNAVAILABLE" || c.simplePercent !== null) throw new Error();
    });
  });
  return data;
}

/** Mounted only while Pair history is visible; no cached metrics on tab re-entry. */
export function usePairHistory() {
  const [data, setData] = useState<FxHistoryResponse | null>(null), [loading, setLoading] = useState(true), [error, setError] = useState<string | null>(null);
  const active = useRef<AbortController | null>(null);
  const refresh = useCallback(async () => {
    active.current?.abort(); const controller = new AbortController(); active.current = controller;
    setData(null); setLoading(true); setError(null);
    try {
      for (let attempt = 0; attempt < 2; attempt++) {
        const response = await fetch("/api/fx/research/history", { signal: controller.signal, cache: "no-store" });
        const result = decode(await response.json());
        const expired = result.nextCheckAt && Date.parse(result.nextCheckAt) <= Date.now();
        if (expired && attempt === 0) continue;
        if (expired && result.pairs.some(p => p.changes.some(c => c.state === "AVAILABLE"))) throw new Error();
        if (!controller.signal.aborted) setData(expired ? { ...result, nextCheckAt: null } : result);
        break;
      }
    } catch { if (!controller.signal.aborted) setError("Pair history is unavailable. Try refreshing."); }
    finally { if (!controller.signal.aborted) setLoading(false); }
  }, []);
  useEffect(() => { void refresh(); return () => active.current?.abort(); }, [refresh]);
  useEffect(() => {
    const onFocus = () => { if (document.visibilityState === "visible") void refresh(); };
    window.addEventListener("focus", onFocus); document.addEventListener("visibilitychange", onFocus);
    return () => { window.removeEventListener("focus", onFocus); document.removeEventListener("visibilitychange", onFocus); };
  }, [refresh]);
  useEffect(() => {
    if (!data?.nextCheckAt) return;
    const ms = Date.parse(data.nextCheckAt) - Date.now();
    const timer = setTimeout(() => { void refresh(); }, Math.max(0, Math.min(ms, 2_147_483_647)));
    return () => clearTimeout(timer);
  }, [data?.nextCheckAt, refresh]);
  return { data, loading, error, refresh };
}
