import { useState } from "react";
import Link from "@/components/Link";
import { PageHeader } from "@/components/ui/PageHeader";
import { Panel, Tag } from "@/components/ui/Panel";
import { ProvenanceBadge } from "@/components/ui/ProvenanceBadge";
import { EmptyWorkspace, WorkspaceStatus, WorkspaceTabs } from "@/components/fx/Workspace";
import { ResearchOverview, ResearchEvidence } from "@/components/fx/ResearchSnapshot";
import { ResearchVolatility } from "@/components/fx/ResearchVolatility";
import { ResearchHistory } from "@/components/fx/ResearchHistory";
import { isModuleEnabled } from "@/lib/moduleConfig";
import { useResearchSnapshot } from "@/lib/fx/useResearchSnapshot";
import { FX_PAIRS } from "@/lib/fx/contracts";

const PAIRS = FX_PAIRS.map(p => ({ id: `${p.baseCurrency}/${p.quoteCurrency}`, base: p.baseCurrency, quote: p.quoteCurrency }));

export default function FxResearchPage() {
  const [pairId, setPairId] = useState(PAIRS[0].id);
  const [tab, setTab] = useState("overview");
  const { data, loading, error, refresh } = useResearchSnapshot();
  const pair = PAIRS.find((candidate) => candidate.id === pairId)!;
  const selected = PAIRS.indexOf(pair);
  const units = `${pair.quote} per 1 ${pair.base}`;
  const tabs = [
    {
      id: "overview", label: "Market overview",
      content: <ResearchOverview data={data} selected={selected} loading={loading} />,
    },
    {
      id: "history", label: "Pair history",
      content: tab === "history" ? <ResearchHistory selected={selected} /> : null,
    },
    {
      id: "volatility", label: "Volatility",
      content: tab === "volatility" ? <ResearchVolatility selected={selected} /> : null,
    },
    {
      id: "brief", label: "Research brief",
      content: <EmptyWorkspace title="No research brief" description="A research brief needs reference evidence before it can describe market moves. There is no brief to review yet."
        columns={["Research question", "Observation window", "Evidence", "Status"]} />,
    },
    {
      id: "evidence", label: "Evidence",
      content: <ResearchEvidence data={data} selected={selected} />,
    },
  ];

  return (
    <div className="flex min-h-full min-w-0 flex-col">
      <PageHeader code="FXR" title="FX Research" desc="Exchange rates, history and evidence" showStreaming={false}
        right={<><ProvenanceBadge source={data?.snapshot ? "ECB_REFERENCE" : "UNAVAILABLE"} /><Tag>Research only</Tag></>} />
      <WorkspaceStatus items={[
        { label: "Reference data", value: loading ? "Checking reference evidence" : data?.snapshot ? `${data.pairs.filter(p => p.state === "ELIGIBLE").length} of 4 eligible` : "No reference snapshot" },
        { label: "Pair focus", value: pair.id },
        { label: "Quote units", value: units },
      ]} />
      <div className="space-y-2 p-2">
        <div className="flex flex-wrap items-end justify-between gap-3 border border-term-border bg-term-panel px-3 py-2">
          <div>
            <label htmlFor="fxr-pair" className="mb-1 block text-2xs uppercase tracking-wide text-term-text-dim">Currency pair</label>
            <select id="fxr-pair" value={pairId} onChange={(event) => setPairId(event.target.value)} className="border border-term-border bg-term-panel-2 px-2 py-1 text-xs text-term-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-term-amber">
              {PAIRS.map((option) => <option key={option.id} value={option.id}>{option.id}</option>)}
            </select>
            <span className="ml-3 text-2xs text-term-text-dim">{units}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => { void refresh(); }} disabled={loading} className="term-btn focus-visible:outline focus-visible:outline-2 focus-visible:outline-term-amber disabled:opacity-50">Refresh reference snapshot</button>
            {isModuleEnabled("FXH") && <Link href="/fx/exposure-hedging" className="term-btn focus-visible:outline focus-visible:outline-2 focus-visible:outline-term-amber">Open FX Exposure &amp; Hedging</Link>}
          </div>
        </div>
        {(error || data?.error) && <p role="alert" className="border border-term-border p-3 text-xs text-term-amber">{error ?? data!.error!.message}</p>}
        <p role="status" className="px-1 text-2xs leading-relaxed text-term-text-dim">{loading ? "Checking reference evidence…" : "Pair selection changes the view of the dated capture. Pair history includes observed changes; Volatility compares five trailing return windows. Research briefs are not yet available."}</p>
        <div className="grid min-w-0 grid-cols-1 items-start gap-2 xl:grid-cols-3">
          <div className="min-w-0 xl:col-span-2">
            <WorkspaceTabs id="fxr" label="FX research workspaces" tabs={tabs} value={tab} onChange={setTab} />
          </div>
          <Panel title="Research context" resizable={false}>
            <div className="space-y-3 p-3 text-xs leading-relaxed text-term-text-dim">
              <h2 className="font-medium text-term-text">Exchange-rate research</h2>
              <p>Inspect dated reference levels, compare observed changes and review the source evidence for a pair.</p>
              <dl className="space-y-2 border-t border-term-border pt-3">
                <div className="flex justify-between gap-3"><dt>Pair direction</dt><dd className="text-term-text">{pair.base} → {pair.quote}</dd></div>
                <div className="flex justify-between gap-3"><dt>Reference use</dt><dd>Research only</dd></div>
                <div className="flex justify-between gap-3"><dt>Pair history</dt><dd>Up to 90 TARGET dates</dd></div>
                <div className="flex justify-between gap-3"><dt>Volatility history</dt><dd>Up to 253 levels</dd></div>
              </dl>
              <p className="border-t border-term-border pt-3 text-2xs">Reference levels describe exchange rates. They are not executable quotes.</p>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
