/**
 * Yield Curve Analytics PDF report builder.
 */
import { PdfReport } from "./pdfReport";
import { fmtSigned } from "./format";
import {
  CURVE_TENORS,
  computeCurveShape,
  computeCurveSummary,
} from "@/data/yieldCurveAnalytics";
import type { SeriesMap } from "@/data/benchmarkRates";

export interface YcurvPdfOptions {
  map: SeriesMap;
  source: string;
  tab: "shape" | "slopes" | "rv";
  timeRange: string;
  curveChartRef?: HTMLElement | null;
  slopeChartRef?: HTMLElement | null;
}

export async function generateYieldCurvePdf(opts: YcurvPdfOptions) {
  const { map, source, tab, timeRange, curveChartRef, slopeChartRef } = opts;

  const shape = computeCurveShape(map);
  const summary = computeCurveSummary(shape);

  const report = new PdfReport({
    title: "Yield Curve Analytics Report",
    code: "YCURV",
    subtitle: `Daily curve shape, slope history & relative value — ${timeRange} window`,
    source,
    asOf: new Date().toISOString().slice(0, 10),
  });

  report.kpiStrip([
    { label: "2s10s", value: summary.slope2s10s != null ? `${fmtSigned(summary.slope2s10s, 0)}bps` : "—", tone: summary.slope2s10s != null && summary.slope2s10s < 0 ? "down" : "up" },
    { label: "3m10y", value: summary.slope3m10y != null ? `${fmtSigned(summary.slope3m10y, 0)}bps` : "—", tone: summary.slope3m10y != null && summary.slope3m10y < 0 ? "down" : "up" },
    { label: "Curvature", value: summary.curvature != null ? `${fmtSigned(summary.curvature, 1)}bps` : "—" },
    { label: "Long End", value: summary.longEnd != null ? `${fmtSigned(summary.longEnd, 0)}bps` : "—" },
    { label: "Regime", value: summary.regime, tone: summary.regime.includes("Bull") ? "up" : summary.regime.includes("Bear") || summary.regime.includes("Inversion") ? "down" : "neutral" },
    { label: "Inversions", value: String(summary.inversions), tone: summary.inversions > 0 ? "down" : "up" },
  ]);

  if (tab === "shape") {
    report.sectionTitle("Treasury Yield Curve");
    if (curveChartRef) await report.captureElement(curveChartRef, { maxHeight: 220 });

    report.sectionTitle("Current Yields");
    report.table(
      ["Tenor", "Yield (%)", "Years"],
      shape.current.points.map((p) => [
        p.label,
        p.yield != null ? p.yield.toFixed(2) : "—",
        p.years.toFixed(2),
      ]),
      { columnStyles: { 1: { halign: "right" }, 2: { halign: "right" } } },
    );

    report.sectionTitle("Shape Metrics");
    report.metricRows([
      { label: "2s10s Slope", value: shape.slope2s10s.current != null ? `${fmtSigned(shape.slope2s10s.current, 1)}bps` : "—" },
      { label: "3m10Y Slope", value: shape.slope3m10y.current != null ? `${fmtSigned(shape.slope3m10y.current, 1)}bps` : "—" },
      { label: "Curvature", value: shape.curvature.current != null ? `${fmtSigned(shape.curvature.current, 1)}bps` : "—" },
      { label: "Long End", value: shape.longEnd.current != null ? `${fmtSigned(shape.longEnd.current, 1)}bps` : "—" },
      { label: "Regime", value: summary.regime },
    ]);
  }

  if (tab === "slopes") {
    report.sectionTitle("Slope History");
    if (slopeChartRef) await report.captureElement(slopeChartRef, { maxHeight: 220 });

    if (shape.inversions.length > 0) {
      report.sectionTitle("Inversion Episodes", { text: `${shape.inversions.length} segments` });
      report.table(
        ["Pair", "Start", "End", "Duration", "Max Depth (bps)", "Current (bps)"],
        shape.inversions.map((s) => [
          s.pairLabel,
          s.startDate,
          s.endDate ?? "ACTIVE",
          `${s.durationDays}d`,
          s.maxDepthBps.toFixed(1),
          s.currentBps != null ? s.currentBps.toFixed(1) : "—",
        ]),
        { columnStyles: { 3: { halign: "right" }, 4: { halign: "right" }, 5: { halign: "right" } } },
      );
    }
  }

  if (tab === "rv") {
    report.sectionTitle("Butterfly Trades");
    report.table(
      ["Butterfly", "Value (bps)", "Z-Score", "Percentile", "Signal"],
      shape.butterflies.map((b) => [
        b.label,
        b.valueBps != null ? fmtSigned(b.valueBps, 1) : "—",
        b.zScore != null ? fmtSigned(b.zScore, 2) : "—",
        b.percentile != null ? `${b.percentile}%` : "—",
        b.signal,
      ]),
      { columnStyles: { 1: { halign: "right" }, 2: { halign: "right" }, 3: { halign: "right" } } },
    );
  }

  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const tabLabel = tab === "shape" ? "Shape" : tab === "slopes" ? "Slopes" : "RV";
  report.save(`YCURV_${tabLabel}_${date}.pdf`);
}
