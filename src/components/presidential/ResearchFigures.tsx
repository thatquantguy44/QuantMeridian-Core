import { useState } from "react";
import { GROUPING_LABELS, type AnalysisResult, type ResearchDataset } from "@/lib/presidential/contracts";
import { FigurePanel } from "./FigurePanel";
import { CategoryChart, FundamentalScatter, PoliticalTimeline } from "./ResearchCharts";
import { inputClass } from "./ResearchInputs";

export function ResearchFigures({ dataset, result, runId, fictionalFixture = false }: { dataset: ResearchDataset; result: AnalysisResult; runId: string | null; fictionalFixture?: boolean }) {
  const definitions = [...new Set(result.rows.filter(row => row.included && row.valuation !== null).map(row => row.valuationDefinition).filter((value): value is string => value !== null))];
  const [selectedDefinition, setSelectedDefinition] = useState("");
  const definition = definitions.includes(selectedDefinition) ? selectedDefinition : definitions[0];
  const quality = dataset.kind === "ILLUSTRATIVE" || fictionalFixture ? "DEMO — fictional observations; not research findings" : "USER_SUPPLIED — unverified observations";
  const common = `${dataset.title}; ${dataset.currency}; ${dataset.nominalReal}; ${dataset.returnBasis}; ${result.config.windowKind}; ${result.config.metric}; N=${result.includedCount} included windows; partial windows ${result.config.includePartial ? "allowed" : "excluded"}; endpoints ${result.config.maxEndpointGapDays === 0 ? "exact dates" : `previous observation within ${result.config.maxEndpointGapDays} calendar days`}; ${result.methodVersion}; political labels at origin; run ${runId ?? "pending"}; sources ${dataset.sources.map(source => source.id).join(", ")}; ${quality}.`;
  const watermark = dataset.kind === "ILLUSTRATIVE" || fictionalFixture ? "DEMO · ILLUSTRATIVE DATA" : "USER-SUPPLIED · UNVERIFIED";
  return <div className="space-y-2">
    <FigurePanel id="presidential-control-comparison" title="Political-control comparison" caption={`${GROUPING_LABELS[result.config.grouping]}; full-sample arithmetic means with a 95% administration-cluster resampling range where at least two administrations are present. These descriptive ranges are not causal confidence intervals. Absent categories are unavailable, not zero. ${common}`} watermark={watermark} ready={!!runId}>
      <CategoryChart result={result} />
    </FigurePanel>
    <div className="grid min-w-0 grid-cols-1 gap-2 xl:grid-cols-2">
      <FigurePanel id="presidential-starting-valuation" title="Inherited valuation" caption={`Only included windows with values known at origin. Valuation definition: ${definition ?? "unavailable"}. One definition is shown at a time. No fitted relationship. ${common}`} watermark={watermark} ready={!!runId}>
        {definitions.length > 1 && <label className="mb-2 flex flex-col gap-1 text-2xs text-term-text-dim">Valuation definition<select className={inputClass} value={definition} onChange={event => setSelectedDefinition(event.target.value)}>{definitions.map(item => <option key={item}>{item}</option>)}</select></label>}
        <FundamentalScatter rows={result.rows} field="valuation" definition={definition} />
      </FigurePanel>
      <FigurePanel id="presidential-starting-policy-rate" title="Inherited policy rate" caption={`Only included windows with policy-rate observations known at origin; rate unit: percent. No fitted relationship. ${common}`} watermark={watermark} ready={!!runId}>
        <FundamentalScatter rows={result.rows} field="policyRatePct" />
      </FigurePanel>
    </div>
    <FigurePanel id="presidential-control-timeline" title="Political control timeline" caption={`All supplied political intervals, not only included return windows. End dates are exclusive. ${common}`} watermark={watermark} ready={!!runId}>
      <PoliticalTimeline dataset={dataset} />
    </FigurePanel>
  </div>;
}
