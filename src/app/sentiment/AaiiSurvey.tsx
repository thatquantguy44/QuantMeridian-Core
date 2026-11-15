import { Panel, Tag } from "@/components/ui/Panel";
import { LineChart } from "@/components/charts/LineChart";
import type { AaiiReadResponse } from "@/lib/aaii/contracts";
import { AaiiHistoryTable } from "./AaiiHistoryTable";
import { fmtSigned } from "@/lib/format";

export function AaiiSurvey({ read, stale }: { read: AaiiReadResponse; stale: boolean }) {
  const selection = read.selection!;
  const p = selection.provenance;
  const latest = selection.observations[selection.observations.length - 1];
  const history = selection.observations.map(o => ({ date: o.surveyDate, bullish: o.bullishPct, neutral: o.neutralPct,
    bearish: o.bearishPct, spread: o.bullBearSpreadPp, gapDays: o.gapDays }));
  // Break lines across recorded gaps; do not fill in dates or invented values.
  const chart = selection.observations.flatMap(o => o.gapDays !== null && o.gapDays > 8
    ? [{ date: "", value: NaN }, { date: o.surveyDate, value: o.bullBearSpreadPp }]
    : [{ date: o.surveyDate, value: o.bullBearSpreadPp }]);
  return (
    <div className="grid min-w-0 grid-cols-12 gap-2">
      <div className="col-span-12 lg:col-span-4">
        <Panel title="AAII — Latest Survey Observation" code="SENT-2" accent right={<Tag tone={stale ? "amber" : "up"}><span data-testid="aaii-freshness">{stale ? "STALE" : "CURRENT"}</span></Tag>}>
          <div className="space-y-3 p-3">
            <dl className="space-y-2 break-words text-2xs">
              <div><dt className="text-term-text-mute">Latest reported survey date</dt><dd><time data-testid="aaii-latest-survey-date" dateTime={p.latestSurveyDate} className="tnum font-semibold text-term-text">{p.latestSurveyDate}</time></dd></div>
              <div><dt className="text-term-text-mute">Latest snapshot read at (UTC)</dt><dd><time data-testid="aaii-snapshot-read-at" dateTime={read.readCompletedAt!} className="tnum text-term-text-dim">{read.readCompletedAt}</time></dd></div>
              <div><dt className="text-term-text-mute">Source retrieved at (UTC)</dt><dd><time data-testid="aaii-source-retrieved-at" dateTime={p.retrievedAt} className="tnum text-term-text-dim">{p.retrievedAt}</time></dd></div>
              <div><dt className="text-term-text-mute">First seen by source (UTC)</dt><dd className="tnum text-term-text-dim">{p.firstSeenAt}</dd></div>
              <div><dt className="text-term-text-mute">Provider publication time</dt><dd data-testid="aaii-publication-time" className="tnum text-term-text-dim">{p.providerPublishedAt ?? "Unknown"}</dd></div>
            </dl>
            <p className="border-t border-term-border pt-2 text-3xs text-term-text-dim">AAII · current-vintage Gold selection · latest {history.length} observations. This read is not a saved replay snapshot or historical point-in-time record.</p>
            {stale && <p className="text-2xs text-term-amber">Dated history remains visible. Current calculations are unavailable after ten calendar days.</p>}
            <div className="space-y-2 border-t border-term-border pt-2">
              {([["Bullish", latest.bullishPct, "bg-term-up"], ["Neutral", latest.neutralPct, "bg-term-text-mute"], ["Bearish", latest.bearishPct, "bg-term-down"]] as const).map(([label, value, color]) => (
                <div key={label} className="flex items-center gap-2 text-2xs">
                  <span className="w-16 text-term-text-dim">{label}</span>
                  <span className="h-2 flex-1 bg-term-panel-3"><span className={`block h-full ${color}`} style={{ width: `${value}%` }} /></span>
                  <span className="tnum w-12 text-right text-term-text">{value.toFixed(1)}%</span>
                </div>
              ))}
            </div>
            <div className="text-2xs text-term-text-dim">Observed bull−bear spread <strong className="tnum text-term-text">{fmtSigned(latest.bullBearSpreadPp, 1)} pp</strong></div>
          </div>
        </Panel>
      </div>
      <div className="col-span-12 min-w-0 space-y-2 lg:col-span-8">
        <Panel title="Bull−Bear Spread — Observed History" code="TREND" accent>
          <div className="overflow-x-auto p-2"><LineChart height={220} labels={chart.map(o => o.date)} series={[{ name: "Bull−Bear (pp)", data: chart.map(o => o.value), color: "#3B9DFF" }]} yFmt={n => `${n.toFixed(0)} pp`} /></div>
          <p className="px-3 pb-2 text-3xs text-term-text-dim">Reported-date order; gaps are not filled. The table preserves exact dates and gaps.</p>
        </Panel>
        <AaiiHistoryTable key={selection.assessedAt} history={history} />
      </div>
    </div>
  );
}
