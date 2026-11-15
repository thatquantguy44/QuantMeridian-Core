import { benchmarkEvidenceKey, type BenchmarkEvidenceRow } from "./benchmarkQualification";

export interface BenchmarkReceipt { series_id: string; run_id: string; endpoint: string; response_payload: string }
type ReceiptRow = BenchmarkEvidenceRow & { series_id: string };
const MAX_RECEIPT_BYTES = 25 * 1024 * 1024;

/** Compare source rows with the retained FRED observations, not just a matching run label. */
export function verifyBenchmarkReceipts(receipts: BenchmarkReceipt[], rows: ReceiptRow[]): Set<string> {
  const groups = new Map<string, ReceiptRow[]>();
  for (const row of rows) {
    if (!row.run_id) continue;
    const key = [row.series_id, row.run_id, row.date].join("\u0000");
    const group = groups.get(key) ?? []; group.push(row); groups.set(key, group);
  }
  const verified = new Set<string>();
  for (const receipt of receipts) {
    if (receipt.endpoint !== "series/observations" || typeof receipt.response_payload !== "string" || Buffer.byteLength(receipt.response_payload) > MAX_RECEIPT_BYTES) continue;
    try {
      const payload: unknown = JSON.parse(receipt.response_payload);
      if (!payload || typeof payload !== "object" || !("observations" in payload) || !Array.isArray(payload.observations)) continue;
      for (const raw of payload.observations as unknown[]) {
        if (!raw || typeof raw !== "object" || !("date" in raw) || !("value" in raw) || typeof raw.date !== "string" || raw.value == null) continue;
        const record = raw as { date: string; value: unknown; realtime_start?: unknown; realtime_end?: unknown };
        const group = groups.get([receipt.series_id, receipt.run_id, record.date].join("\u0000")) ?? [];
        for (const row of group) {
          if (typeof row.raw_value !== "string" || String(record.value) !== row.raw_value) continue;
          if (row.realtime_start && (record.realtime_start !== row.realtime_start || record.realtime_end !== row.realtime_end)) continue;
          verified.add(benchmarkEvidenceKey(row.series_id, receipt.run_id, row.date, row.realtime_start));
        }
      }
    } catch {
      // Malformed or unavailable provider receipts cannot qualify observations.
    }
  }
  return verified;
}
