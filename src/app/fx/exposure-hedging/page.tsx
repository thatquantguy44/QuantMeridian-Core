import { useState } from "react";
import Link from "@/components/Link";
import { PageHeader } from "@/components/ui/PageHeader";
import { Panel, Tag } from "@/components/ui/Panel";
import { ProvenanceBadge } from "@/components/ui/ProvenanceBadge";
import { EmptyWorkspace, WorkspaceStatus, WorkspaceTabs } from "@/components/fx/Workspace";
import { isModuleEnabled } from "@/lib/moduleConfig";

export default function FxExposureHedgingPage() {
  const [tab, setTab] = useState("cashflows");
  const [reportingCurrency, setReportingCurrency] = useState("USD");
  const tabs = [
    {
      id: "cashflows", label: "Cashflows",
      content: <EmptyWorkspace title="No cashflow book" description="Dated receipts and payments will appear here, with contracted and forecast flows kept distinguishable. No book is connected."
        columns={["Flow", "Entity / book", "Due date", "Currency", "Signed amount", "Certainty"]}
        note="Timing and scope will remain visible when reviewing offsetting flows." />,
    },
    {
      id: "portfolio", label: "Portfolio",
      content: <EmptyWorkspace title="No portfolio book" description="The portfolio workspace covers cash balances, equities/ETFs and bonds. There are no holdings or valuations to review."
        columns={["Holding / account", "Asset type", "Currency", "Supplied value", "Valuation as of", "Coverage"]}
        note="Currency denomination and economic currency exposure are distinct. Missing valuations and unsupported exposure methods must remain visible." />,
    },
    {
      id: "hedges", label: "Existing hedges",
      content: <EmptyWorkspace title="No existing FX hedges" description="Existing FX hedge records and their currency legs will appear here with their dates and exposure links. No hedge book is connected."
        columns={["Hedge", "Instrument", "Currency legs", "Due date", "Exposure link", "Coverage"]}
        note="An empty workspace does not establish that a book has no existing hedges." />,
    },
    {
      id: "scenarios", label: "Scenarios",
      content: <EmptyWorkspace title="No scenario results" description="FX translation scenarios need an exposure book and eligible reference evidence. Neither is connected to this workspace."
        columns={["Scenario", "Currency direction", "Original exposure", "After existing hedges", "Residual"]}
        note="No shocks, market moves or portfolio outcomes have been calculated." />,
    },
    {
      id: "proposals", label: "Proposals",
      content: <EmptyWorkspace title="No hedge proposals" description="Indicative currency offsets will be reviewable here alongside their assumptions, paired legs and remaining exposure."
        columns={["Exposure group", "Assumption", "Proposed legs", "Reference context", "Residual"]}
        note="A book and eligible reference snapshot are required. Reference-based offsets are indicative, not executable forward quotes." />,
    },
    {
      id: "reconciliation", label: "Reconciliation",
      content: <EmptyWorkspace title="No reconciliation results" description="Original exposures, existing hedges, proposed legs and residuals will be reconciled here. No calculation has run."
        columns={["Source record / group", "Original", "Existing hedge", "Proposed", "Residual", "Status"]}
        note="Unavailable or unsupported exposures must remain visible; an empty result is not zero exposure." />,
    },
  ];

  return (
    <div className="flex min-h-full min-w-0 flex-col">
      <PageHeader code="FXH" title="FX Exposure & Hedging" desc="Exposure, scenarios and residuals" showStreaming={false}
        right={<><ProvenanceBadge source="UNAVAILABLE" /><Tag>Workspace preview</Tag></>} />
      <WorkspaceStatus items={[
        { label: "Exposure book", value: "No book" },
        { label: "FX reference data", value: "No eligible snapshot" },
        { label: "Coverage", value: "Not assessed" },
      ]} />
      <div className="space-y-2 p-2">
        <div className="flex flex-wrap items-end justify-between gap-3 border border-term-border bg-term-panel px-3 py-2">
          <div>
            <label htmlFor="fxh-reporting-currency" className="mb-1 block text-2xs uppercase tracking-wide text-term-text-dim">Reporting currency</label>
            <select id="fxh-reporting-currency" value={reportingCurrency} onChange={(event) => setReportingCurrency(event.target.value)} className="border border-term-border bg-term-panel-2 px-2 py-1 text-xs text-term-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-term-amber">
              {["USD", "EUR", "GBP", "JPY"].map((currency) => <option key={currency} value={currency}>{currency}</option>)}
            </select>
            <span className="ml-3 text-2xs text-term-text-dim">Workspace preference only</span>
          </div>
          {isModuleEnabled("FXR") && <Link href="/fx/research" className="term-btn focus-visible:outline focus-visible:outline-2 focus-visible:outline-term-amber">Open FX Research</Link>}
        </div>
        <div className="grid min-w-0 grid-cols-1 items-start gap-2 xl:grid-cols-3">
          <div className="min-w-0 xl:col-span-2">
            <WorkspaceTabs id="fxh" label="FX exposure workspaces" tabs={tabs} value={tab} onChange={setTab} />
          </div>
          <Panel title="Book context" resizable={false}>
            <div className="space-y-3 p-3 text-xs leading-relaxed text-term-text-dim">
              <h2 className="font-medium text-term-text">No book connected</h2>
              <dl className="space-y-2">
                <div className="flex justify-between gap-3"><dt>Reporting currency</dt><dd className="text-term-text">{reportingCurrency}</dd></div>
                <div className="flex justify-between gap-3"><dt>Book as of</dt><dd>Unavailable</dd></div>
                <div className="flex justify-between gap-3"><dt>Reconciliation</dt><dd>Not assessed</dd></div>
              </dl>
              <div className="border-t border-term-border pt-3">
                <h3 className="mb-2 font-medium text-term-text">Exposure inputs</h3>
                <ul className="space-y-1">
                  <li>Contracted and forecast cashflows</li>
                  <li>Cash balances, equities/ETFs and bonds</li>
                  <li>Existing FX hedges</li>
                </ul>
              </div>
              <p className="border-t border-term-border pt-3 text-2xs">Input, calculation and export controls are not connected in this preview.</p>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
