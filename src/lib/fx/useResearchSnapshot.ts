import { useCallback, useEffect, useRef, useState } from "react";
import { FX_PAIRS, type FxResearchResponse } from "./contracts";

function decode(value: unknown): FxResearchResponse {
  const data = value as FxResearchResponse;
  if (!data || !Array.isArray(data.pairs) || data.pairs.length !== 4 || !Number.isFinite(Date.parse(data.assessedAt))) throw new Error();
  data.pairs.forEach((p, i) => {
    if (p.baseCurrency !== FX_PAIRS[i].baseCurrency || p.quoteCurrency !== FX_PAIRS[i].quoteCurrency ||
      !["ELIGIBLE", "MISSING", "DEGRADED", "BLOCKED"].includes(p.state) || !Array.isArray(p.reasons) || !Array.isArray(p.evidence)) throw new Error();
    if (p.state === "ELIGIBLE") {
      if (typeof p.referenceLevel !== "number" || !Number.isFinite(p.referenceLevel) || p.referenceLevel <= 0 ||
        p.allowedPurposes.length !== 1 || p.allowedPurposes[0] !== "RESEARCH") throw new Error();
    } else if (p.referenceLevel !== undefined || p.allowedPurposes.length !== 0) throw new Error();
    if (p.lastObserved && (typeof p.lastObserved.value !== "number" || !Number.isFinite(p.lastObserved.value) || p.lastObserved.value <= 0)) throw new Error();
  });
  if (data.snapshot && (data.snapshot.contractVersion !== "fx-reference-snapshot/1" || data.snapshot.knowledgeBasis !== "CURRENT_VINTAGE")) throw new Error();
  return data;
}
export function useResearchSnapshot() {
  const [data, setData] = useState<FxResearchResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const active = useRef<AbortController | null>(null);
  const refresh = useCallback(async () => {
    active.current?.abort();
    const controller = new AbortController(); active.current = controller;
    // Never leave a previously eligible reference displayed while rechecking it.
    setLoading(true); setData(null); setError(null);
    try {
      for (let attempt = 0; attempt < 2; attempt++) {
        const response = await fetch("/api/fx/research/snapshot", { signal: controller.signal, cache: "no-store" });
        const result = decode(await response.json());
        // A response may cross the deadline while in transit. Do not restore
        // its expired eligibility even for one render; recapture immediately.
        const expired = result.nextCheckAt && Date.parse(result.nextCheckAt) <= Date.now() && result.pairs.some(p => p.state === "ELIGIBLE");
        if (expired) { if (attempt === 0) continue; throw new Error(); }
        if (!controller.signal.aborted) setData(result);
        break;
      }
    } catch {
      if (!controller.signal.aborted) setError("Reference snapshot unavailable. Try refreshing.");
    } finally { if (!controller.signal.aborted) setLoading(false); }
  }, []);
  useEffect(() => {
    void refresh();
    return () => active.current?.abort();
  }, [refresh]);
  useEffect(() => {
    const onFocus = () => { if (document.visibilityState === "visible") void refresh(); };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => { window.removeEventListener("focus", onFocus); document.removeEventListener("visibilitychange", onFocus); };
  }, [refresh]);
  useEffect(() => {
    if (!data?.nextCheckAt) return;
    const ms = Date.parse(data.nextCheckAt) - Date.now();
    if (!Number.isFinite(ms)) return;
    const timer = setTimeout(() => { void refresh(); }, Math.max(0, Math.min(ms, 2_147_483_647)));
    return () => clearTimeout(timer);
  }, [data?.nextCheckAt, refresh]);
  return { data, loading, error, refresh };
}
