import { BENCHMARK_SERIES } from "@/data/benchmarkRates";
import { benchmarkValue, type QualifiedBenchmarkSeries } from "@/lib/benchmarkQualified";
import { Tag } from "@/components/ui/Panel";
import { ProviderLatestCheck } from "./ProviderLatestCheck";

export function BenchmarkSourceBadge({ source, count, total }: { source: "LOADING" | "DB" | "ERR"; count: number; total: number }) {
  return <Tag tone={source === "ERR" ? "down" : source === "LOADING" ? "amber" : "blue"}>
    {source === "LOADING" ? "Checking source evidence" : source === "ERR" ? "Data unavailable" : `Qualified history · ${count}/${total}`}
  </Tag>;
}

export function QualifiedBenchmarkTable({ series, source, error, category = "ALL", onSelect }: {
  series: QualifiedBenchmarkSeries[]; source: "LOADING" | "DB" | "ERR"; error: string | null;
  category?: string; onSelect?: (id: string) => void;
}) {
  const byId = new Map(series.map((row) => [row.id, row]));
  const definitions = category === "ALL" ? BENCHMARK_SERIES : BENCHMARK_SERIES.filter((def) => def.category === category);
  return (
    <div className="space-y-2 p-2">
      <div className="text-2xs text-term-text-dim">Displayed levels are from qualified Gold history. Latest verified warehouse source dates through the America/New_York as-of date are shown separately. Publication timestamps are not supplied; ingestion timestamps describe the stored load, not the market close. Freshness uses approximate calendar-day thresholds by frequency. Board metadata is reported by the warehouse view and is not independent evidence. Board ingestion is warehouse capture, not provider publication. Original providers are listed on the linked FRED series pages.</div>
      <ProviderLatestCheck series={series} />
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] table-fixed border-collapse text-left text-2xs" aria-label="Qualified benchmark series">
          <thead className="text-term-text-mute"><tr className="border-b border-term-border">
            <th className="w-[20%] p-1">Series</th><th className="w-[14%] p-1">Gold level / date</th><th className="w-[20%] p-1">Latest verified source</th>
            <th className="w-[10%] p-1">Freshness</th><th className="w-[16%] p-1">Provider / cadence</th><th className="w-[20%] p-1">Gold coverage / status</th>
          </tr></thead>
          <tbody>{definitions.map((def) => {
            const row = byId.get(def.id);
            const available = row?.status === "available";
            const latest = available ? row.observations.at(-1)?.value : null;
            const reason = row?.reason ?? (source === "LOADING" ? "Checking source evidence." : error ?? "No qualified observations returned.");
            return <tr key={def.id} data-testid={`benchmark-series-${def.id}`} className="border-b border-term-border-soft align-top">
              <td className="break-words p-1"><button type="button" className="text-left font-semibold text-term-amber hover:underline" onClick={() => onSelect?.(def.id)} disabled={!onSelect}>{def.short}</button><div className="text-3xs text-term-text-mute">{def.id} · {def.label}</div></td>
              <td className="p-1 tnum"><div>{benchmarkValue(def, latest)}</div><div>{row?.observationDate ?? "—"}</div>{available && <div className="break-all text-3xs text-term-text-mute">Ingested {row.ingestedAt}</div>}</td>
              <td className="p-1 tnum">{row?.latestWarehouseSourceDate ? <><div>{benchmarkValue(def, row.latestWarehouseSourceValue)} · {row.latestWarehouseSourceDate}</div><div className="break-all text-3xs text-term-text-mute">Ingested {row.latestWarehouseSourceIngestedAt}</div><div className="break-words text-3xs text-term-text-mute">{row.latestWarehouseSourceEvidence.join(", ")}</div></> : row?.latestWarehouseSourceStatus === "unverified" ? "Unverified" : "Unavailable"}{row?.latestWarehouseSourceDate && row.latestRetainedDate && row.latestWarehouseSourceDate > row.latestRetainedDate && <div className="text-term-amber">Newer source record not yet in Gold.</div>}</td>
              <td className="p-1">{available ? <Tag tone={row.freshness === "stale" ? "amber" : "blue"}>{row.freshness}</Tag> : <Tag tone={source === "LOADING" ? "amber" : "down"}>{source === "LOADING" ? "Checking" : "Unavailable"}</Tag>}</td>
              <td className="break-words p-1"><a href={`https://fred.stlouisfed.org/series/${encodeURIComponent(def.id)}`} target="_blank" rel="noreferrer" className="text-term-blue hover:underline">{row?.provider ? `${row.provider} (distributor)` : "FRED reference"}</a><div className="text-3xs text-term-text-mute">{row?.frequency ?? "unknown"} · native: {row?.nativeUnit ?? "unknown"}</div>{available && <div className="text-3xs text-term-text-mute">Evidence: {row.evidenceMethods.join(", ")}</div>}</td>
              <td className="break-words p-1">{available ? <><div>Gold retained: {row.firstRetainedDate ?? "unknown"} → {row.latestRetainedDate ?? "unknown"}</div><div>Loaded: {row.observations[0]?.date} → {row.observationDate} ({row.observations.length} observations)</div></> : reason}<div className="text-3xs text-term-text-mute">Discontinued: {row?.discontinued ?? "unknown"}</div><div className="mt-1 text-3xs text-term-text-mute" data-testid={`benchmark-board-${def.id}`}><div>Board metadata: {row?.boardMetadata.status ?? "unavailable"}</div><div>Board as of: {row?.boardMetadata.asOfDate ?? "unknown"}</div><div>Board source: {row?.boardMetadata.source ?? "unknown"}</div><div>Revision start: {row?.boardMetadata.latestRevisionStart ?? "unknown"}</div><div>Warehouse capture: {row?.boardMetadata.latestIngestedAt ?? "unknown"}</div><div>History with unknown vintage: {row?.boardMetadata.unknownVintageCount ?? "unknown"}</div></div>{row?.boardStatus === "older" && <div className="text-term-amber">Benchmark board is older than retained history.</div>}{row?.boardStatus === "future" && <div className="text-term-amber">Benchmark board is future-dated and excluded.</div>}{(row?.futureGoldCount ?? 0) > 0 && <div className="text-term-amber">Future-dated Gold excluded: {row!.firstFutureGoldDate} ({row!.futureGoldCount}).</div>}{(row?.futureSourceCount ?? 0) > 0 && <div className="text-term-amber">Future-dated source records excluded: {row!.firstFutureSourceDate} ({row!.futureSourceCount}); not verified for current use.</div>}</td>
            </tr>;
          })}</tbody>
        </table>
      </div>
    </div>
  );
}
