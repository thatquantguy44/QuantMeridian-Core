import { Rng } from "@/lib/rng";

/**
 * US Treasury yield curve — current & historical snapshots, shape analytics,
 * and a full history of curve inversions with recession lead-times.
 *
 * Live mode maps each tenor to its FRED series (DGS1MO … DGS30); the simulation
 * layer below is anchored to a plausible mid-2026 normalizing curve.
 */

export interface CurvePoint {
  tenor: string;
  months: number;
  fredId: string;
  yield: number;
}

export interface CurveSnapshot {
  id: string;
  label: string;
  date: string;
  points: CurvePoint[];
  regime: string;
}

const TENORS: [string, number, string][] = [
  ["1M", 1, "DGS1MO"],
  ["3M", 3, "DGS3MO"],
  ["6M", 6, "DGS6MO"],
  ["1Y", 12, "DGS1"],
  ["2Y", 24, "DGS2"],
  ["3Y", 36, "DGS3"],
  ["5Y", 60, "DGS5"],
  ["7Y", 84, "DGS7"],
  ["10Y", 120, "DGS10"],
  ["20Y", 240, "DGS20"],
  ["30Y", 360, "DGS30"],
];

/** Curve presets: yields by tenor index for several historical regimes. */
const CURVE_PRESETS: { id: string; label: string; date: string; regime: string; yields: number[] }[] = [
  { id: "now", label: "Today", date: "2026-06-17", regime: "Normalizing / mild front inversion", yields: [4.3, 4.25, 4.15, 3.95, 3.74, 3.7, 3.8, 3.95, 4.11, 4.45, 4.35] },
  { id: "1w", label: "1W Ago", date: "2026-06-10", regime: "Normalizing", yields: [4.31, 4.26, 4.16, 3.96, 3.76, 3.71, 3.81, 3.96, 4.12, 4.46, 4.36] },
  { id: "1m", label: "1M Ago", date: "2026-05-17", regime: "Normalizing", yields: [4.33, 4.29, 4.19, 3.99, 3.79, 3.74, 3.83, 3.98, 4.14, 4.47, 4.37] },
  { id: "3m", label: "3M Ago", date: "2026-03-17", regime: "Early steepening", yields: [4.4, 4.36, 4.25, 4.05, 3.86, 3.8, 3.87, 4.0, 4.16, 4.49, 4.39] },
  { id: "6m", label: "6M Ago", date: "2025-12-17", regime: "Bull steepening (cuts begin)", yields: [4.55, 4.5, 4.38, 4.18, 3.98, 3.9, 3.93, 4.04, 4.18, 4.5, 4.4] },
  { id: "1y", label: "1Y Ago", date: "2025-06-17", regime: "Inverted front, flat belly", yields: [5.3, 5.32, 5.2, 4.9, 4.55, 4.4, 4.3, 4.3, 4.35, 4.6, 4.5] },
  { id: "2y", label: "2Y Ago (peak inversion)", date: "2024-06-17", regime: "Deeply inverted (2s10s ≈ -48bps)", yields: [5.4, 5.45, 5.4, 5.15, 4.72, 4.55, 4.35, 4.3, 4.24, 4.5, 4.38] },
  { id: "preHike", label: "Pre-Hiking (2021)", date: "2021-06-17", regime: "ZIRP — steep, near-zero front", yields: [0.04, 0.05, 0.06, 0.09, 0.25, 0.46, 0.89, 1.25, 1.5, 2.05, 2.15] },
  { id: "gfc", label: "GFC Trough (2009)", date: "2009-06-17", regime: "Crisis — ultra-steep, ZIRP front", yields: [0.17, 0.19, 0.31, 0.51, 1.21, 1.78, 2.79, 3.45, 3.79, 4.5, 4.55] },
];

export function getCurveSnapshots(): CurveSnapshot[] {
  return CURVE_PRESETS.map((p) => ({
    id: p.id,
    label: p.label,
    date: p.date,
    regime: p.regime,
    points: TENORS.map(([tenor, months, fredId], i) => ({ tenor, months, fredId, yield: p.yields[i] })),
  }));
}

export function getCurrentCurve(): CurveSnapshot {
  return getCurveSnapshots()[0];
}

/** Tenor definitions (label, months, FRED id) — used by the live history route. */
export const CURVE_TENORS = TENORS;

