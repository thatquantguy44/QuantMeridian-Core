import { LineChart } from "@/components/charts/LineChart";
import { Panel, Tag } from "@/components/ui/Panel";
import type { NaaimReadResponse } from "@/lib/naaim/contracts";
import { fmtNum } from "@/lib/format";

export function NaaimExposure({ read }: { read: NaaimReadResponse }) {
  const selection = read.selection!;
  const latest = selection.observations.at(-1)!;
  const recent = [...selection.observations].reverse().slice(0, 20);
  return <div className="grid min-w-0 grid-cols-12 gap-2">
    <div className="col-span-12 lg:col-span-4">
      <Panel title="NAAIM — Latest Exposure" code="SENT-3" accent right={<Tag tone="amber">3-MONTH DELAYED</Tag>}>
        <div className="space-y-3 p-3 text-2xs">
          <dl className="space-y-2 break-words">
            <div><dt className="text-term-text-mute">NAAIM Number</dt><dd className="tnum text-lg font-semibold text-term-text" data-testid="naaim-latest-value">{fmtNum(latest.exposure, 2)}</dd></div>
            <div><dt className="text-term-text-mute">Latest observation date</dt><dd><time dateTime={latest.asOfDate} className="tnum text-term-text">{latest.asOfDate}</time></dd></div>
            <div><dt className="text-term-text-mute">Artifact read at (UTC)</dt><dd><time dateTime={read.readCompletedAt!} className="tnum text-term-text-dim">{read.readCompletedAt}</time></dd></div>
            <div><dt className="text-term-text-mute">Current version first seen (UTC)</dt><dd className="tnum text-term-text-dim">{latest.firstSeenAt}</dd></div>
          </dl>
          <p className="border-t border-term-border pt-2 text-3xs text-term-text-dim">{selection.provenance.delayNotice}</p>
          <p className="text-3xs text-term-text-mute">{selection.provenance.attribution}</p>
        </div>
      </Panel>
    </div>
    <div className="col-span-12 min-w-0 space-y-2 lg:col-span-8">
      <Panel title="NAAIM Number — Delayed Research History" code="TREND" accent>
        <div className="overflow-x-auto p-2"><LineChart height={220} labels={selection.observations.map(row => row.asOfDate)} series={[{ name: "NAAIM Number", data: selection.observations.map(row => row.exposure), color: "#F5B041" }]} yFmt={value => fmtNum(value, 0)} /></div>
        <p className="px-3 pb-2 text-3xs text-term-text-dim">Current-vintage artifact history. The source delay applies to every observation; this is not current-week positioning or point-in-time replay data.</p>
      </Panel>
      <Panel title="Recent Delayed Observations" code="DATA">
        <div role="region" aria-label="NAAIM exposure history scroll area" tabIndex={0} className="overflow-x-auto">
          <table aria-label="NAAIM delayed exposure observations" className="w-full border-collapse tnum whitespace-nowrap">
            <thead className="bg-term-panel-2"><tr>{["Observation date", "NAAIM Number", "Current version first seen"].map(label => <th key={label} scope="col" className="border-b border-term-border-soft px-3 py-2 text-left text-2xs text-term-text-dim">{label}</th>)}</tr></thead>
            <tbody>{recent.map(row => <tr key={row.asOfDate}><th scope="row" className="border-b border-term-border-soft px-3 py-2 text-left text-2xs text-term-text">{row.asOfDate}</th><td className="border-b border-term-border-soft px-3 py-2 text-left text-2xs text-term-text">{fmtNum(row.exposure, 2)}</td><td className="border-b border-term-border-soft px-3 py-2 text-left text-2xs text-term-text-dim">{row.firstSeenAt}</td></tr>)}</tbody>
          </table>
        </div>
        <p className="border-t border-term-border px-3 py-2 text-3xs text-term-text-mute">Showing {recent.length} newest of {selection.observations.length} supplied observations. {selection.provenance.attribution}</p>
      </Panel>
    </div>
  </div>;
}
