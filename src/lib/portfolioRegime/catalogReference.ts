import type { PoraAsset } from "./multiAssetContracts";

export type CatalogReason = "CATALOG_RECORD_MISSING" | "CATALOG_READ_FAILED" | "INVALID_CATALOG_RECORD" | "AMBIGUOUS_CATALOG_ROWS" | "CATALOG_SOURCE_MISMATCH";
export interface CatalogReference {
  status: "REPORTED" | "UNAVAILABLE" | "CONFLICT";
  source: "ECOMEDALLION_META_CATALOG";
  seriesId: PoraAsset | null;
  title: string | null;
  unitLabel: string | null;
  category: "equity" | null;
  frequency: "d" | null;
  active: true | null;
  downstreamUseCase: "equity_total_return" | null;
  seriesUpdatedAt: string | null;
  manifestName: "equity_tiingo" | null;
  manifestUpdatedAt: string | null;
  stableId: null;
  tradingCurrency: null;
  reason: CatalogReason | null;
}
type Row = Record<string, unknown>;
const fields = ["status", "source", "seriesId", "title", "unitLabel", "category", "frequency", "active", "downstreamUseCase", "seriesUpdatedAt", "manifestName", "manifestUpdatedAt", "stableId", "tradingCurrency", "reason"];
const timestamp = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(v) && Number.isFinite(Date.parse(v));
const text = (v: unknown, limit: number) => v === null || (typeof v === "string" && v.length > 0 && v.length <= limit && v.trim() === v);
const invalid = (): never => { throw new Error("Snapshot catalog reference evidence is invalid."); };

export function unavailableCatalogReference(reason: CatalogReason): CatalogReference {
  return { status: reason === "AMBIGUOUS_CATALOG_ROWS" || reason === "CATALOG_SOURCE_MISMATCH" ? "CONFLICT" : "UNAVAILABLE", source: "ECOMEDALLION_META_CATALOG", seriesId: null, title: null, unitLabel: null, category: null, frequency: null, active: null, downstreamUseCase: null, seriesUpdatedAt: null, manifestName: null, manifestUpdatedAt: null, stableId: null, tradingCurrency: null, reason };
}

/** Catalogue association is a current configuration label, never a provider-verified identity or currency. */
export function qualifyCatalogReference(id: PoraAsset, seriesRows: readonly Row[], mappings: readonly Row[], capturedAt: string): CatalogReference {
  const candidates = seriesRows.filter((row) => row.seriesId === id), links = mappings.filter((row) => row.seriesId === id);
  if (candidates.length > 1 || links.length > 1) return unavailableCatalogReference("AMBIGUOUS_CATALOG_ROWS");
  if (!candidates.length || !links.length) return unavailableCatalogReference("CATALOG_RECORD_MISSING");
  const row = candidates[0], link = links[0];
  if (link.manifestName !== "equity_tiingo" || row.category !== "equity" || row.frequency !== "d" || row.downstreamUseCase !== "equity_total_return" || (row.active !== 1 && row.active !== "1" && row.active !== true)) return unavailableCatalogReference("CATALOG_SOURCE_MISMATCH");
  if (!timestamp(capturedAt) || !timestamp(row.updatedAt) || !timestamp(link.updatedAt) || Date.parse(row.updatedAt) > Date.parse(capturedAt) || Date.parse(link.updatedAt) > Date.parse(capturedAt) || !text(row.title, 256) || !text(row.units, 64)) return unavailableCatalogReference("INVALID_CATALOG_RECORD");
  return { status: "REPORTED", source: "ECOMEDALLION_META_CATALOG", seriesId: id, title: row.title as string | null, unitLabel: row.units as string | null, category: "equity", frequency: "d", active: true, downstreamUseCase: "equity_total_return", seriesUpdatedAt: row.updatedAt, manifestName: "equity_tiingo", manifestUpdatedAt: link.updatedAt, stableId: null, tradingCurrency: null, reason: null };
}

/** Imported metadata is only internally checked; an unkeyed snapshot hash cannot authenticate it. */
export function validateCatalogReference(value: unknown, id: PoraAsset, capturedAt: string): CatalogReference {
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).sort().join("|") !== fields.slice().sort().join("|")) return invalid();
  const ref = value as CatalogReference;
  if (ref.source !== "ECOMEDALLION_META_CATALOG" || ref.stableId !== null || ref.tradingCurrency !== null) return invalid();
  if (ref.status === "REPORTED") {
    if (ref.seriesId !== id || ref.category !== "equity" || ref.frequency !== "d" || ref.active !== true || ref.downstreamUseCase !== "equity_total_return" || ref.manifestName !== "equity_tiingo" || ref.reason !== null || !text(ref.title, 256) || !text(ref.unitLabel, 64) || !timestamp(ref.seriesUpdatedAt) || !timestamp(ref.manifestUpdatedAt) || !timestamp(capturedAt) || Date.parse(ref.seriesUpdatedAt) > Date.parse(capturedAt) || Date.parse(ref.manifestUpdatedAt) > Date.parse(capturedAt)) return invalid();
  } else {
    const allowed = ref.status === "UNAVAILABLE" ? ["CATALOG_RECORD_MISSING", "CATALOG_READ_FAILED", "INVALID_CATALOG_RECORD"] : ref.status === "CONFLICT" ? ["AMBIGUOUS_CATALOG_ROWS", "CATALOG_SOURCE_MISMATCH"] : [];
    if (!ref.reason || !allowed.includes(ref.reason) || [ref.seriesId, ref.title, ref.unitLabel, ref.category, ref.frequency, ref.active, ref.downstreamUseCase, ref.seriesUpdatedAt, ref.manifestName, ref.manifestUpdatedAt].some((item) => item !== null)) return invalid();
  }
  return ref;
}