/** Day / month offsets (back from the latest data date) for the "recent"
 *  anchors. Presets without an entry (preHike, gfc) resolve at their absolute
 *  date. Day anchors (1W) take precedence over month anchors. */
const ANCHOR_DAYS: Record<string, number> = { "1w": 7 };
const ANCHOR_MONTHS: Record<string, number> = { now: 0, "1m": 1, "3m": 3, "6m": 6, "1y": 12, "2y": 24 };

export type CurveHistory = Record<string, { date: string; value: number }[]>; // fredId -> ascending daily

function shiftMonths(iso: string, months: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() - months);
  return d.toISOString().slice(0, 10);
}

function shiftDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

/** Latest observation on/before `asOf` in an ascending series. */
function valueAsOf(series: { date: string; value: number }[], asOf: string): { date: string; value: number } | null {
  for (let i = series.length - 1; i >= 0; i--) if (series[i].date <= asOf) return series[i];
  return null;
}

/**
 * Build real point-in-time curve snapshots from per-tenor FRED daily history.
 * Each preset's yields/date are overwritten with the actual values as-of the
 * anchor date (relative offsets for now…2Y, absolute dates for the deep
 * reference curves). Tenors with no data in the window keep their curated
 * value, so the curve is always complete. Falls back to the presets when the
 * history map is empty (no key / fetch failed).
 */
export function buildLiveSnapshots(history: CurveHistory): CurveSnapshot[] {
  const presets = getCurveSnapshots();
  const lastDates = Object.values(history)
    .map((s) => (s.length ? s[s.length - 1].date : ""))
    .filter(Boolean)
    .sort();
  if (!lastDates.length) return presets;
  const latest = lastDates[lastDates.length - 1];

  return presets.map((snap) => {
    const days = ANCHOR_DAYS[snap.id];
    const months = ANCHOR_MONTHS[snap.id];
    const anchor =
      days !== undefined ? shiftDays(latest, days) : months !== undefined ? shiftMonths(latest, months) : snap.date;
    let refDate = months === 0 ? latest : anchor;
    let matched = false;
    const points = snap.points.map((p) => {
      const series = history[p.fredId];
      const hit = series ? valueAsOf(series, anchor) : null;
      if (hit) {
        matched = true;
        if (p.tenor === "10Y") refDate = hit.date;
        return { ...p, yield: Number(hit.value.toFixed(2)) };
      }
      return p; // keep curated value for tenors with no data in the window
    });
    return { ...snap, date: matched ? refDate : snap.date, points };
  });
}

export interface CurveMetrics {
  s2s10: number; // 10Y - 2Y, bps
  s3m10: number; // 10Y - 3M, bps
  s5s30: number; // 30Y - 5Y, bps
  level: number; // avg yield
  slope: number; // 30Y - 1M, bps
  curvature: number; // 2*5Y - 2Y - 10Y (butterfly), bps
  inverted2s10: boolean;
  inverted3m10: boolean;
  shape: "Normal" | "Flat" | "Inverted" | "Humped" | "Steep";
}

export function getCurveMetrics(snap?: CurveSnapshot): CurveMetrics {
  const c = snap ?? getCurrentCurve();
  const y = (t: string) => c.points.find((p) => p.tenor === t)!.yield;
  const s2s10 = (y("10Y") - y("2Y")) * 100;
  const s3m10 = (y("10Y") - y("3M")) * 100;
  const s5s30 = (y("30Y") - y("5Y")) * 100;
  const level = c.points.reduce((a, p) => a + p.yield, 0) / c.points.length;
  const slope = (y("30Y") - y("1M")) * 100;
  const curvature = (2 * y("5Y") - y("2Y") - y("10Y")) * 100;
  let shape: CurveMetrics["shape"] = "Normal";
  if (s2s10 < -5) shape = "Inverted";
  else if (Math.abs(s2s10) <= 15) shape = "Flat";
  else if (slope > 250) shape = "Steep";
  if (curvature < -25) shape = "Humped";
  return {
    s2s10, s3m10, s5s30, level, slope, curvature,
    inverted2s10: s2s10 < 0,
    inverted3m10: s3m10 < 0,
    shape,
  };
}

