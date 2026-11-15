import { qualifyCatalogReference, unavailableCatalogReference, type CatalogReference } from "@/lib/portfolioRegime/catalogReference";
import type { PoraAsset } from "@/lib/portfolioRegime/multiAssetContracts";

interface Client { query(sql: string, params?: unknown[]): Promise<{ rows: Record<string, unknown>[] }> }

/** Optional catalog reads stay inside the caller's read-only transaction. */
export async function readCatalogReferences(client: Client, ids: PoraAsset[], now = () => new Date().toISOString()): Promise<Map<PoraAsset, CatalogReference>> {
  await client.query("SAVEPOINT pora_catalog_reference");
  let series: Record<string, unknown>[], mappings: Record<string, unknown>[];
  try {
    series = (await client.query(`SELECT series_id AS "seriesId", title, units, frequency, category, active,
      downstream_use_case AS "downstreamUseCase", updated_at AS "updatedAt" FROM meta.fred_series
      WHERE series_id = ANY($1::text[]) ORDER BY series_id LIMIT $2`, [ids, ids.length + 1])).rows;
    mappings = (await client.query(`SELECT series_id AS "seriesId", manifest_name AS "manifestName", updated_at AS "updatedAt"
      FROM meta.fred_series_manifest_map WHERE series_id = ANY($1::text[]) ORDER BY series_id, manifest_name LIMIT $2`, [ids, ids.length + 1])).rows;
    await client.query("RELEASE SAVEPOINT pora_catalog_reference");
  } catch {
    await client.query("ROLLBACK TO SAVEPOINT pora_catalog_reference");
    await client.query("RELEASE SAVEPOINT pora_catalog_reference");
    return new Map(ids.map((id) => [id, unavailableCatalogReference("CATALOG_READ_FAILED")]));
  }
  if (series.length > ids.length || mappings.length > ids.length) return new Map(ids.map((id) => [id, unavailableCatalogReference("AMBIGUOUS_CATALOG_ROWS")]));
  const capturedAt = now();
  return new Map(ids.map((id) => [id, qualifyCatalogReference(id, series, mappings, capturedAt)]));
}
