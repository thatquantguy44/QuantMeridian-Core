
import { useCallback, useMemo, useState } from "react";
import clsx from "clsx";
import { FileDown } from "lucide-react";
import { PageHeader, KpiStrip } from "@/components/ui/PageHeader";
import { Panel, Stat, Tag } from "@/components/ui/Panel";
import { DataGrid, type Column } from "@/components/ui/DataGrid";
import { Sparkline } from "@/components/charts/Sparkline";
import { LineChart } from "@/components/charts/LineChart";
import { BarChart } from "@/components/charts/BarChart";
import { CorrelationMatrix } from "@/components/charts/Matrix";
import { TermToggleGroup } from "@/components/ui/TermToggleGroup";
import { TermSelect } from "@/components/ui/TermSelect";
import { ChartLink } from "@/components/charting/ChartLink";
import { useQualifiedBenchmarks } from "@/lib/useQualifiedBenchmarks";
import { availableBenchmarkMap } from "@/lib/benchmarkQualified";
import { BenchmarkSourceBadge, QualifiedBenchmarkTable } from "@/components/econ/QualifiedBenchmarkTable";
import { BenchmarkHistoryPanel } from "@/components/econ/BenchmarkHistoryPanel";
import { BenchmarkSpreadHistory } from "@/components/econ/BenchmarkSpreadHistory";
import { breakChartGaps, cadenceGapDays, matchedChangeCorrelation, priorMonths } from "@/lib/benchmarkHistory";
import { fmtSigned, pnlClass } from "@/lib/format";
import { generateQualifiedBenchmarkPdf } from "@/lib/benchmarkPdf";
import {
  BENCHMARK_SERIES,
  CATEGORIES,
  SPREAD_PAIRS,
  computeSummary,
  computeStatusBoard,
  computeAllSpreads,
  computeTrend,
  classifyRegime,
  defOf,
  type BenchmarkDef,
  type SpreadResult,
  type SeriesMap,
} from "@/data/benchmarkRates";

const DIRECTION_TONE: Record<string, "up" | "down" | "neutral"> = { rising: "down", falling: "up", flat: "neutral" };
const REGIME_TONE: Record<string, "up" | "amber" | "down" | "neutral"> = {
  Tightening: "down",
  Restrictive: "amber",
  Neutral: "neutral",
  Easing: "up",
  Accommodative: "up",
};

const TIME_RANGES = [
  { value: "1M", label: "1M", months: 1 },
  { value: "3M", label: "3M", months: 3 },
  { value: "6M", label: "6M", months: 6 },
  { value: "1Y", label: "1Y", months: 12 },
  { value: "2Y", label: "2Y", months: 24 },
];

const CORR_GROUPS = [
  { value: "overnight", label: "Overnight", ids: ["SOFR", "EFFR", "OBFR", "IORB", "BGCR", "TGCRRATE"] },
  { value: "curve", label: "Curve", ids: ["DGS1MO", "DGS3MO", "DGS1", "DGS2", "DGS5", "DGS10", "DGS30"] },
  { value: "credit", label: "Credit", ids: ["BAMLC0A1CAAA", "BAMLC0A0CM", "BAMLC0A4CBBB", "BAMLH0A0HYM2"] },
  { value: "cross", label: "Cross-Asset", ids: ["SOFR", "DGS2", "DGS10", "BAMLH0A0HYM2", "MORTGAGE30US", "DCOILWTICO", "GOLDPMGBD228NLBM"] },
];

function fmtVal(def: BenchmarkDef, v: number | null): string {
  if (v == null) return "—";
  if (def.unit === "bps") return `${v.toFixed(0)}`;
  if (def.unit === "index") return `${v.toFixed(def.decimals)}`;
  if (def.unit === "$/bbl" || def.unit === "$/oz") return `${v.toFixed(def.decimals)}`;
  return `${v.toFixed(def.decimals)}%`;
}