/** Long history of the 2s10s spread (bps) for the inversion timeline. */
export function getSpreadHistory(years = 50): { date: string; s2s10: number; recession: boolean }[] {
  // Key turning points (year, approx 2s10s bps) — interpolated between.
  const knots: [number, number][] = [
    [1976, 60], [1978, -40], [1980, -180], [1982, 30], [1985, 90], [1988, -20], [1989, -40],
    [1990, 10], [1992, 180], [1994, 50], [1998, 30], [2000, -50], [2001, 40], [2003, 200],
    [2006, -15], [2007, 5], [2009, 270], [2011, 200], [2013, 230], [2015, 130], [2018, 25],
    [2019, -5], [2020, 50], [2021, 120], [2022, -55], [2023, -48], [2024, -10], [2025, 25], [2026.45, 37],
  ];
  const recessions: [number, number][] = [
    [1980, 1980.5], [1981.5, 1982.9], [1990.5, 1991.2], [2001.2, 2001.9], [2007.95, 2009.45], [2020.15, 2020.45],
  ];
  const out: { date: string; s2s10: number; recession: boolean }[] = [];
  const start = 2026.45 - years;
  const rng = new Rng("spread-hist");
  for (let t = start; t <= 2026.45; t += 0.25) {
    // linear interp between knots
    let v = knots[knots.length - 1][1];
    for (let k = 0; k < knots.length - 1; k++) {
      if (t >= knots[k][0] && t <= knots[k + 1][0]) {
        const f = (t - knots[k][0]) / (knots[k + 1][0] - knots[k][0]);
        v = knots[k][1] + f * (knots[k + 1][1] - knots[k][1]);
        break;
      }
    }
    v += rng.normal(0, 6);
    const recession = recessions.some(([a, b]) => t >= a && t <= b);
    const year = Math.floor(t);
    const q = Math.floor((t - year) * 4) + 1;
    out.push({ date: `${year}Q${q}`, s2s10: Number(v.toFixed(0)), recession });
  }
  return out;
}

export interface Inversion {
  id: string;
  invertedDate: string;
  unInvertedDate: string;
  durationMonths: number;
  maxDepthBps: number;
  recessionFollowed: boolean;
  recessionStart: string | null;
  leadTimeMonths: number | null;
  note: string;
}

/** Every meaningful 2s10s inversion since the mid-1970s with recession lead-time. */
export function getInversionHistory(): Inversion[] {
  return [
    { id: "1978", invertedDate: "Aug 1978", unInvertedDate: "May 1980", durationMonths: 21, maxDepthBps: -241, recessionFollowed: true, recessionStart: "Jan 1980", leadTimeMonths: 17, note: "Volcker-era; double-dip recession" },
    { id: "1980", invertedDate: "Sep 1980", unInvertedDate: "Oct 1981", durationMonths: 13, maxDepthBps: -170, recessionFollowed: true, recessionStart: "Jul 1981", leadTimeMonths: 10, note: "Second leg of double-dip" },
    { id: "1988", invertedDate: "Dec 1988", unInvertedDate: "Mar 1990", durationMonths: 15, maxDepthBps: -41, recessionFollowed: true, recessionStart: "Jul 1990", leadTimeMonths: 19, note: "Pre-Gulf War recession" },
    { id: "2000", invertedDate: "Feb 2000", unInvertedDate: "Dec 2000", durationMonths: 10, maxDepthBps: -51, recessionFollowed: true, recessionStart: "Mar 2001", leadTimeMonths: 13, note: "Dot-com bust" },
    { id: "2006", invertedDate: "Jun 2006", unInvertedDate: "May 2007", durationMonths: 11, maxDepthBps: -19, recessionFollowed: true, recessionStart: "Dec 2007", leadTimeMonths: 18, note: "Global Financial Crisis" },
    { id: "2019", invertedDate: "Aug 2019", unInvertedDate: "Oct 2019", durationMonths: 2, maxDepthBps: -5, recessionFollowed: true, recessionStart: "Feb 2020", leadTimeMonths: 6, note: "Brief; COVID shock followed" },
    { id: "2022", invertedDate: "Jul 2022", unInvertedDate: "Sep 2024", durationMonths: 26, maxDepthBps: -108, recessionFollowed: false, recessionStart: null, leadTimeMonths: null, note: "Longest inversion on record; soft landing (no NBER recession to date)" },
  ];
}

export function getInversionStats(spreadId = "10Y2Y") {
  return computeInversionStats(getInversionsForSpread(spreadId));
}

