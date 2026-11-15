import { describe, expect, it } from "vitest";
import { qualifyCatalogReference, validateCatalogReference } from "./catalogReference";

const at = "2026-11-12T16:00:00.000Z";
const series = () => ({ seriesId: "SPY", title: "Fictional test fund", units: "USD", frequency: "d", category: "equity", active: "1", downstreamUseCase: "equity_total_return", updatedAt: "2026-11-11T03:54:32.951283+00:00" });
const mapping = () => ({ seriesId: "SPY", manifestName: "equity_tiingo", updatedAt: "2026-11-11T03:54:32.951283+00:00" });

describe("PORA catalog reference evidence", () => {
  it("binds the retained configured unit label and its timestamps without asserting currency or a stable ID", () => {
    const ref = qualifyCatalogReference("SPY", [series()], [mapping()], at);
    expect(ref).toMatchObject({ status: "REPORTED", source: "ECOMEDALLION_META_CATALOG", seriesId: "SPY", unitLabel: "USD", manifestName: "equity_tiingo", stableId: null, tradingCurrency: null });
    expect(ref.seriesUpdatedAt).toBe("2026-11-11T03:54:32.951283+00:00");
    expect(validateCatalogReference(ref, "SPY", at)).toEqual(ref);
  });
  it("distinguishes missing, conflicting and invalid catalog records without selecting a substitute", () => {
    expect(qualifyCatalogReference("SPY", [], [], at)).toMatchObject({ status: "UNAVAILABLE", reason: "CATALOG_RECORD_MISSING", unitLabel: null });
    expect(qualifyCatalogReference("SPY", [series(), series()], [mapping()], at)).toMatchObject({ status: "CONFLICT", reason: "AMBIGUOUS_CATALOG_ROWS", unitLabel: null });
    expect(qualifyCatalogReference("SPY", [series()], [{ ...mapping(), manifestName: "equity_stooq" }], at)).toMatchObject({ status: "CONFLICT", reason: "CATALOG_SOURCE_MISMATCH", unitLabel: null });
    expect(qualifyCatalogReference("SPY", [{ ...series(), updatedAt: "2026-11-13T00:00:00Z" }], [mapping()], at)).toMatchObject({ status: "UNAVAILABLE", reason: "INVALID_CATALOG_RECORD", unitLabel: null });
  });
  it("keeps a missing optional unit label explicit and rejects inconsistent imported metadata", () => {
    const ref = qualifyCatalogReference("SPY", [{ ...series(), units: null }], [mapping()], at);
    expect(ref).toMatchObject({ status: "REPORTED", unitLabel: null, tradingCurrency: null });
    expect(() => validateCatalogReference({ ...ref, tradingCurrency: "USD" }, "SPY", at)).toThrow(/catalog/i);
    expect(() => validateCatalogReference({ ...ref, seriesId: "AGG" }, "SPY", at)).toThrow(/catalog/i);
    expect(() => validateCatalogReference({ ...ref, manifestUpdatedAt: "2026-11-13T00:00:00Z" }, "SPY", at)).toThrow(/catalog/i);
  });
});
