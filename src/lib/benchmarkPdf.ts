/** PDF export for qualified benchmark observations and their source dates. */
import { benchmarkAsOfDate } from "./benchmarkAsOf";
import { PdfReport } from "./pdfReport";
import { benchmarkChange, benchmarkValue, type QualifiedBenchmarkSeries } from "./benchmarkQualified";
import { BENCHMARK_SERIES } from "@/data/benchmarkRates";
import { calendarChanges, descriptiveHistory, rollingHistory } from "./benchmarkHistory";

export async function generateQualifiedBenchmarkPdf(options: { series: QualifiedBenchmarkSeries[]; checkedAt: string; category: string }): Promise<void> {
  const byId = new Map(options.series.map((row) => [row.id, row]));
  if (!options.series.some((row) => row.status === "available" && (options.category === "ALL" || row.category === options.category))) throw new Error("No qualified benchmark data to export.");
  const definitions = options.category === "ALL" ? BENCHMARK_SERIES : BENCHMARK_SERIES.filter((def) => def.category === options.category);
  const report = new PdfReport({ title: "Benchmark Rates", code: "BMRK", source: "FRED retained history", asOf: options.checkedAt,
    subtitle: "Individual Gold and latest verified warehouse-source dates are listed below." });
  report.sectionTitle("Historical analysis of loaded snapshot");
  report.textBlock("Statistics use only the observations in the initial qualified snapshot, not older pages loaded separately. Changes use an observation on or before each target within bounded cadence-based lag; comparison dates are shown. Volatility is the sample standard deviation of consecutive observed changes and is not annualized. History is latest-revised, not point-in-time.");
  const qualified = definitions.filter((def) => byId.get(def.id)?.status === "available");
  report.table(["Series", "Coverage / count", "1D change / date", "1W change / date", "1M change / date", "3M change / date", "YTD change / date", "1Y change / date"], qualified.map((def) => {
    const row = byId.get(def.id)!;
    const changes = calendarChanges(row.observations, row.frequency);
    const change = (label: string) => { const value = changes.find((entry) => entry.label === label); return value?.change == null ? "Unavailable" : `${benchmarkChange(def, value.change)} / ${value.date}`; };
    return [def.id, `${row.observations[0].date} to ${row.observationDate} (${row.observations.length})`, ...["1D", "1W", "1M", "3M", "YTD", "1Y"].map(change)];
  }));
  report.sectionTitle("Loaded sample and rolling statistics");
  report.textBlock("Rolling calculations use 20 consecutive observed changes and are unavailable when a cadence-sized gap is exceeded. Percent-denominated rate changes are in basis points; volatility is not annualized.");
  report.table(["Series", "Count", "Range", "Percentile", "Z-score", "20-observation change / start", "20-change volatility"], qualified.map((def) => {
    const row = byId.get(def.id)!;
    const stats = descriptiveHistory(row.observations);
    const rolling = rollingHistory(row.observations, row.frequency).at(-1);
    return [def.id, String(stats.count), `${benchmarkValue(def, stats.min)} to ${benchmarkValue(def, stats.max)}`, stats.percentile === null ? "Unavailable" : `${stats.percentile.toFixed(1)}%`, stats.zScore?.toFixed(2) ?? "Unavailable", rolling?.change == null ? "Unavailable" : `${benchmarkChange(def, rolling.change)} / ${rolling.fromDate}`, benchmarkChange(def, rolling?.volatility)];
  }));
  report.sectionTitle("Source-qualified benchmark series");
  report.textBlock(`As-of date: ${benchmarkAsOfDate(new Date(options.checkedAt))} America/New_York. This report does not include the separate FRED provider-latest check; publication timestamps were not supplied. Gold observation dates, source-record dates and ingestion timestamps are distinct. Missing data is unavailable; no synthetic data is substituted.`);
  report.table(["Series", "Latest", "Observed", "Freshness", "Frequency", "Native unit", "Ingested", "Latest warehouse source", "Coverage / status", "Source"], definitions.map((def) => {
    const row = byId.get(def.id);
    const available = row?.status === "available";
    const coverage = available ? `Gold: ${row.firstRetainedDate ?? "unknown"} to ${row.latestRetainedDate ?? "unknown"}; loaded: ${row.observations[0]?.date} to ${row.observationDate} (${row.observations.length})` : row?.reason ?? "No qualified data";
    const future = `${row?.futureGoldCount ? `; future Gold excluded: ${row.firstFutureGoldDate} (${row.futureGoldCount})` : ""}${row?.futureSourceCount ? `; future source excluded: ${row.firstFutureSourceDate} (${row.futureSourceCount}), not verified for current use` : ""}${row?.boardStatus === "future" ? "; future board excluded" : ""}`;
    return [def.id, benchmarkValue(def, available ? row.observations.at(-1)?.value : null), row?.observationDate ?? "-",
      available ? row.freshness : "UNAVAILABLE", row?.frequency ?? "unknown", row?.nativeUnit ?? "unknown", available ? row.ingestedAt ?? "unknown" : "-", row?.latestWarehouseSourceDate ? `${row.latestWarehouseSourceDate} ${benchmarkValue(def, row.latestWarehouseSourceValue)}; ingested ${row.latestWarehouseSourceIngestedAt}; ${row.latestWarehouseSourceEvidence.join(", ")}` : row?.latestWarehouseSourceStatus ?? "unavailable",
      coverage + future,
      `https://fred.stlouisfed.org/series/${def.id}${available ? `; ${row.evidenceMethods.join(", ")}` : ""}`];
  }), { avoidRowBreak: true, columnStyles: {
    0: { cellWidth: 70 }, 1: { cellWidth: 50 }, 2: { cellWidth: 58 }, 3: { cellWidth: 64 },
    4: { cellWidth: 50 }, 5: { cellWidth: 52 }, 6: { cellWidth: 92 }, 7: { cellWidth: 115 },
    8: { cellWidth: 106 }, 9: { cellWidth: 112 },
  } });
  report.save(`BMRK_qualified_${options.checkedAt.slice(0, 10)}.pdf`);
}