/** Aggregate stats over a set of inversions (shared by sim + live paths). */
export function computeInversionStats(all: Inversion[]) {
  const leads = all.filter((i) => i.leadTimeMonths !== null).map((i) => i.leadTimeMonths!) as number[];
  const depths = all.map((i) => i.maxDepthBps);
  return {
    total: all.length,
    recessionRate: (all.filter((i) => i.recessionFollowed).length / Math.max(1, all.length)) * 100,
    avgLeadMonths: leads.length ? leads.reduce((a, b) => a + b, 0) / leads.length : 0,
    minLeadMonths: leads.length ? Math.min(...leads) : 0,
    maxLeadMonths: leads.length ? Math.max(...leads) : 0,
    avgDepthBps: depths.length ? depths.reduce((a, b) => a + b, 0) / depths.length : 0,
    deepestBps: depths.length ? Math.min(...depths) : 0,
    longestMonths: all.length ? Math.max(...all.map((i) => i.durationMonths)) : 0,
  };
}

/* ─────────────── Customizable curve spread (for inversion analysis) ─────────────── */

export interface SpreadDef {
  id: string;
  label: string;
  longT: string;
  shortT: string;
  fredId?: string;
  desc: string;
}

/** Selectable curve spreads. 10Y-2Y is the default recession bellwether. */
export const SPREAD_DEFS: SpreadDef[] = [
  { id: "10Y2Y", label: "10Y − 2Y", longT: "10Y", shortT: "2Y", fredId: "T10Y2Y", desc: "Classic recession bellwether" },
  { id: "10Y3M", label: "10Y − 3M", longT: "10Y", shortT: "3M", fredId: "T10Y3M", desc: "Fed/NY-Fed preferred model" },
  { id: "30Y5Y", label: "30Y − 5Y", longT: "30Y", shortT: "5Y", desc: "Long-end steepness" },
  { id: "10Y1Y", label: "10Y − 1Y", longT: "10Y", shortT: "1Y", desc: "Intermediate slope" },
  { id: "5Y2Y", label: "5Y − 2Y", longT: "5Y", shortT: "2Y", desc: "Belly slope" },
  { id: "2Y3M", label: "2Y − 3M", longT: "2Y", shortT: "3M", desc: "Front-end / hike expectations" },
  { id: "30Y10Y", label: "30Y − 10Y", longT: "30Y", shortT: "10Y", desc: "Term-premium proxy" },
];

export function spreadDef(id: string): SpreadDef {
  return SPREAD_DEFS.find((s) => s.id === id) ?? SPREAD_DEFS[0];
}

/** Current value of a spread (bps) from the live/sim current curve. */
export function currentSpreadBps(spreadId: string, snap?: CurveSnapshot): number {
  const def = spreadDef(spreadId);
  const c = snap ?? getCurrentCurve();
  const y = (t: string) => c.points.find((p) => p.tenor === t)?.yield ?? 0;
  return (y(def.longT) - y(def.shortT)) * 100;
}

// Shared base path (2s10s, bps) + recession ranges (fractional years).
const S2S10_KNOTS: [number, number][] = [
  [1976, 60], [1978, -40], [1980, -180], [1982, 30], [1985, 90], [1988, -20], [1989, -40],
  [1990, 10], [1992, 180], [1994, 50], [1998, 30], [2000, -50], [2001, 40], [2003, 200],
  [2006, -15], [2007, 5], [2009, 270], [2011, 200], [2013, 230], [2015, 130], [2018, 25],
  [2019, -5], [2020, 50], [2021, 120], [2022, -55], [2023, -48], [2024, -10], [2025, 25], [2026.45, 37],
];
const RECESSIONS: [number, number][] = [
  [1980, 1980.5], [1981.5, 1982.9], [1990.5, 1991.2], [2001.2, 2001.9], [2007.95, 2009.45], [2020.15, 2020.45],
];
// Per-spread transform of the 2s10s base path: value = base*factor + offset.
const SPREAD_TX: Record<string, { factor: number; offset: number }> = {
  "10Y2Y": { factor: 1, offset: 0 },
  "10Y3M": { factor: 1.18, offset: -22 },
  "30Y5Y": { factor: 0.7, offset: 70 },
  "10Y1Y": { factor: 1.1, offset: -8 },
  "5Y2Y": { factor: 0.55, offset: 8 },
  "2Y3M": { factor: 0.85, offset: -14 },
  "30Y10Y": { factor: 0.45, offset: 42 },
};

