/**
 * Benchmark Rates PDF report builder.
 *
 * Generates a formatted report based on the user's current selections:
 * active tab, category filter, time range, selected series, selected spread.
 */
import { PdfReport } from "./pdfReport";
import { fmtNum, fmtSigned, pnlClass } from "./format";
import {
  CATEGORIES,
  SPREAD_PAIRS,
  computeSummary,
  computeStatusBoard,
  computeAllSpreads,
  computeSpread,
  computeTrend,
  classifyRegime,
  defOf,
  type BenchmarkDef,
  type BenchmarkStatus,
  type SeriesMap,
  type SpreadResult,
  type TrendMetrics,
} from "@/data/benchmarkRates";

export interface BmrkPdfOptions {
  map: SeriesMap;
  source: string;
  tab: "status" | "trends" | "spreads";
  catFilter: string;
  timeRange: string;
  detailId: string;
  spreadId: string;
  chartRef?: HTMLElement | null;
  spreadChartRef?: HTMLElement | null;
}

function toneStr(n: number): "up" | "down" | "neutral" {
  if (n > 0) return "down";
  if (n < 0) return "up";
  return "neutral";
}

function fmtVal(def: BenchmarkDef, v: number | null): string {
  if (v == null) return "—";
  if (def.unit === "bps") return `${v.toFixed(0)}bps`;
  if (def.unit === "$/bbl") return `$${v.toFixed(def.decimals)}/bbl`;
  if (def.unit === "$/oz") return `$${v.toFixed(def.decimals)}/oz`;
  return `${v.toFixed(def.decimals)}%`;
}

function chgBpsStr(def: BenchmarkDef, chg: number | null): string {
  if (chg == null) return "—";
  if (def.unit === "%") return `${fmtSigned(chg * 100, 1)}bps`;
  return fmtSigned(chg, def.decimals);
}

