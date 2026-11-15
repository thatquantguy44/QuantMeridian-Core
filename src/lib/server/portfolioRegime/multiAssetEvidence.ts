import { benchmarkAsOfDate } from "@/lib/benchmarkAsOf";

import { PORA_ASSETS, type PoraAsset, type MultiAssetPreview } from "@/lib/portfolioRegime/multiAssetContracts";
export { PORA_ASSETS, type PoraAsset, type MultiAssetPreview } from "@/lib/portfolioRegime/multiAssetContracts";
type Numeric = unknown;
export interface MultiAssetEvidence {
  asOfDate: string; checkedAt: string; dates: string[];
  latest: { ticker: string; latestDate: string; futureCount: number }[];
  gold: { ticker: string; date: string; close: Numeric; dividend: Numeric; split: Numeric; index: Numeric }[];
  silver: { source: string; seriesId: string; date: string; value: Numeric; rawValue: Numeric; missing: Numeric; hash: string | null; runId: string | null; ingestedAt: string | null }[];
  receipts: { ticker: string; source: string; endpoint: string; runId: string; payload: string; ingestedAt: string }[];
}
export class PoraEvidenceError extends Error {}
const missing = (message: string): never => { throw new PoraEvidenceError(message); };
function validDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const n = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(n) && new Date(n).toISOString().slice(0, 10) === value;
}
function timestamp(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value) && Number.isFinite(Date.parse(value));
}
function numeric(value: unknown): number {
  if ((typeof value !== "number" && typeof value !== "string") || String(value).trim() === "" || !Number.isFinite(Number(value))) return missing("A retained source value is missing or invalid.");
  return Number(value);
}
function equal(a: unknown, b: unknown, message: string): void {
  const left = numeric(a), right = numeric(b);
  if (Math.abs(left - right) > 1e-9 * Math.max(1, Math.abs(right))) missing(message);
}