function baseAt(t: number): number {
  let v = S2S10_KNOTS[S2S10_KNOTS.length - 1][1];
  for (let k = 0; k < S2S10_KNOTS.length - 1; k++) {
    if (t >= S2S10_KNOTS[k][0] && t <= S2S10_KNOTS[k + 1][0]) {
      const f = (t - S2S10_KNOTS[k][0]) / (S2S10_KNOTS[k + 1][0] - S2S10_KNOTS[k][0]);
      v = S2S10_KNOTS[k][1] + f * (S2S10_KNOTS[k + 1][1] - S2S10_KNOTS[k][1]);
      break;
    }
  }
  return v;
}

function fracToLabel(t: number): { label: string; monthLabel: string } {
  const year = Math.floor(t);
  const q = Math.floor((t - year) * 4) + 1;
  const m = Math.min(11, Math.floor((t - year) * 12));
  const mon = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][m];
  return { label: `${year}Q${q}`, monthLabel: `${mon} ${year}` };
}

/** Quarterly history of any spread (bps) with recession flags. */
export function getSpreadSeriesFor(spreadId: string, years = 50): { date: string; value: number; recession: boolean }[] {
  const tx = SPREAD_TX[spreadId] ?? SPREAD_TX["10Y2Y"];
  const rng = new Rng(`spread-${spreadId}`);
  const out: { date: string; value: number; recession: boolean }[] = [];
  for (let t = 2026.45 - years; t <= 2026.45; t += 0.25) {
    const value = Math.round(baseAt(t) * tx.factor + tx.offset + rng.normal(0, 6));
    out.push({ date: fracToLabel(t).label, value, recession: RECESSIONS.some(([a, b]) => t >= a && t <= b) });
  }
  return out;
}

/** Inversions of a chosen spread with recession lead-times. 10Y-2Y uses the curated record. */
export function getInversionsForSpread(spreadId: string): Inversion[] {
  if (spreadId === "10Y2Y") return getInversionHistory();
  const tx = SPREAD_TX[spreadId] ?? SPREAD_TX["10Y2Y"];
  const step = 1 / 12;
  const pts: { t: number; v: number }[] = [];
  const rng = new Rng(`inv-${spreadId}`);
  for (let t = 1976; t <= 2026.45; t += step) pts.push({ t, v: baseAt(t) * tx.factor + tx.offset + rng.normal(0, 3) });
  const out: Inversion[] = [];
  let i = 0;
  while (i < pts.length) {
    if (pts[i].v < 0) {
      const start = i;
      let depth = pts[i].v;
      while (i < pts.length && pts[i].v < 0) {
        depth = Math.min(depth, pts[i].v);
        i++;
      }
      const startT = pts[start].t;
      const endT = pts[Math.min(i, pts.length - 1)].t;
      const durMonths = Math.round((endT - startT) * 12);
      if (durMonths < 2) continue; // ignore single-month noise dips
      const rec = RECESSIONS.find(([a]) => a >= startT);
      const lead = rec ? Math.round((rec[0] - startT) * 12) : null;
      out.push({
        id: `${Math.floor(startT)}`,
        invertedDate: fracToLabel(startT).monthLabel,
        unInvertedDate: fracToLabel(endT).monthLabel,
        durationMonths: durMonths,
        maxDepthBps: Math.round(depth),
        recessionFollowed: lead !== null && lead >= 0 && lead <= 36,
        recessionStart: rec && lead !== null && lead <= 36 ? fracToLabel(rec[0]).monthLabel : null,
        leadTimeMonths: rec && lead !== null && lead >= 0 && lead <= 36 ? lead : null,
        note: spreadId === "10Y3M" ? "Fed-model signal" : `${spreadDef(spreadId).label} inversion`,
      });
    } else i++;
  }
  return out;
}

/* ─────────────── Live inversion detection (from real FRED daily series) ─────────────── */

const _MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const _TENOR_FRED: Record<string, string> = Object.fromEntries(TENORS.map(([t, , id]) => [t, id]));

/** FRED constant-maturity id for a tenor label (e.g. "10Y" -> "DGS10"). */
export function tenorToFredId(tenor: string): string | undefined {
  return _TENOR_FRED[tenor];
}

function _isoMonthLabel(iso: string): string {
  const [y, m] = iso.split("-");
  return `${_MONTHS[Number(m) - 1]} ${y}`;
}

function _daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);
}