export default function BenchmarkRatesPage() {
  const { data, source, error, refresh } = useQualifiedBenchmarks();
  const series = data?.series ?? [];
  const map = useMemo<SeriesMap>(() => availableBenchmarkMap(data?.series ?? []), [data]);
  const byId = useMemo(() => new Map((data?.series ?? []).map((item) => [item.id, item])), [data]);
  const qualifiedCount = series.filter((item) => item.status === "available").length;

  // State
  const [catFilter, setCatFilter] = useState<string>("ALL");
  const [timeRange, setTimeRange] = useState("1Y");
  const [spreadId, setSpreadId] = useState(SPREAD_PAIRS[2].id); // 10Y-2Y default
  const [corrGroup, setCorrGroup] = useState("cross");
  const [detailId, setDetailId] = useState("DGS10");
  const [tab, setTab] = useState<"status" | "trends" | "spreads">("status");
  const [exporting, setExporting] = useState(false);
  const categoryAvailable = series.some((item) => item.status === "available" && (catFilter === "ALL" || item.category === catFilter));

  const handleExportPdf = useCallback(async () => {
    if (!data || !categoryAvailable) return;
    setExporting(true);
    try { await generateQualifiedBenchmarkPdf({ series: data.series, checkedAt: data.checkedAt, category: catFilter }); }
    finally { setExporting(false); }
  }, [data, categoryAvailable, catFilter]);

  // Derived data
  const summary = useMemo(() => computeSummary(map), [map]);
  const statusBoard = useMemo(() => computeStatusBoard(map), [map]);
  const allSpreads = useMemo(() => computeAllSpreads(map), [map]);
  const regime = useMemo(() => {
    const required = ["EFFR", "DGS2", "DGS10", "BAMLH0A0HYM2"];
    const dates = required.map((id) => map[id]?.at(-1)?.date);
    return required.every((id) => (map[id]?.length ?? 0) > 0) && (map.EFFR?.length ?? 0) >= 61 && dates.every((date) => date === dates[0])
      ? classifyRegime(map) : null;
  }, [map]);
  const detailTrend = useMemo(() => computeTrend(map[detailId] ?? []), [map, detailId]);
  const detailDef = defOf(detailId);

  const corrConfig = CORR_GROUPS.find((g) => g.value === corrGroup) ?? CORR_GROUPS[3];
  const corrResult = useMemo(() => {
    const availableIds = corrConfig.ids.filter((id) => (map[id]?.length ?? 0) > 0);
    const result = matchedChangeCorrelation(map, availableIds, 60);
    return result && result.sampleCount >= 5 ? result : null;
  }, [map, corrConfig.ids]);

  const rangeMonths = TIME_RANGES.find((r) => r.value === timeRange)?.months ?? 12;

  const filteredStatus = catFilter === "ALL" ? statusBoard : statusBoard.filter((s) => s.def.category === catFilter);

  // Chart series for detail panel
  const detailObs = map[detailId] ?? [];
  const detailCutoff = detailObs.length ? Date.parse(`${priorMonths(detailObs.at(-1)!.date, rangeMonths)}T00:00:00Z`) : 0;
  const detailSlice = detailObs.filter((row) => Date.parse(`${row.date}T00:00:00Z`) >= detailCutoff);
  const detailPlot = breakChartGaps(detailSlice, cadenceGapDays(byId.get(detailId)?.frequency ?? null));
  const detailChartData = detailPlot.map((o) => o.value);
  const detailChartDates = detailPlot.map((o) => o.date);

  // Spread comparison columns
  const spreadCols: Column<SpreadResult>[] = [
    {
      key: "label",
      header: "Spread",
      width: "120px",
      render: (s) => (
        <button className="text-left font-semibold text-term-amber hover:underline" onClick={() => setSpreadId(s.pair.id)}>
          {s.pair.label}
        </button>
      ),
      sortVal: (s) => s.pair.label,
    },
    {
      key: "desc",
      header: "Description",
      render: (s) => <span className="text-term-text-mute">{s.pair.desc}</span>,
      sortVal: (s) => s.pair.desc,
    },
    {
      key: "current",
      header: "Current",
      align: "right",
      width: "72px",
      render: (s) => <span className="tnum font-semibold text-term-text">{s.current != null ? `${fmtSigned(s.current, 1)}` : "—"}</span>,
      sortVal: allSpreads.every((s) => s.current != null) ? (s) => s.current! : undefined,
    },
    {
      key: "date",
      header: "Matched date",
      width: "95px",
      render: (s) => <span className="tnum text-term-text-dim">{s.dates.at(-1) ?? "—"}</span>,
      sortVal: (s) => s.dates.at(-1) ?? "",
    },
    {
      key: "chg1d",
      header: "Δ1 obs",
      align: "right",
      width: "60px",
      render: (s) => <span className={clsx("tnum", pnlClass(-(s.chg1d ?? 0)))}>{s.chg1d != null ? fmtSigned(s.chg1d, 1) : "—"}</span>,
      sortVal: allSpreads.every((s) => s.chg1d != null) ? (s) => s.chg1d! : undefined,
    },
    {
      key: "chg20d",
      header: "Δ20 obs",
      align: "right",
      width: "60px",
      render: (s) => <span className={clsx("tnum", pnlClass(-(s.chg20d ?? 0)))}>{s.chg20d != null ? fmtSigned(s.chg20d, 1) : "—"}</span>,
      sortVal: allSpreads.every((s) => s.chg20d != null) ? (s) => s.chg20d! : undefined,
    },
    {
      key: "pctl",
      header: "Pctl",
      align: "right",
      width: "52px",
      render: (s) => <span className="tnum text-term-text-dim">{s.percentile != null ? `${s.percentile}%` : "—"}</span>,
      sortVal: allSpreads.every((s) => s.percentile != null) ? (s) => s.percentile! : undefined,
    },
    {
      key: "z",
      header: "Z",
      align: "right",
      width: "52px",
      render: (s) => (
        <span className={clsx("tnum", s.zScore != null && Math.abs(s.zScore) > 1.5 ? "text-term-down font-semibold" : "text-term-text-dim")}>
          {s.zScore != null ? fmtSigned(s.zScore, 2) : "—"}
        </span>
      ),
      sortVal: allSpreads.every((s) => s.zScore != null) ? (s) => s.zScore! : undefined,
    },
    {
      key: "spark",
      header: "History",
      width: "80px",
      align: "right",
      render: (s) => (
        <span className="inline-flex justify-end">
          <Sparkline data={s.hist.slice(-60)} width={70} height={18} />
        </span>
      ),
    },
  ];

  return (
    <div className="flex min-h-full flex-col">
      <PageHeader
        code="BMRK"
        title="Benchmark Rates"
        desc="Qualified historical rates — levels, trends and comparisons"
        showStreaming={false}
        right={
          <span className="flex items-center gap-2">
            <button
              onClick={handleExportPdf}
              disabled={exporting || !categoryAvailable}
              aria-label="Export benchmark PDF"
              className="flex items-center gap-1 rounded border border-term-border bg-term-panel px-2 py-0.5 text-2xs text-term-text-dim hover:text-term-amber disabled:opacity-40"
            >
              <FileDown size={12} />
              {exporting ? "Exporting…" : "Snapshot PDF"}
            </button>
            <button type="button" aria-label="Refresh benchmark data" onClick={refresh} className="rounded border border-term-border px-2 py-0.5 text-2xs text-term-text-dim">Refresh</button>
            <BenchmarkSourceBadge source={source} count={qualifiedCount} total={BENCHMARK_SERIES.length} />
          </span>
        }
      />

      <KpiStrip>
        <Stat label="SOFR" value={summary.sofr != null ? `${summary.sofr.toFixed(2)}%` : "—"} sub={byId.get("SOFR")?.observationDate ?? "Unavailable"} tone="amber" />
        <Stat label="10Y Yield" value={summary.tenY != null ? `${summary.tenY.toFixed(2)}%` : "—"} sub={byId.get("DGS10")?.observationDate ?? "Unavailable"} tone={summary.tenYChgBps == null ? "neutral" : summary.tenYChgBps <= 0 ? "up" : "down"} />
        <Stat label="2s10s Slope" value={summary.twoTenSlope != null && map.DGS10?.at(-1)?.date === map.DGS2?.at(-1)?.date ? `${fmtSigned(Number(summary.twoTenSlope), 0)}bps` : "—"} sub={map.DGS10?.at(-1)?.date === map.DGS2?.at(-1)?.date ? map.DGS10?.at(-1)?.date ?? "Unavailable" : "Input dates differ"} tone={summary.twoTenSlope == null ? "neutral" : summary.twoTenSlope < 0 ? "down" : "up"} />
        <Stat label="IG OAS" value={summary.igOas != null ? `${summary.igOas.toFixed(0)}bps` : "—"} sub={byId.get("BAMLC0A0CM")?.observationDate ?? "Unavailable"} />
        <Stat label="HY OAS" value={summary.hyOas != null ? `${summary.hyOas.toFixed(0)}bps` : "—"} sub={byId.get("BAMLH0A0HYM2")?.observationDate ?? "Unavailable"} tone={summary.hyOas != null && summary.hyOas > 400 ? "down" : "neutral"} />
        <Stat label="30Y Mtg" value={summary.mtg30 != null ? `${summary.mtg30.toFixed(2)}%` : "—"} sub={byId.get("MORTGAGE30US")?.observationDate ?? "Unavailable"} />
        <Stat label="Regime" value={regime?.regime ?? "Unavailable"} sub={regime ? `Rule-based score ${regime.score}` : "Requires aligned qualified inputs"} tone={regime ? REGIME_TONE[regime.regime] : "neutral"} />
      </KpiStrip>

      {source === "ERR" && <div role="alert" className="m-2 border border-term-down/40 bg-term-down/10 p-2 text-xs text-term-text">{error ?? "Benchmark data unavailable."} No generated data was substituted.</div>}

      {/* View tabs */}
      <div className="flex items-center gap-3 border-b border-term-border bg-term-panel px-3 py-1.5">
        <TermToggleGroup value={tab} onChange={setTab} options={[{ value: "status", label: "Status Board" }, { value: "trends", label: "Trend Analysis" }, { value: "spreads", label: "Spread Analysis" }]} size="sm" />
        {tab !== "spreads" && <TermToggleGroup label="Range" value={timeRange} onChange={setTimeRange} options={TIME_RANGES.map((r) => ({ value: r.value, label: r.label }))} size="sm" />}
        {tab === "status" && (
          <TermToggleGroup label="Class" value={catFilter} onChange={setCatFilter} options={[{ value: "ALL", label: "All" }, ...CATEGORIES.map((c) => ({ value: c, label: c }))]} size="sm" />
        )}
      </div>

      <div className="grid grid-cols-12 gap-2 p-2">
        {/* ── STATUS BOARD TAB ─────────────────────────────── */}
        {tab === "status" && (
          <>
            <div className="col-span-12 xl:col-span-9">
              <Panel
                title="Benchmark Status Board"
                code="STAT"
                accent
                right={<span className="tnum text-3xs text-term-text-mute">{filteredStatus.length} rates · latest qualified history</span>}
              >
                {data && <div className="px-2 pt-2 text-2xs text-term-text-mute">Source check completed {data.checkedAt}; as-of date {data.asOfDate} ({data.asOfTimeZone}).</div>}
                <QualifiedBenchmarkTable series={series} source={source} error={error} category={catFilter} onSelect={setDetailId} />
              </Panel>
            </div>

            <div className="col-span-12 xl:col-span-3 flex flex-col gap-2">
              <Panel title="Rate Regime" code="RGME" right={<Tag tone={regime ? REGIME_TONE[regime.regime] : "neutral"}>{regime?.regime ?? "Unavailable"}</Tag>}>
                {regime ? <div className="p-3">
                  <div className="mb-2 text-3xs text-term-text-mute">Rule-based classification from qualified inputs.</div>
                  <div className="flex items-end justify-between">
                    <span className="tnum text-3xl font-bold text-term-text">{regime.score}</span>
                    <span className="text-2xs text-term-text-mute">/ 100</span>
                  </div>
                  <div className="mt-2 h-2 w-full overflow-hidden rounded-sm bg-term-panel-3">
                    <div
                      className={clsx("h-full rounded-sm", regime.score >= 65 ? "bg-term-down" : regime.score >= 45 ? "bg-term-amber" : "bg-term-up")}
                      style={{ width: `${regime.score}%` }}
                    />
                  </div>
                  <div className="mt-3 flex flex-col gap-1">
                    {regime.drivers.map((d, i) => (
                      <div key={i} className="text-3xs text-term-text-dim">• {d}</div>
                    ))}
                  </div>
                </div> : <div className="p-3 text-2xs text-term-text-dim">Requires aligned, qualified rate and credit observations with sufficient EFFR history.</div>}
              </Panel>

              <Panel title="Category Distribution" code="DIST">
                <div className="flex flex-col gap-2 p-2">
                  {CATEGORIES.map((cat) => {
                    const rows = statusBoard.filter((s) => s.def.category === cat && s.current != null && s.percentile != null);
                    const elevated = rows.filter((s) => s.status === "elevated").length;
                    const depressed = rows.filter((s) => s.status === "depressed").length;
                    return (
                      <button key={cat} onClick={() => { setCatFilter(cat); setTab("status"); }} className="flex flex-col gap-0.5 text-left hover:bg-term-panel-2 px-1 py-0.5 rounded">
                        <div className="flex items-center justify-between text-2xs">
                          <span className="font-semibold text-term-text">{cat}</span>
                          <span className="tnum text-term-text-dim">{rows.length}</span>
                        </div>
                        <div className="flex gap-1 text-3xs">
                          {elevated > 0 && <Tag tone="down">{elevated} elevated</Tag>}
                          {depressed > 0 && <Tag tone="up">{depressed} depressed</Tag>}
                          {rows.length === 0 ? <Tag tone="neutral">insufficient history</Tag> : elevated === 0 && depressed === 0 && <Tag tone="neutral">normal</Tag>}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </Panel>
            </div>
          </>
        )}

        {/* ── TREND ANALYSIS TAB ──────────────────────────── */}
        {tab === "trends" && (
          <>
            <BenchmarkHistoryPanel series={series} checkedAt={data?.checkedAt ?? null} />
            <div className="col-span-12 xl:col-span-8">
              <Panel
                title={`${detailDef?.label ?? detailId} — ${timeRange} History`}
                code="HIST"
                accent
                right={
                  <span className="flex items-center gap-2">
                    <TermSelect
                      value={detailId}
                      onChange={setDetailId}
                      options={BENCHMARK_SERIES.map((s) => ({ value: s.id, label: `${s.short} — ${s.label}` }))}
                      size="sm"
                    />
                    {detailDef?.hasFred && <ChartLink refs={[{ source: "econ", id: detailId }]} range="2Y" />}
                  </span>
                }
              >
                <div className="p-2">
                  <div className="pb-1 text-2xs text-term-text-dim">{detailObs.length ? `Observed through ${detailObs.at(-1)!.date} · ${byId.get(detailId)?.frequency ?? "unknown"} frequency` : byId.get(detailId)?.reason ?? "No qualified history available."}</div>
                  <LineChart
                    series={[{ name: detailDef?.short ?? detailId, data: detailChartData, color: "#FF8C00" }]}
                    labels={detailChartDates}
                    height={300}
                    yFmt={(v) => detailDef ? fmtVal(detailDef, v) : String(v)}
                  />
                </div>
              </Panel>
            </div>

            <div className="col-span-12 xl:col-span-4 flex flex-col gap-2">
              <Panel title="Trend Metrics" code="TRND">
                <div className="divide-y divide-term-border-soft">
                  {[
                    { label: "Current", value: detailTrend.current != null ? fmtVal(detailDef!, detailTrend.current) : "—" },
                    { label: "Δ 1 observation", value: detailTrend.chg1d != null ? fmtSigned(detailDef?.unit === "%" ? detailTrend.chg1d * 100 : detailTrend.chg1d, 1) + (detailDef?.unit === "%" ? "bps" : "") : "—", n: detailTrend.chg1d ?? 0 },
                    { label: "Δ 5 observations", value: detailTrend.chg5d != null ? fmtSigned(detailDef?.unit === "%" ? detailTrend.chg5d * 100 : detailTrend.chg5d, 1) + (detailDef?.unit === "%" ? "bps" : "") : "—", n: detailTrend.chg5d ?? 0 },
                    { label: "Δ 20 observations", value: detailTrend.chg20d != null ? fmtSigned(detailDef?.unit === "%" ? detailTrend.chg20d * 100 : detailTrend.chg20d, 1) + (detailDef?.unit === "%" ? "bps" : "") : "—", n: detailTrend.chg20d ?? 0 },
                    { label: "Δ 60 observations", value: detailTrend.chg60d != null ? fmtSigned(detailDef?.unit === "%" ? detailTrend.chg60d * 100 : detailTrend.chg60d, 1) + (detailDef?.unit === "%" ? "bps" : "") : "—", n: detailTrend.chg60d ?? 0 },
                    { label: "Δ 120 observations", value: detailTrend.chg120d != null ? fmtSigned(detailDef?.unit === "%" ? detailTrend.chg120d * 100 : detailTrend.chg120d, 1) + (detailDef?.unit === "%" ? "bps" : "") : "—", n: detailTrend.chg120d ?? 0 },
                  ].map((r) => (
                    <div key={r.label} className="flex items-center justify-between px-3 py-1.5 text-2xs">
                      <span className="text-term-text-mute">{r.label}</span>
                      <span className={clsx("tnum font-semibold", r.n != null ? pnlClass(detailDef?.unit === "bps" ? -r.n : -(r.n ?? 0)) : "")}>{r.value}</span>
                    </div>
                  ))}
                </div>
              </Panel>

              <Panel title="Moving Averages" code="MA">
                <div className="divide-y divide-term-border-soft">
                  {[
                    { label: "5-observation MA", value: detailTrend.ma5 },
                    { label: "20-observation MA", value: detailTrend.ma20 },
                    { label: "60-observation MA", value: detailTrend.ma60 },
                  ].map((r) => (
                    <div key={r.label} className="flex items-center justify-between px-3 py-1.5 text-2xs">
                      <span className="text-term-text-mute">{r.label}</span>
                      <span className="tnum font-semibold text-term-text">{r.value != null && detailDef ? fmtVal(detailDef, r.value) : "—"}</span>
                    </div>
                  ))}
                  <div className="flex items-center justify-between px-3 py-1.5 text-2xs">
                    <span className="text-term-text-mute">Percentile (retained window)</span>
                    <span className="tnum text-term-text-dim">{detailTrend.percentile != null ? `${detailTrend.percentile}%` : "—"}</span>
                  </div>
                  <div className="flex items-center justify-between px-3 py-1.5 text-2xs">
                    <span className="text-term-text-mute">Last 260 observations range</span>
                    <span className="tnum text-term-text-dim">
                      {detailTrend.min52w != null && detailTrend.max52w != null && detailDef
                        ? `${fmtVal(detailDef, detailTrend.min52w)} — ${fmtVal(detailDef, detailTrend.max52w)}`
                        : "—"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between px-3 py-1.5 text-2xs">
                    <span className="text-term-text-mute">Direction</span>
                    {detailObs.length > 20 ? <Tag tone={DIRECTION_TONE[detailTrend.direction] ?? "neutral"}>{detailTrend.direction}</Tag> : <span>Unavailable</span>}
                  </div>
                  <div className="flex items-center justify-between px-3 py-1.5 text-2xs">
                    <span className="text-term-text-mute">Momentum</span>
                    {detailObs.length >= 20 ? <Tag tone={detailTrend.momentum === "strong" ? "down" : detailTrend.momentum === "weak" ? "up" : "neutral"}>{detailTrend.momentum}</Tag> : <span>Unavailable</span>}
                  </div>
                </div>
              </Panel>
            </div>

            {/* Correlation matrix */}
            <div className="col-span-12 xl:col-span-6">
              <Panel
                title="Correlation of matched level changes"
                code="CORR"
                right={<TermToggleGroup value={corrGroup} onChange={setCorrGroup} options={CORR_GROUPS.map((g) => ({ value: g.value, label: g.label }))} size="sm" />}
              >
                <div className="p-2">
                  {corrResult ? <><div className="pb-1 text-2xs text-term-text-dim">{corrResult.sampleCount} changes · {corrResult.firstDate} to {corrResult.lastDate} · common dates, available series only; level changes are not annualized and intervals may vary.</div><CorrelationMatrix labels={corrResult.ids.map((id) => defOf(id)?.short ?? id)} values={corrResult.matrix} height={280} /></> : <div className="text-2xs text-term-text-dim">Unavailable: correlation requires at least two qualified series, five changes on common dates, and nonconstant changes.</div>}
                </div>
              </Panel>
            </div>

            {/* Top movers bar chart */}
            <div className="col-span-12 xl:col-span-6">
              <Panel title="Biggest 20-observation Moves (bps)" code="MOVR">
                <div className="p-2">
                  {!statusBoard.some((s) => (s.def.unit === "%" || s.def.unit === "bps") && computeTrend(map[s.def.id] ?? []).chg20d != null) && <div className="text-2xs text-term-text-dim">Unavailable: at least 21 qualified observations are required.</div>}
                  <BarChart
                    data={statusBoard
                      .filter((s) => (s.def.unit === "%" || s.def.unit === "bps") && computeTrend(map[s.def.id] ?? []).chg20d != null)
                      .map((s) => {
                        const trend = computeTrend(map[s.def.id] ?? []);
                        const move = s.def.unit === "%" ? trend.chg20d! * 100 : trend.chg20d!;
                        return { label: s.def.short, value: move, color: move >= 0 ? "#FF3B3B" : "#2ECC71" };
                      })
                      .sort((a, b) => Math.abs(b.value) - Math.abs(a.value))
                      .slice(0, 12)}
                    horizontal
                    height={280}
                    fmt={(n) => `${n >= 0 ? "+" : ""}${n.toFixed(1)}`}
                  />
                </div>
              </Panel>
            </div>
          </>
        )}

        {/* ── SPREAD ANALYSIS TAB ─────────────────────────── */}
        {tab === "spreads" && (
          <>
            <div className="col-span-12 xl:col-span-8">
              <BenchmarkSpreadHistory key={`${data?.checkedAt ?? "none"}:${spreadId}`} pair={SPREAD_PAIRS.find((pair) => pair.id === spreadId)!} series={series} checkedAt={data?.checkedAt ?? null} onSelect={setSpreadId} />
            </div>

            <div className="col-span-12 xl:col-span-4">
              <Panel title="Spread Comparison" code="SCMP" right={<span className="text-3xs text-term-text-mute">initial snapshot · bps · click to chart</span>}>
                <DataGrid
                  columns={spreadCols}
                  rows={allSpreads}
                  rowKey={(s) => s.pair.id}
                  maxHeight="400px"
                  zebra
                  initialSort={{ key: "z", dir: "desc" }}
                  onRowClick={(s) => setSpreadId(s.pair.id)}
                  selectedKey={spreadId}
                />
              </Panel>
            </div>
          </>
        )}
      </div>

      <div className="border-t border-term-border bg-term-panel px-3 py-1.5 text-3xs text-term-text-mute">
        <span className="text-term-amber">BMRK</span> — daily benchmark rates across overnight, Treasury, credit, swap, mortgage, commodity & international asset classes.
        {" "}FRED-distributed retained observations are individually reconciled to source evidence. Publication and provider-latest timestamps may be unknown; missing inputs are unavailable. No synthetic fallback is used.
      </div>

    </div>
  );
}
