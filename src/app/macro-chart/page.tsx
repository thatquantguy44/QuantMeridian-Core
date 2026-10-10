import { ChartStudio } from "@/components/charting/ChartStudio";
import { MACRO_CATALOG } from "@/data/chartCatalog";

/** `MGC` — Economic & Macro Chart Studio. Freeform charting over the FRED/econ layer. */
export default function MacroChartPage() {
  return (
    <ChartStudio
      code="MGC"
      title="Macro Chart Studio"
      desc="Freeform economic & macro charting"
      catalog={MACRO_CATALOG}
      defaultRefs={[
        { source: "econ", id: "DGS10" },
        { source: "econ", id: "DGS2" },
      ]}
      recessionShading
      allowIndicators
    />
  );
}