function _inRecession(date: string, ranges: [string, string][]): boolean {
  return ranges.some(([a, b]) => date >= a && date <= b);
}

/** Build NBER recession ranges [startISO, endISO] from the monthly USREC 0/1 flag. */
export function recessionRangesFromUsrec(obs: { date: string; value: number }[]): [string, string][] {
  const s = [...obs].sort((a, b) => a.date.localeCompare(b.date));
  const ranges: [string, string][] = [];
  let start: string | null = null;
  let prev: string | null = null;
  for (const o of s) {
    const inRec = o.value >= 0.5;
    if (inRec && !start) start = o.date;
    if (!inRec && start) {
      ranges.push([start, prev ?? start]);
      start = null;
    }
    prev = o.date;
  }
  if (start) ranges.push([start, prev ?? start]);
  return ranges;
}

export interface InvDetectOpts {
  minDays?: number;    // ignore episodes shorter than this (noise floor)
  bridgeObs?: number;  // merge inverted runs split by ≤ this many positive prints
  recWindowMonths?: number; // inversion "leads" a recession if it starts within this window
}

/**
 * Detect every distinct inversion period from a real daily spread series (bps).
 * An episode is a run where the spread is < 0; brief positive blips (≤ bridgeObs
 * prints) are bridged so one inversion isn't split into many, and sub-minDays
 * flickers are dropped — yielding clean, unique inversion periods. Recession
 * lead-time is computed against the supplied NBER ranges.
 */
export function detectInversions(
  series: { date: string; bps: number }[],
  recessions: [string, string][],
  opts: InvDetectOpts = {}
): Inversion[] {
  const minDays = opts.minDays ?? 5;
  const bridgeObs = opts.bridgeObs ?? 10;
  const recWin = opts.recWindowMonths ?? 36;
  const pts = series
    .filter((p) => Number.isFinite(p.bps))
    .sort((a, b) => a.date.localeCompare(b.date));
  const out: Inversion[] = [];
  const lastDate = pts.length ? pts[pts.length - 1].date : "";
  let i = 0;
  while (i < pts.length) {
    if (pts[i].bps >= 0) {
      i++;
      continue;
    }
    const startIdx = i;
    let depth = pts[i].bps;
    let lastNeg = i;
    let j = i + 1;
    while (j < pts.length) {
      if (pts[j].bps < 0) {
        depth = Math.min(depth, pts[j].bps);
        lastNeg = j;
        j++;
      } else {
        let k = j;
        while (k < pts.length && pts[k].bps >= 0) k++;
        if (k < pts.length && k - j <= bridgeObs) j = k; // bridge a brief un-inversion
        else break;
      }
    }
    const startDate = pts[startIdx].date;
    const endDate = pts[lastNeg].date;
    i = lastNeg + 1;
    const durDays = _daysBetween(startDate, endDate);
    if (durDays < minDays) continue;
    const rec = recessions.find(([rs]) => rs >= startDate);
    const lead = rec ? Math.round(_daysBetween(startDate, rec[0]) / 30.44) : null;
    const followed = lead !== null && lead >= 0 && lead <= recWin;
    const ongoing = endDate === lastDate;
    out.push({
      id: startDate.slice(0, 7),
      invertedDate: _isoMonthLabel(startDate),
      unInvertedDate: ongoing ? "ongoing" : _isoMonthLabel(endDate),
      durationMonths: Math.max(1, Math.round(durDays / 30.44)),
      maxDepthBps: Math.round(depth),
      recessionFollowed: followed,
      recessionStart: followed && rec ? _isoMonthLabel(rec[0]) : null,
      leadTimeMonths: followed ? lead : null,
      note: ongoing ? "ongoing inversion" : followed ? "recession followed" : "no recession within 36m",
    });
  }
  return out;
}

/** Monthly downsample of a daily spread series + recession flag, for the timeline chart. */
export function monthlySpreadTimeline(
  series: { date: string; bps: number }[],
  recessions: [string, string][]
): { date: string; value: number; recession: boolean }[] {
  const byMonth = new Map<string, { date: string; bps: number }>();
  for (const p of [...series].sort((a, b) => a.date.localeCompare(b.date))) {
    byMonth.set(p.date.slice(0, 7), p); // keep last obs of each month
  }
  return [...byMonth.values()].map((p) => ({
    date: p.date.slice(0, 7),
    value: Math.round(p.bps),
    recession: _inRecession(p.date, recessions),
  }));
}
