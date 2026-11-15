import { useEffect, useState } from "react";
import clsx from "clsx";
import { PageHeader, KpiStrip } from "@/components/ui/PageHeader";
import { Panel, Stat, Tag } from "@/components/ui/Panel";
import { ProvenanceBadge } from "@/components/ui/ProvenanceBadge";
import { fmtSigned } from "@/lib/format";
import { useSentFeeds } from "./useSentFeeds";
import { AaiiSurvey } from "./AaiiSurvey";
import { SentSocialView } from "./SentSocialView";
import { SentMacroInputs } from "./SentMacroInputs";
import { NaaimExposure } from "./NaaimExposure";

type View = "DASH" | "AAII" | "NAAIM" | "SOCIAL" | "POSITION" | "SIGNALS" | "DIVERGE" | "TICKER";
const views: { key: View; label: string; missing?: string }[] = [
  { key: "DASH", label: "Fear / Greed" }, { key: "AAII", label: "AAII Survey" }, { key: "NAAIM", label: "NAAIM Exposure" }, { key: "SOCIAL", label: "Social Mood" },
  { key: "POSITION", label: "Positioning", missing: "Source-backed manager exposure, put/call and fund-flow history are not connected." },
  { key: "SIGNALS", label: "Contrarian", missing: "The complete source-backed signal inputs and historical forward returns are not connected." },
  { key: "DIVERGE", label: "Divergence", missing: "A comparable source-backed social history is not connected." },
  { key: "TICKER", label: "By Ticker", missing: "Source-backed borrow and positioning records are not connected to SENT." },
];
function NoData({ title, detail, loading = false }: { title: string; detail: string; loading?: boolean }) {
  return <Panel title={title}><div role="status" className="space-y-1 p-4 text-2xs text-term-text-dim">
    <p className="font-semibold text-term-text">{loading ? "Loading source data…" : "No data"}</p><p>{detail}</p>
  </div></Panel>;
}
export default function SentimentModule() {
  const [view, setView] = useState<View>("DASH");
  const [refresh, setRefresh] = useState(0);
  const [now, setNow] = useState(Date.now);
  const feeds = useSentFeeds(refresh);
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 60000); return () => clearInterval(timer); }, []);
  const selection = feeds.aaii.data?.selection;
  const naaim = feeds.naaim.data?.selection;
  const latest = selection?.observations[selection.observations.length - 1];
  const latestNaaim = naaim?.observations.at(-1);
  const age = selection ? Math.floor((Date.parse(new Date(now).toISOString().slice(0, 10)) - Date.parse(selection.provenance.latestSurveyDate)) / 86400000) : null;
  const stale = selection?.provenance.dataState === "STALE" || age !== null && age > 10;
  const social = feeds.social.data;
  const socialNet = social ? social.platforms.reduce((sum, p) => sum + p.sentiment, 0) / social.platforms.length : null;
  const selected = views.find(v => v.key === view)!;
  return <div className="flex min-h-full min-w-0 flex-col">
    <PageHeader code="SENT" title="Investor Sentiment & Behavior" desc="Observed survey and social data" showStreaming={false}
      asOf={selection?.provenance.latestSurveyDate ?? naaim?.provenance.latestAsOfDate}
      right={<><ProvenanceBadge source={selection || naaim || feeds.macro.data?.series.some(s => s.observations.length) ? "DB" : social ? "LIVE" : "ERR"} /><Tag>REAL DATA ONLY</Tag></>} />
    <KpiStrip>
      <Stat label="Sentiment Index" value="No data" sub="Required source inputs missing" />
      <Stat label="AAII Bull−Bear" value={latest && !stale ? `${fmtSigned(latest.bullBearSpreadPp, 1)} pp` : "No data"} sub={latest ? `${stale ? "STALE · " : "AAII · "}${latest.surveyDate}` : "AAII source unavailable"} />
      <Stat label="Latest AAII Survey" value={latest?.surveyDate ?? "No data"} sub="Reported date, unshifted" />
      <Stat label="NAAIM Exposure" value={latestNaaim ? latestNaaim.exposure.toFixed(2) : "No data"} sub={latestNaaim ? `3-month delayed · ${latestNaaim.asOfDate}` : "No source connected"} />
      <Stat label="Social Net" value={socialNet === null ? "No data" : fmtSigned(socialNet, 2)} sub={social?.source ?? "No source connected"} />
      <Stat label="Most Discussed" value={social?.tickers[0]?.label ?? "No data"} sub={social ? "Observed posts" : "No source connected"} />
    </KpiStrip>
    <div className="flex flex-wrap gap-1 border-b border-term-border bg-term-panel px-3 py-1.5">
      {views.map(v => <button key={v.key} type="button" aria-pressed={view === v.key} onClick={() => setView(v.key)}
        className={clsx("rounded-sm border px-2 py-1 text-3xs font-semibold uppercase tracking-wide focus-visible:outline focus-visible:outline-2 focus-visible:outline-term-amber", view === v.key ? "border-term-amber bg-term-amber text-black" : "border-term-border text-term-text-dim")}>{v.label}</button>)}
    </div>
    <div className="flex min-w-0 flex-1 flex-col gap-2 p-2">
      <div className="flex flex-wrap items-center justify-between gap-2 text-2xs text-term-text-dim">
        <span>Available observations only. Missing inputs remain empty.</span>
        <button type="button" onClick={() => setRefresh(n => n + 1)} className="rounded-sm border border-term-border px-2 py-1 text-term-amber focus-visible:outline focus-visible:outline-2 focus-visible:outline-term-amber">Refresh SENT data</button>
      </div>
      {view === "DASH" && <>
        <NoData title="Fear / Greed Index" detail="The complete set of source-backed components is not connected. No composite score, regime or one-week change is available." />
        <Panel title="Available Source Observations" code="MIX">
          <div className="divide-y divide-term-border-soft text-2xs text-term-text-dim">
            <div className="px-3 py-2">AAII: {latest ? `observed ${latest.surveyDate}${stale ? " · STALE" : ""}; inspect the AAII Survey tab` : "No data"}</div>
            <div className="px-3 py-2">NAAIM: {latestNaaim ? `observed ${latestNaaim.asOfDate} · 3-month delayed; inspect the NAAIM Exposure tab` : "No data"}</div>
            <div className="px-3 py-2">Put/call, breadth and fund flows: No data</div>
            <div className="px-3 py-2">Social: {social ? `${social.source} · ${social.totalPosts} observed posts` : "No data"}</div>
          </div>
        </Panel>
        <SentMacroInputs key={feeds.macro.data?.assessedAt ?? "empty"} data={feeds.macro.data} loading={feeds.macro.loading} error={feeds.macro.error} />
      </>}
      {view === "AAII" && (feeds.aaii.data && selection ? <AaiiSurvey read={feeds.aaii.data} stale={stale} /> :
        <NoData title="AAII Survey" loading={feeds.aaii.loading} detail={feeds.aaii.error ?? "Waiting for the private local AAII connection. Survey and snapshot read dates are unavailable."} />)}
      {view === "NAAIM" && (feeds.naaim.data && naaim ? <NaaimExposure read={feeds.naaim.data} /> :
        <NoData title="NAAIM Exposure" loading={feeds.naaim.loading} detail={feeds.naaim.error ?? "Waiting for the private local NAAIM research artifact."} />)}
      {view === "SOCIAL" && (social ? <SentSocialView data={social} /> :
        <NoData title="Social Mood" loading={feeds.social.loading} detail="No observed sentiment posts are available from the configured providers." />)}
      {selected.missing && <NoData title={selected.label} detail={selected.missing} />}
    </div>
    <p className="border-t border-term-border px-3 py-2 text-3xs text-term-text-dim">SENT uses real source observations only. Missing connections, empty results and failed reads show no data. Stale AAII history stays dated and labelled; NAAIM remains explicitly three months delayed.</p>
  </div>;
}
