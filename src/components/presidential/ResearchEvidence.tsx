import { Panel, Tag } from "@/components/ui/Panel";
import type { AnalysisResult, ResearchDataset } from "@/lib/presidential/contracts";
import { inputClass } from "./ResearchInputs";

export function ResearchEvidence({ dataset, result, runId, interpretation, onInterpretation }: {
  dataset: ResearchDataset; result: AnalysisResult; runId: string | null;
  interpretation: string; onInterpretation: (text: string) => void;
}) {
  return <div className="grid min-w-0 grid-cols-1 gap-2 xl:grid-cols-2">
    <Panel title="Sources and method" code="EVIDENCE" resizable={false}>
      <div className="space-y-3 p-3 text-xs leading-relaxed text-term-text-dim">
        <h2 className="font-medium text-term-text">Reconstruct the comparison</h2>
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 break-words text-2xs">
          <dt>Dataset</dt><dd className="min-w-0 break-all text-term-text">{dataset.id}</dd>
          <dt>Method</dt><dd className="text-term-text">{result.methodVersion}</dd>
          <dt>Return basis</dt><dd className="text-term-text">{dataset.currency} · {dataset.nominalReal} · {dataset.returnBasis}</dd>
          <dt>Run identity</dt><dd className="min-w-0 break-all font-mono text-term-text">{runId ?? "Computing local identity…"}</dd>
        </dl>
        <p>Political control is a label at the supplied window origin, not continuous attribution. Annual and presidential-period windows are analyzed separately. Cumulative returns compound index levels; annualized results depend on the actual endpoint interval.</p>
        <p>Only fundamental observations with a known availability date on or before the origin enter the scatters. Latest revised observations without historical availability are omitted. A scatter is descriptive: this version estimates no causal effect or forecast improvement.</p>
        <p>Group tables and whiskers use a deterministic 95% administration-cluster resampling range for the arithmetic mean when at least two administrations are represented. It preserves within-administration windows but remains descriptive—not a causal confidence interval, hypothesis test, party ranking or investment signal.</p>
        <ul className="space-y-2 border-t border-term-border pt-3">
          {dataset.sources.map(source => <li key={source.id} className="min-w-0 break-words"><span className="font-mono text-2xs text-term-amber">{source.id}</span> <span className="text-term-text">{source.title}</span>{source.locator && <span className="mt-1 block break-all text-2xs">{source.locator}</span>}{source.note && <p className="mt-1 text-2xs">{source.note}</p>}</li>)}
        </ul>
      </div>
    </Panel>
    <Panel title="Researcher's interpretation" code="AUTHOR" resizable={false} right={<Tag>Opinion</Tag>}>
      <div className="space-y-3 p-3 text-xs leading-relaxed text-term-text-dim">
        <h2 className="font-medium text-term-text">Your reading of the evidence</h2>
        <p>State what you think matters, which comparison changed your mind, and what the evidence cannot establish. This text is saved as author opinion in the run manifest.</p>
        <label className="block text-2xs text-term-text-dim">Your interpretation<textarea className={`${inputClass} mt-1 block min-h-[200px] w-full resize-y leading-relaxed`} rows={9} maxLength={20000} value={interpretation} onChange={e => onInterpretation(e.target.value)} placeholder="My interpretation, competing explanations, and limitations…" /></label>
        <p className="text-2xs">The browser session is temporary. Download the manifest to retain your notes, inputs and configuration. Figures and calculated results remain separate from your opinion.</p>
      </div>
    </Panel>
  </div>;
}