/** Validate each candidate against the same dated sessions and exact retained Tiingo receipts. */
export function verifyMultiAssetEvidence(data: MultiAssetEvidence, ids: PoraAsset[]): MultiAssetPreview {
  if (ids.length < 2 || ids.length > 4 || new Set(ids).size !== ids.length || ids.some((id) => !PORA_ASSETS.includes(id))) return missing("Choose two to four supported assets.");
  if (!timestamp(data.checkedAt) || benchmarkAsOfDate(new Date(data.checkedAt)) !== data.asOfDate || data.dates.length < 2 || data.dates.length > 253) return missing("The source check or session window is invalid.");
  const dates = new Set(data.dates);
  if (dates.size !== data.dates.length || data.dates.some((date, i) => !validDate(date) || date > data.asOfDate || (i > 0 && date <= data.dates[i - 1]))) return missing("The exchange-session dates are invalid or duplicated.");
  const end = data.dates.at(-1)!;
  const latest = new Map<string, MultiAssetEvidence["latest"][number]>();
  for (const item of data.latest) {
    if (!ids.includes(item.ticker as PoraAsset) || latest.has(item.ticker) || !validDate(item.latestDate) || item.latestDate < end || item.latestDate > data.asOfDate || !Number.isSafeInteger(item.futureCount) || item.futureCount < 0) return missing("Latest retained coverage is invalid.");
    latest.set(item.ticker, item);
  }
  if (latest.size !== ids.length) return missing("Latest retained coverage is unavailable for a selected asset.");
  const gold = new Map<string, MultiAssetEvidence["gold"][number]>();
  for (const row of data.gold) {
    const key = `${row.ticker}|${row.date}`;
    if (!ids.includes(row.ticker as PoraAsset) || !dates.has(row.date) || gold.has(key)) return missing("Gold contains duplicate or unexpected asset dates.");
    gold.set(key, row);
  }
  const source = new Map<string, MultiAssetEvidence["silver"][number]>();
  for (const row of data.silver) {
    const key = `${row.seriesId}|${row.date}`;
    const ticker = row.seriesId.split(":")[0];
    if (row.source !== "tiingo" || !ids.includes(ticker as PoraAsset) || !dates.has(row.date) || !["close", "divCash", "splitFactor"].some((field) => row.seriesId === `${ticker}:${field}`) || source.has(key)) return missing("Source data contains duplicate, unexpected or non-Tiingo records.");
    source.set(key, row);
  }
  const receiptRecords = new Map<string, Map<string, Record<string, unknown>>>();
  let payloadBytes = 0;
  for (const receipt of data.receipts) {
    const key = `${receipt.ticker}|${receipt.runId}`;
    if (!ids.includes(receipt.ticker as PoraAsset) || receipt.source !== "tiingo" || receipt.endpoint !== `tiingo/daily/${receipt.ticker.toLowerCase()}/prices` || !receipt.runId || receiptRecords.has(key) || typeof receipt.payload !== "string" || !timestamp(receipt.ingestedAt) || Date.parse(receipt.ingestedAt) > Date.parse(data.checkedAt)) return missing("A retained receipt is invalid or duplicated.");
    payloadBytes += receipt.payload.length;
    if (receipt.payload.length > 4_000_000 || payloadBytes > 16_000_000) return missing("Retained receipt evidence exceeds the supported limit.");
    let parsed: unknown;
    try { parsed = JSON.parse(receipt.payload); } catch { return missing("A retained provider receipt is malformed."); }
    if (!parsed || typeof parsed !== "object") return missing("A retained provider receipt is malformed.");
    const payload = parsed as Record<string, unknown>;
    if (payload.format !== "tiingo" || payload.ticker !== receipt.ticker || !Array.isArray(payload.data) || payload.data.length > 100_000) return missing("A retained provider receipt has the wrong identity.");
    const indexed = new Map<string, Record<string, unknown>>();
    for (const item of payload.data) {
      if (!item || typeof item !== "object") return missing("A retained provider receipt has an invalid record.");
      const record = item as Record<string, unknown>;
      const rawDate = typeof record.date === "string" ? record.date : "";
      const date = /^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z)?$/.test(rawDate) ? rawDate.slice(0, 10) : "";
      if (!validDate(date) || indexed.has(date)) return missing("A retained provider receipt has invalid or duplicate dates.");
      indexed.set(date, record);
    }
    receiptRecords.set(key, indexed);
  }
  const assets = ids.map((id) => {
    let previousClose: number | null = null, previousIndex: number | null = null, firstIndex = 0, lastIngestedAt = "";
    const returns: { date: string; value: number }[] = [];
    for (const date of data.dates) {
      const row = gold.get(`${id}|${date}`);
      if (!row) return missing(`${id}: a selected exchange session has no retained Gold observation.`);
      const close = numeric(row.close), dividend = numeric(row.dividend), split = numeric(row.split), index = numeric(row.index);
      if (close <= 0 || dividend < 0 || split <= 0 || index <= 0) return missing(`${id}: a retained price or corporate action is invalid.`);
      for (const [field, value] of [["close", close], ["divCash", dividend], ["splitFactor", split]] as const) {
        const found = source.get(`${id}:${field}|${date}`);
        if (!found || (found.missing !== 0 && found.missing !== "0") || !found.hash || !found.runId || !timestamp(found.ingestedAt) || Date.parse(found.ingestedAt) > Date.parse(data.checkedAt)) return missing(`${id}: source evidence is missing or invalid for ${date}.`);
        equal(found.value, value, `${id}: Gold and source values differ on ${date}.`);
        equal(found.rawValue, value, `${id}: source and raw values differ on ${date}.`);
        const original = receiptRecords.get(`${id}|${found.runId}`)?.get(date);
        if (!original) return missing(`${id}: the retained receipt does not contain ${date}.`);
        equal(original[field], value, `${id}: retained receipt and source values differ on ${date}.`);
        if (!lastIngestedAt || Date.parse(found.ingestedAt) > Date.parse(lastIngestedAt)) lastIngestedAt = found.ingestedAt;
      }
      if (previousClose !== null && previousIndex !== null) {
        const ratio = (close + dividend) / previousClose * split;
        equal(index / previousIndex, ratio, `${id}: derived total-return index does not reconcile on ${date}.`);
        if (!Number.isFinite(ratio - 1)) return missing(`${id}: a derived return is invalid.`);
        returns.push({ date, value: ratio - 1 });
      } else firstIndex = index;
      previousClose = close; previousIndex = index;
    }
    const totalChange = previousIndex! / firstIndex - 1;
    if (!Number.isFinite(totalChange)) return missing(`${id}: the sample change is invalid.`);
    return { id, latestDate: latest.get(id)!.latestDate, futureCount: latest.get(id)!.futureCount, lastIngestedAt, totalChange, returns };
  });
  return { source: "DB", asOfDate: data.asOfDate, checkedAt: data.checkedAt, firstDate: data.dates[0], lastDate: end, sessionCount: data.dates.length, returnCount: data.dates.length - 1, assets };
}
