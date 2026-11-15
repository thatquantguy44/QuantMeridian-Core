import { useEffect, useState } from "react";
import type { AaiiReadResponse } from "@/lib/aaii/contracts";
import { NAAIM_SCHEMA_VERSION, type NaaimReadResponse } from "@/lib/naaim/contracts";
import type { SocialIntel } from "@/data/news";
import { SENT_MACRO_SERIES, type SentMacroResponse } from "@/lib/sentiment/macro";

export function useFeed<T>(url: string, parse: (body: unknown) => T | null, refresh: number) {
  const [state, setState] = useState<{ url: string; parse: typeof parse; refresh: number; data: T | null; loading: boolean; error: string | null }>(
    { url, parse, refresh, data: null, loading: true, error: null });
  useEffect(() => {
    const controller = new AbortController();
    const identity = { url, parse, refresh };
    setState({ ...identity, data: null, loading: true, error: null });
    void fetch(url, { cache: "no-store", signal: controller.signal }).then(async response => {
      const body = await response.json();
      if (!response.ok) throw new Error(typeof body?.error?.message === "string" ? body.error.message : "Source unavailable.");
      const data = parse(body);
      if (!data) throw new Error("No admitted source data.");
      if (!controller.signal.aborted) setState({ ...identity, data, loading: false, error: null });
    }).catch(error => {
      if (!controller.signal.aborted) setState({ ...identity, data: null, loading: false, error: error instanceof Error ? error.message : "Source unavailable." });
    });
    return () => controller.abort();
  }, [url, parse, refresh]);
  // Effects run after rendering. A hot update can preserve state from the old
  // endpoint/schema, so withhold it synchronously until this request validates.
  if (state.url !== url || state.parse !== parse || state.refresh !== refresh) return { data: null, loading: true, error: null };
  return { data: state.data, loading: state.loading, error: state.error };
}
function aaii(body: unknown): AaiiReadResponse | null {
  const b = body as AaiiReadResponse | null;
  const s = b?.selection;
  if (!s || b?.error !== null || s.schemaVersion !== "aaii-research/1" || s.provenance?.source !== "AAII" ||
      s.provenance.knowledgeBasis !== "CURRENT_VINTAGE" || !["LIVE", "STALE"].includes(s.provenance.dataState) ||
      !Array.isArray(s.observations) || !s.observations.length || s.observations.length > 104 ||
      !Number.isFinite(Date.parse(b.readStartedAt ?? "")) || !Number.isFinite(Date.parse(b.readCompletedAt ?? ""))) return null;
  if (!s.observations.every(o => /^\d{4}-\d{2}-\d{2}$/.test(o.surveyDate) &&
      [o.bullishPct, o.neutralPct, o.bearishPct].every(n => Number.isFinite(n) && n >= 0 && n <= 100) && Number.isFinite(o.bullBearSpreadPp))) return null;
  return b;
}
type SocialResponse = SocialIntel & { source: string };
function social(body: unknown): SocialResponse | null {
  const b = body as SocialResponse | null;
  if (!b || b.source !== "Reddit" || !Array.isArray(b.platforms) ||
      !b.platforms.length || !Number.isFinite(b.totalPosts) || b.totalPosts <= 0) return null;
  if (!b.platforms.every(p => p.name === "Reddit" && Number.isFinite(p.posts) && p.posts > 0 && Number.isFinite(p.sentiment) && Math.abs(p.sentiment) <= 1)) return null;
  for (const rows of [b.tickers, b.sectors, b.themes]) {
    if (!Array.isArray(rows) || !rows.every(r => typeof r.label === "string" && Number.isFinite(r.mentions) && r.mentions >= 0 &&
        Number.isFinite(r.velocity) && Number.isFinite(r.sentiment) && Math.abs(r.sentiment) <= 1)) return null;
  }
  return b;
}
function macro(body: unknown): SentMacroResponse | null {
  const b = body as SentMacroResponse | null;
  if (b?.schemaVersion !== "sent-macro/1" || b.error !== null || !Number.isFinite(Date.parse(b.assessedAt)) ||
      !Array.isArray(b.series) || b.series.length !== 7 || new Set(b.series.map(s => s.id)).size !== 7) return null;
  if (!b.series.every(s => SENT_MACRO_SERIES.some(m => m.id === s.id && m.units === s.units) && s.source === "FRED" &&
      ["AVAILABLE", "UNAVAILABLE"].includes(s.state) && Array.isArray(s.observations) && s.observations.length <= 252 &&
      s.observations.every(o => /^\d{4}-\d{2}-\d{2}$/.test(o.date) && (o.value === null || Number.isFinite(o.value))) &&
      (s.latest === null ? s.state === "UNAVAILABLE" : s.state === "AVAILABLE" && Number.isFinite(s.latest.value) && s.latest.date === s.latestReportedDate) &&
      (s.ageCalendarDays === null || Number.isInteger(s.ageCalendarDays) && s.ageCalendarDays >= 0) &&
      (s.ingestedAt === null || Number.isFinite(Date.parse(s.ingestedAt))))) return null;
  return b;
}
function naaim(body: unknown): NaaimReadResponse | null {
  const b = body as NaaimReadResponse | null, selection = b?.selection;
  if (!selection || b?.error !== null || selection.schemaVersion !== NAAIM_SCHEMA_VERSION ||
      selection.provenance?.source !== "NAAIM Exposure Index®" || selection.provenance.dataset !== "naaim-exposure-index-public-delayed" ||
      selection.provenance.delayedPublicDisplay !== true || selection.provenance.providerDelayMonths !== 3 ||
      selection.provenance.knowledgeBasis !== "CURRENT_VINTAGE" || !Array.isArray(selection.observations) ||
      !selection.observations.length || selection.observations.length > 500 || !Number.isFinite(Date.parse(b.readStartedAt ?? "")) ||
      !Number.isFinite(Date.parse(b.readCompletedAt ?? "")) || !/^\d{4}-\d{2}-\d{2}$/.test(selection.provenance.latestAsOfDate)) return null;
  if (!selection.observations.every(row => /^\d{4}-\d{2}-\d{2}$/.test(row.asOfDate) && Number.isFinite(row.exposure) &&
      Number.isFinite(Date.parse(row.firstSeenAt)) && /^naaim-capture:[a-f0-9]{64}$/.test(row.versionToken))) return null;
  return b;
}
/** No shared SIM cache, global SIM flags, generated defaults or source substitution. */
export function useSentFeeds(refresh: number) {
  return {
    aaii: useFeed("/api/sentiment/aaii", aaii, refresh),
    naaim: useFeed("/api/sentiment/naaim", naaim, refresh),
    social: useFeed("/api/sentiment/social", social, refresh),
    macro: useFeed("/api/sentiment/macro", macro, refresh),
  };
}
