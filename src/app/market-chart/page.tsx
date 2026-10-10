import { ChartStudio } from "@/components/charting/ChartStudio";
import { MARKET_CATALOG } from "@/data/chartCatalog";

/** `MKC` — Market Chart Studio. Freeform technical charting over committed market series. */
export default function MarketChartPage() {
  return (
    <ChartStudio
      code="MKC"
      title="Market Chart Studio"
      desc="Freeform technical market charting"
      catalog={MARKET_CATALOG}
      defaultRefs={[{ source: "market", id: "SPY", assetClass: "EQUITY" }]}
      allowChartType
      defaultChartType="candles"
      allowIndicators
    />
  );
}
