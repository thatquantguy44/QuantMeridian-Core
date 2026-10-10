/**
 * Funding Cost Monitor PDF report builder.
 */
import { PdfReport } from "./pdfReport";
import { fmtSigned } from "./format";
import type { TierCost, DeskFundingProfile, TermFundingLadder, TierSpreadResult, FundingRegime } from "@/data/fundingCost";

export interface FcostPdfOptions {
  costs: TierCost[];
  desks: DeskFundingProfile[];
  ladder: TermFundingLadder[];
  spreads: TierSpreadResult[];
  regime: FundingRegime;
  regimeScore: number;
  source: string;
  tab: "dashboard" | "desk" | "spreads";
  tierChartRef?: HTMLElement | null;
  deskChartRef?: HTMLElement | null;
  spreadChartRef?: HTMLElement | null;
}

export async function generateFundingCostPdf(opts: FcostPdfOptions) {
  const { costs, desks, ladder, spreads, regime, regimeScore, source, tab, tierChartRef, deskChartRef, spreadChartRef } = opts;

  const report = new PdfReport({
    title: "Funding Cost Monitor Report",
    code: "FCOST",
    subtitle: `Blended borrowing costs by tier & desk attribution`,
    source,
    asOf: new Date().toISOString().slice(0, 10),
  });

  const sovrCost = costs.find((c) => c.tier.id === "Sovereign");
  const aaCost = costs.find((c) => c.tier.id === "AA");
  const bbbCost = costs.find((c) => c.tier.id === "BBB");
  const hyCost = costs.find((c) => c.tier.id === "HY");

  report.kpiStrip([
    { label: "Secured", value: sovrCost?.allInRate != null ? `${sovrCost.allInRate.toFixed(2)}%` : "—" },
    { label: "AA All-In", value: aaCost?.allInRate != null ? `${aaCost.allInRate.toFixed(2)}%` : "—" },
    { label: "BBB All-In", value: bbbCost?.allInRate != null ? `${bbbCost.allInRate.toFixed(2)}%` : "—" },
    { label: "HY All-In", value: hyCost?.allInRate != null ? `${hyCost.allInRate.toFixed(2)}%` : "—" },
    { label: "Regime", value: regime, tone: regime === "Stress" ? "down" : regime === "Wide" ? "amber" : regime === "Tight" ? "up" : "neutral" },
    { label: "Score", value: `${regimeScore}/100` },
  ]);

  if (tab === "dashboard") {
    report.sectionTitle("Tier Cost Comparison");
    if (tierChartRef) await report.captureElement(tierChartRef, { maxHeight: 220 });

    report.table(
      ["Tier", "Base (%)", "Spread (bps)", "All-In (%)", "Chg 1D", "Chg 20D", "Pctl", "Z-Score"],
      costs.map((c) => [
        c.tier.label,
        c.baseRate != null ? c.baseRate.toFixed(2) : "—",
        c.spreadBps != null ? c.spreadBps.toFixed(0) : "—",
        c.allInRate != null ? c.allInRate.toFixed(2) : "—",
        c.chg1d != null ? fmtSigned(c.chg1d, 1) : "—",
        c.chg20d != null ? fmtSigned(c.chg20d, 1) : "—",
        c.percentile != null ? `${c.percentile}%` : "—",
        c.zScore != null ? c.zScore.toFixed(2) : "—",
      ]),
      { columnStyles: { 1: { halign: "right" }, 2: { halign: "right" }, 3: { halign: "right" }, 4: { halign: "right" }, 5: { halign: "right" }, 6: { halign: "right" }, 7: { halign: "right" } } },
    );

    report.sectionTitle("Term Funding Ladder");
    report.table(
      ["Tenor", "Secured (%)", "AA (%)", "BBB (%)", "HY (%)"],
      ladder.map((l) => [
        l.tenor,
        l.secured != null ? l.secured.toFixed(2) : "—",
        l.aa != null ? l.aa.toFixed(2) : "—",
        l.bbb != null ? l.bbb.toFixed(2) : "—",
        l.hy != null ? l.hy.toFixed(2) : "—",
      ]),
      { columnStyles: { 1: { halign: "right" }, 2: { halign: "right" }, 3: { halign: "right" }, 4: { halign: "right" } } },
    );
  }

  if (tab === "desk") {
    report.sectionTitle("Desk Funding Attribution");
    if (deskChartRef) await report.captureElement(deskChartRef, { maxHeight: 220 });

    report.table(
      ["Desk", "Primary Tier", "Weighted Cost (bps)", "vs 1D", "vs 20D", "Signal"],
      desks.map((d) => [
        d.label,
        d.primaryTier,
        d.weightedCostBps != null ? d.weightedCostBps.toFixed(0) : "—",
        d.vsYesterday != null ? fmtSigned(d.vsYesterday, 1) : "—",
        d.vs20dAgo != null ? fmtSigned(d.vs20dAgo, 1) : "—",
        d.signal.toUpperCase(),
      ]),
      { columnStyles: { 2: { halign: "right" }, 3: { halign: "right" }, 4: { halign: "right" } } },
    );
  }

  if (tab === "spreads") {
    report.sectionTitle("Tier Spread Analysis");
    if (spreadChartRef) await report.captureElement(spreadChartRef, { maxHeight: 220 });

    report.table(
      ["Spread", "Current (bps)", "Mean", "Z-Score", "Pctl"],
      spreads.map((s) => [
        s.label,
        s.current != null ? s.current.toFixed(1) : "—",
        s.mean != null ? s.mean.toFixed(1) : "—",
        s.zScore != null ? s.zScore.toFixed(2) : "—",
        s.percentile != null ? `${s.percentile}%` : "—",
      ]),
      { columnStyles: { 1: { halign: "right" }, 2: { halign: "right" }, 3: { halign: "right" }, 4: { halign: "right" } } },
    );
  }

  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const tabLabel = tab === "dashboard" ? "Dashboard" : tab === "desk" ? "Desk" : "Spreads";
  report.save(`FCOST_${tabLabel}_${date}.pdf`);
}
