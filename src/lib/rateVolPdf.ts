/**
 * Rate Volatility PDF report builder.
 */
import { PdfReport } from "./pdfReport";
import { fmtSigned } from "./format";
import type { RealizedVol, VolRegimeResult, CrossAssetVol, VolCone } from "@/data/rateVolatility";

export interface RvolPdfOptions {
  vols: RealizedVol[];
  regime: VolRegimeResult;
  crossAsset: CrossAssetVol[];
  source: string;
  tab: "dashboard" | "surface" | "regime";
  volChartRef?: HTMLElement | null;
  surfaceChartRef?: HTMLElement | null;
  coneChartRef?: HTMLElement | null;
}

export async function generateRateVolPdf(opts: RvolPdfOptions) {
  const { vols, regime, crossAsset, source, tab, volChartRef, surfaceChartRef, coneChartRef } = opts;

  const avg20d = vols.filter((v) => v.windows[20].annualized != null);
  const avgVol = avg20d.length > 0
    ? (avg20d.reduce((s, v) => s + v.windows[20].annualized!, 0) / avg20d.length).toFixed(1)
    : "—";

  const report = new PdfReport({
    title: "Rate Volatility Report",
    code: "RVOL",
    subtitle: `Realized vol surface, regime analysis & vol-of-vol`,
    source,
    asOf: new Date().toISOString().slice(0, 10),
  });

  report.kpiStrip([
    { label: "Vol Regime", value: regime.regime, tone: regime.regime === "Low Vol" ? "up" : regime.regime === "Vol Storm" ? "down" : regime.regime === "Elevated" ? "amber" : "neutral" },
    { label: "Avg 20D Vol", value: `${avgVol}bps` },
    { label: "Score", value: String(regime.score) },
    { label: "Elevated", value: String(vols.filter((v) => v.currentVsHistoric === "elevated").length) },
    { label: "Extreme", value: String(vols.filter((v) => v.currentVsHistoric === "extreme").length), tone: vols.some((v) => v.currentVsHistoric === "extreme") ? "down" : "up" },
    { label: "Transition", value: regime.transition },
  ]);

  if (tab === "dashboard") {
    report.sectionTitle("Cross-Asset Volatility");
    if (volChartRef) await report.captureElement(volChartRef, { maxHeight: 220 });

    report.table(
      ["Rate", "Category", "5D Vol", "20D Vol", "60D Vol", "Ratio", "Pctl", "Regime"],
      crossAsset.slice(0, 20).map((c) => [
        c.label,
        c.category,
        c.vol5d != null ? c.vol5d.toFixed(1) : "—",
        c.vol20d != null ? c.vol20d.toFixed(1) : "—",
        c.vol60d != null ? c.vol60d.toFixed(1) : "—",
        c.volRatio != null ? c.volRatio.toFixed(2) : "—",
        c.percentile != null ? `${c.percentile}%` : "—",
        c.regime.toUpperCase(),
      ]),
      { columnStyles: { 2: { halign: "right" }, 3: { halign: "right" }, 4: { halign: "right" }, 5: { halign: "right" }, 6: { halign: "right" } } },
    );
  }

  if (tab === "surface") {
    report.sectionTitle("Vol Surface & Cone");
    if (surfaceChartRef) await report.captureElement(surfaceChartRef, { maxHeight: 220 });
    if (coneChartRef) await report.captureElement(coneChartRef, { maxHeight: 220 });
  }

  if (tab === "regime") {
    report.sectionTitle("Vol Regime Analysis");
    report.metricRows([
      { label: "Current Regime", value: regime.regime },
      { label: "Score", value: `${regime.score}/100` },
      { label: "Transition", value: regime.transition },
    ]);

    if (regime.drivers.length > 0) {
      report.sectionTitle("Regime Drivers");
      report.metricRows(regime.drivers.map((d, i) => ({ label: `Driver ${i + 1}`, value: d })));
    }
  }

  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const tabLabel = tab === "dashboard" ? "Dashboard" : tab === "surface" ? "Surface" : "Regime";
  report.save(`RVOL_${tabLabel}_${date}.pdf`);
}