export async function generateBenchmarkPdf(opts: BmrkPdfOptions) {
  const { map, source, tab, catFilter, timeRange, detailId, spreadId, chartRef, spreadChartRef } = opts;

  const summary = computeSummary(map);
  const regime = classifyRegime(map);
  const statusBoard = computeStatusBoard(map);
  const allSpreads = computeAllSpreads(map);

  const report = new PdfReport({
    title: "Benchmark Rates Report",
    code: "BMRK",
    subtitle: `Daily rates across asset classes — ${catFilter === "ALL" ? "All categories" : catFilter} · ${timeRange} window`,
    source,
    asOf: new Date().toISOString().slice(0, 10),
  });

  // ── KPI Summary ────────────────────────────────────────────────────────
  report.kpiStrip([
    { label: "SOFR", value: summary.sofr != null ? `${summary.sofr.toFixed(2)}%` : "—", sub: summary.sofrChgBps != null ? `${fmtSigned(summary.sofrChgBps, 1)}bps` : "", tone: "amber" },
    { label: "10Y Yield", value: summary.tenY != null ? `${summary.tenY.toFixed(2)}%` : "—", sub: summary.tenYChgBps != null ? `${fmtSigned(summary.tenYChgBps, 1)}bps` : "", tone: (summary.tenYChgBps ?? 0) <= 0 ? "up" : "down" },
    { label: "2s10s Slope", value: summary.twoTenSlope != null ? `${fmtSigned(Number(summary.twoTenSlope), 0)}bps` : "—", tone: (summary.twoTenSlope ?? 0) < 0 ? "down" : "up" },
    { label: "IG OAS", value: summary.igOas != null ? `${summary.igOas.toFixed(0)}bps` : "—" },
    { label: "HY OAS", value: summary.hyOas != null ? `${summary.hyOas.toFixed(0)}bps` : "—", tone: (summary.hyOas ?? 0) > 400 ? "down" : "neutral" },
    { label: "Regime", value: summary.regime, sub: `Score ${summary.regimeScore}`, tone: summary.regime === "Tightening" ? "down" : summary.regime === "Easing" || summary.regime === "Accommodative" ? "up" : "amber" },
  ]);

  // ── Rate Regime ────────────────────────────────────────────────────────
  report.sectionTitle("Rate Regime Classification", { text: `${regime.regime} — Score ${regime.score}/100` });
  report.metricRows(
    regime.drivers.map((d) => ({ label: d, value: "", tone: "neutral" as const }))
  );

  // ── STATUS BOARD ───────────────────────────────────────────────────────
  if (tab === "status" || tab === "trends") {
    const filtered = catFilter === "ALL" ? statusBoard : statusBoard.filter((s) => s.def.category === catFilter);

    report.sectionTitle(
      `Status Board — ${catFilter === "ALL" ? "All Categories" : catFilter}`,
      { text: `${filtered.length} rates` }
    );

    report.table(
      ["Rate", "Category", "Current", "Chg 1D", "Pctl", "52W Range", "Direction", "Status"],
      filtered.map((s) => {
        const chg = s.chg1dBps;
        return [
          s.def.short,
          s.def.category,
          fmtVal(s.def, s.current),
          chg != null ? (s.def.unit === "%" ? `${fmtSigned(chg, 1)}bps` : fmtSigned(chg, s.def.decimals)) : "—",
          s.percentile != null ? `${s.percentile}%` : "—",
          s.rangePosition != null ? `${s.rangePosition}% of range` : "—",
          s.direction,
          s.status,
        ];
      }),
      {
        columnStyles: {
          2: { halign: "right" },
          3: { halign: "right" },
          4: { halign: "right" },
          5: { halign: "right" },
        },
      }
    );

    // Category summary
    report.sectionTitle("Category Summary");
    report.table(
      ["Category", "Count", "Elevated", "Normal", "Depressed"],
      CATEGORIES.map((cat) => {
        const rows = statusBoard.filter((s) => s.def.category === cat);
        return [
          cat,
          String(rows.length),
          String(rows.filter((s) => s.status === "elevated").length),
          String(rows.filter((s) => s.status === "normal").length),
          String(rows.filter((s) => s.status === "depressed").length),
        ];
      }),
      { columnStyles: { 1: { halign: "right" }, 2: { halign: "right" }, 3: { halign: "right" }, 4: { halign: "right" } } }
    );
  }

  // ── TREND ANALYSIS ─────────────────────────────────────────────────────
  if (tab === "trends") {
    const detailDef = defOf(detailId);
    const trend = computeTrend(map[detailId] ?? []);

    if (detailDef) {
      report.sectionTitle(`Trend Analysis — ${detailDef.label}`, { text: detailDef.short });

      // Chart capture
      if (chartRef) {
        await report.captureElement(chartRef, { maxHeight: 220 });
      }

      report.metricRows([
        { label: "Current", value: fmtVal(detailDef, trend.current) },
        { label: "Change 1D", value: chgBpsStr(detailDef, trend.chg1d), tone: toneStr(trend.chg1d ?? 0) },
        { label: "Change 5D", value: chgBpsStr(detailDef, trend.chg5d), tone: toneStr(trend.chg5d ?? 0) },
        { label: "Change 20D", value: chgBpsStr(detailDef, trend.chg20d), tone: toneStr(trend.chg20d ?? 0) },
        { label: "Change 60D", value: chgBpsStr(detailDef, trend.chg60d), tone: toneStr(trend.chg60d ?? 0) },
        { label: "Change 120D", value: chgBpsStr(detailDef, trend.chg120d), tone: toneStr(trend.chg120d ?? 0) },
        { label: "5-Day MA", value: fmtVal(detailDef, trend.ma5) },
        { label: "20-Day MA", value: fmtVal(detailDef, trend.ma20) },
        { label: "60-Day MA", value: fmtVal(detailDef, trend.ma60) },
        { label: "Percentile (2Y)", value: trend.percentile != null ? `${trend.percentile}%` : "—" },
        { label: "52W Range", value: trend.min52w != null && trend.max52w != null ? `${fmtVal(detailDef, trend.min52w)} — ${fmtVal(detailDef, trend.max52w)}` : "—" },
        { label: "Range Position", value: trend.rangePosition != null ? `${trend.rangePosition}%` : "—" },
        { label: "Direction", value: trend.direction },
        { label: "Momentum", value: trend.momentum },
      ]);
    }

    // Top movers
    report.sectionTitle("Biggest 20D Moves");
    const movers = statusBoard
      .filter((s) => s.def.unit === "%" || s.def.unit === "bps")
      .map((s) => {
        const t = computeTrend(map[s.def.id] ?? []);
        const bpsMove = s.def.unit === "%" && t.chg20d != null ? t.chg20d * 100 : t.chg20d ?? 0;
        return { def: s.def, move: bpsMove };
      })
      .sort((a, b) => Math.abs(b.move) - Math.abs(a.move))
      .slice(0, 12);

    report.table(
      ["Rate", "Category", "Current", "20D Move (bps)", "Direction"],
      movers.map((m) => {
        const t = computeTrend(map[m.def.id] ?? []);
        return [
          m.def.short,
          m.def.category,
          fmtVal(m.def, t.current),
          `${m.move >= 0 ? "+" : ""}${m.move.toFixed(1)}`,
          t.direction,
        ];
      }),
      { columnStyles: { 2: { halign: "right" }, 3: { halign: "right" } } }
    );
  }

  // ── SPREAD ANALYSIS ────────────────────────────────────────────────────
  if (tab === "spreads") {
    const selected = computeSpread(map, spreadId);

    report.sectionTitle("Spread Comparison");
    report.table(
      ["Spread", "Description", "Current (bps)", "Δ1D", "Δ20D", "Percentile", "Z-Score", "Mean", "Min", "Max"],
      allSpreads.map((s) => [
        s.pair.label,
        s.pair.desc,
        s.current != null ? fmtSigned(s.current, 1) : "—",
        s.chg1d != null ? fmtSigned(s.chg1d, 1) : "—",
        s.chg20d != null ? fmtSigned(s.chg20d, 1) : "—",
        s.percentile != null ? `${s.percentile}%` : "—",
        s.zScore != null ? fmtSigned(s.zScore, 2) : "—",
        s.mean != null ? fmtSigned(s.mean, 1) : "—",
        s.min != null ? `${s.min.toFixed(1)}` : "—",
        s.max != null ? `${s.max.toFixed(1)}` : "—",
      ]),
      {
        columnStyles: {
          2: { halign: "right" },
          3: { halign: "right" },
          4: { halign: "right" },
          5: { halign: "right" },
          6: { halign: "right" },
          7: { halign: "right" },
          8: { halign: "right" },
          9: { halign: "right" },
        },
      }
    );

    if (selected) {
      report.sectionTitle(`Spread Detail — ${selected.pair.label}`, { text: selected.pair.desc });

      if (spreadChartRef) {
        await report.captureElement(spreadChartRef, { maxHeight: 220 });
      }

      report.metricRows([
        { label: "Current", value: selected.current != null ? `${fmtSigned(selected.current, 1)}bps` : "—" },
        { label: "Change 1D", value: selected.chg1d != null ? `${fmtSigned(selected.chg1d, 1)}bps` : "—", tone: toneStr(selected.chg1d ?? 0) },
        { label: "Change 20D", value: selected.chg20d != null ? `${fmtSigned(selected.chg20d, 1)}bps` : "—", tone: toneStr(selected.chg20d ?? 0) },
        { label: "Mean", value: selected.mean != null ? `${fmtSigned(selected.mean, 1)}bps` : "—" },
        { label: "Z-Score", value: selected.zScore != null ? fmtSigned(selected.zScore, 2) : "—", tone: selected.zScore != null && Math.abs(selected.zScore) > 1.5 ? "down" : "neutral" },
        { label: "Percentile", value: selected.percentile != null ? `${selected.percentile}%` : "—" },
        { label: "Min", value: selected.min != null ? `${selected.min.toFixed(1)}bps` : "—" },
        { label: "Max", value: selected.max != null ? `${selected.max.toFixed(1)}bps` : "—" },
      ]);
    }
  }

  // ── Save ───────────────────────────────────────────────────────────────
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const tabLabel = tab === "status" ? "Status" : tab === "trends" ? "Trends" : "Spreads";
  report.save(`BMRK_${tabLabel}_${date}.pdf`);
}
