import { useMemo } from "react";
import { Link } from "react-router-dom";
import { PageHeader, KpiStrip } from "@/components/ui/PageHeader";
import { Panel, Stat } from "@/components/ui/Panel";
import { Sparkline } from "@/components/charts/Sparkline";
import { BenchmarkSourceBadge, QualifiedBenchmarkTable } from "@/components/econ/QualifiedBenchmarkTable";
import { BenchmarkHistoryPanel } from "@/components/econ/BenchmarkHistoryPanel";
import { BENCHMARK_SERIES, computeSpread, defOf } from "@/data/benchmarkRates";
import { useQualifiedBenchmarks } from "@/lib/useQualifiedBenchmarks";
import { availableBenchmarkMap, benchmarkValue } from "@/lib/benchmarkQualified";

const KEY_RATES = ["SOFR", "DGS2", "DGS10", "BAMLC0A0CM", "BAMLH0A0HYM2", "MORTGAGE30US"];
const MODULES = [
  { code: "BMRK", label: "Benchmark Rates", href: "/economics/benchmark", note: "Observed rate history and spreads" },
  { code: "YCURV", label: "Yield Curve Analytics", href: "/economics/yield-curve", note: "Independent module; verify its source before use." },
  { code: "RVOL", label: "Rate Volatility", href: "/economics/rate-vol", note: "Independent module; verify its source before use." },
];

export default function RateAnalysisDashboard() {
  const { data, source, error, refresh } = useQualifiedBenchmarks();
  const series = data?.series ?? [];
  const byId = useMemo(() => new Map(series.map((row) => [row.id, row])), [data]);
  const map = useMemo(() => availableBenchmarkMap(data?.series ?? []), [data]);
  const slope = useMemo(() => computeSpread(map, "t2s10s"), [map]);
  const available = series.filter((row) => row.status === "available").length;
  const value = (id: string) => {
    const def = defOf(id)!; const item = byId.get(id);
    return item?.status === "available" ? benchmarkValue(def, item.observations.at(-1)?.value) : "—";
  };

  return <div className="flex min-h-0 flex-1 flex-col">
    <PageHeader code="BRA" title="Benchmark Rate Analysis" desc="Qualified retained rates and source coverage" showStreaming={false}
      right={<><button type="button" onClick={refresh} aria-label="Refresh benchmark data" className="rounded border border-term-border px-2 py-1 text-2xs text-term-text-dim">Refresh</button>
        <BenchmarkSourceBadge source={source} count={available} total={BENCHMARK_SERIES.length} /></>} />
    <KpiStrip>
      <Stat label="Market State" value="Unavailable" sub="Requires qualified funding inputs" />
      <Stat label="SOFR" value={value("SOFR")} sub={byId.get("SOFR")?.observationDate ?? "unavailable"} />
      <Stat label="2Y Treasury" value={value("DGS2")} sub={byId.get("DGS2")?.observationDate ?? "unavailable"} />
      <Stat label="10Y Treasury" value={value("DGS10")} sub={byId.get("DGS10")?.observationDate ?? "unavailable"} />
      <Stat label="2s10s Slope" value={slope?.current == null ? "—" : `${slope.current.toFixed(1)} bps`} sub={slope?.dates.at(-1) ?? "No matched date"} />
    </KpiStrip>
    {source === "ERR" && <div role="alert" className="m-2 border border-term-down/40 bg-term-down/10 p-2 text-xs text-term-text">{error ?? "Benchmark data unavailable."} No generated data was substituted.</div>}
    <div className="grid grid-cols-12 gap-2 p-2">
      <Panel title="Key Rate Snapshot" code="KRATE" className="col-span-12 xl:col-span-8" resizable={false}>
        <div className="grid grid-cols-2 gap-px bg-term-border md:grid-cols-3">
          {KEY_RATES.map((id) => {
            const def = defOf(id)!; const item = byId.get(id); const history = item?.status === "available" ? item.observations : [];
            return <div className="space-y-1 bg-term-panel p-3" key={id}>
              <div className="text-2xs text-term-text-mute">{def.label}</div>
              <div className="tnum text-lg font-semibold text-term-text">{value(id)}</div>
              <div className="text-3xs text-term-text-dim">{item?.observationDate ?? "Unavailable"}{item?.status === "available" ? ` · ${item.freshness}` : ""}</div>
              {history.length > 1 && <Sparkline data={history.slice(-60).map((row) => row.value)} width={100} height={20} fill />}
            </div>;
          })}
        </div>
      </Panel>
      <Panel title="Composite Market State" code="CMS" className="col-span-12 xl:col-span-4" resizable={false}>
        <div data-testid="benchmark-composite-unavailable" className="p-3 text-xs text-term-text-dim">Unavailable. A composite requires qualified funding and other dependent inputs; no default score is used.</div>
      </Panel>
      <BenchmarkHistoryPanel series={series} checkedAt={data?.checkedAt ?? null} />
      <Panel title="Rate Analysis Modules" code="MODULES" className="col-span-12" resizable={false}>
        <div className="grid gap-2 p-2 sm:grid-cols-2 xl:grid-cols-5">{MODULES.map((module) => <Link key={module.code} to={module.href} className="block border border-term-border bg-term-panel-2 p-2 hover:border-term-amber/50">
          <div className="text-xs font-semibold text-term-amber">{module.code} · {module.label}</div><div className="mt-1 text-2xs text-term-text-dim">{module.note}</div>
        </Link>)}</div>
      </Panel>
      <Panel title="Series Sources and Availability" code="SRC" className="col-span-12" resizable={false}>
        {data && <div className="px-2 pt-2 text-2xs text-term-text-mute">Source check completed {data.checkedAt}; as-of date {data.asOfDate} ({data.asOfTimeZone}). Individual observation and ingestion dates appear below.</div>}
        <QualifiedBenchmarkTable series={series} source={source} error={error} />
      </Panel>
    </div>
  </div>;
}
