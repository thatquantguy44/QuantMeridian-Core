import { useEffect, useRef, useState } from "react";
import { Panel } from "@/components/ui/Panel";
import { useVolatility } from "@/lib/fx/useVolatility";
import { VOLATILITY_WINDOWS, type VolatilityWindow } from "@/lib/fx/volatilityContracts";

function percent(v: number|null|undefined) { return v == null ? "Unavailable" : `${(v*100).toFixed(4)}%`; }
export function ResearchVolatility({selected}:{selected:number}) {
  const {data,loading,error,refresh}=useVolatility();
  const [window,setWindow]=useState<VolatilityWindow>(21), [annualize,setAnnualize]=useState(true);
  const [replay,setReplay]=useState("Unchecked"), active=useRef<AbortController|null>(null);
  const capture=data?.volatility ?? data?.retained, pair=data?.pairs[selected], metric=pair?.metrics.find(m=>m.window===window), historicalMetric=pair?.historicalMetrics.find(m=>m.window===window);
  const id=capture?.volatilityId;
  useEffect(()=>{active.current?.abort();setReplay("Unchecked");return ()=>active.current?.abort();},[id,loading]);
  async function verify() {
    if(!id) return;
    active.current?.abort();const controller=new AbortController();active.current=controller;setReplay("Checking…");
    try {
      const response=await fetch(`/api/fx/research/volatilities/${encodeURIComponent(id)}`,{signal:controller.signal,cache:"no-store"});
      const result=await response.json();
      if(!response.ok || result.volatility?.volatilityId!==id || result.volatility?.methodVersion!=="ecb-sample-log-volatility/1" ||
        result.historicalReplay!==true || result.currentConsumptionPermitted!==false) throw new Error();
      if(!controller.signal.aborted) setReplay("Verified historical replay; current use remains denied");
    } catch {if(!controller.signal.aborted) setReplay("Replay unavailable or failed verification");}
    finally {if(controller.signal.aborted && active.current===controller) setReplay("Unchecked");}
  }
  const mode=annualize?"Annualized volatility (%)":"Daily volatility (%)";
  const value=(m:typeof metric)=>percent(annualize?m?.annualizedSigma:m?.dailySigma);
  return <div className="min-w-0 space-y-2" aria-busy={loading}>
    <Panel title="Descriptive volatility" resizable={false}>
      <div className="space-y-3 p-3 text-xs text-term-text-dim">
        <div className="flex flex-wrap items-end gap-4">
          <label className="block text-2xs">Volatility window<select aria-label="Volatility window" value={window} onChange={e=>setWindow(Number(e.target.value) as VolatilityWindow)} className="mt-1 block border border-term-border bg-term-panel-2 px-2 py-1 text-xs text-term-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-term-amber">{VOLATILITY_WINDOWS.map(n=><option key={n} value={n}>{n} returns</option>)}</select></label>
          <label className="flex items-center gap-2 py-1"><input type="checkbox" checked={annualize} onChange={e=>setAnnualize(e.target.checked)} />Annualize</label>
          <button type="button" className="term-btn disabled:opacity-50" disabled={loading} onClick={()=>{void refresh();}}>Refresh volatility</button>
        </div>
        <p>Sample standard deviation of consecutive daily log returns. Non-annualized is daily dispersion estimated over this window; annualized applies √252. Neither is total-window volatility or a forecast.</p>
        <div role="status" className="border-y border-term-border py-3">
          <h2 className="text-xs text-term-text">{pair?`${pair.baseCurrency}/${pair.quoteCurrency} · `:""}{window} returns · {mode}</h2>
          <p data-testid="volatility-primary" className="mt-2 font-mono text-2xl text-term-amber">{loading?"Checking…":value(metric)}</p>
          {metric && <p className="mt-2">{metric.returnsAvailable}/{window} valid returns · {metric.levelsAvailable}/{metric.levelsRequired} levels · {metric.startDate??"Unknown start"} → {metric.endDate??"Unknown end"} · {metric.calendarDays??"Unknown"} calendar days</p>}
        </div>
        {metric?.state !== "AVAILABLE" && historicalMetric?.state === "AVAILABLE" && historicalMetric.endDate && <div data-testid="volatility-historical" role="status" className="border-y border-term-border bg-term-panel-2 py-3">
          <h3 className="text-xs text-term-text">Historical volatility · as of {historicalMetric.endDate}</h3>
          <p data-testid="volatility-historical-primary" className="mt-2 font-mono text-xl text-term-text">{value(historicalMetric)}</p>
          <p className="mt-2">Descriptive estimate from the latest qualified levels. This does not override the current freshness gate and is not a current or executable measure.</p>
        </div>}
        {(error||data?.error) && <p role="alert" className="text-term-amber">{error??data!.error!.message}</p>}
        {pair?.endpointReasons.map((r,i)=><p key={`${r.code}-${i}`}>{r.code}: {r.message}</p>)}
        {capture?.schedule.reasons.map((r,i)=><p key={`${r.code}-${i}`}>{r.code}: {r.message}</p>)}
        {metric?.reasons.map((r,i)=><p key={`${r.code}-${i}`} className="text-term-amber">{r.code}: {r.message}</p>)}
      </div>
    </Panel>
    <Panel title="Window comparison" resizable={false}>
      <div className="max-w-full overflow-x-auto" tabIndex={0} role="region" aria-label="Volatility window comparison">
        <table aria-label="Volatility windows" className="w-full text-left text-2xs"><thead><tr className="border-b border-term-border text-term-text-dim"><th className="p-2">Returns</th><th className="p-2">{mode}</th><th className="p-2">Coverage</th><th className="p-2">Actual level endpoints</th><th className="p-2">Status / reason</th></tr></thead><tbody>
          {pair?.metrics.map(m=><tr key={m.window} className={`border-b border-term-border ${m.window===window?"bg-term-panel-2":""}`}><th scope="row" className="p-2">{m.window}</th><td className="whitespace-nowrap p-2 font-mono">{value(m)}</td><td className="p-2">{m.returnsAvailable}/{m.window} returns<br/>{m.levelsAvailable}/{m.levelsRequired} levels</td><td className="p-2">{m.startDate??"—"}<br/>{m.endDate??"—"}</td><td className="p-2">{m.state}{m.reasons.map(r=><p key={r.code}>{r.code}: {r.message}</p>)}</td></tr>)}
        </tbody></table>
      </div>
      {!pair && <p className="p-3 text-xs text-term-text-dim">{loading?"Checking volatility evidence…":"No admitted volatility capture. Refresh to check the local source."}</p>}
    </Panel>
    <Panel title="Volatility evidence and replay" resizable={false}>
      <div className="space-y-3 p-3 text-2xs leading-relaxed text-term-text-dim">
        <p>Source: ECB reference rates, terminal-derived inverse/cross where indicated. Current-vintage descriptive research only. Original publication, receipt and first Gold availability are unknown. No historical system-known claim or permitted conversion/hedge use.</p>
        {capture && <><dl className="space-y-2 break-words"><div><dt>Capture identity</dt><dd className="break-all font-mono text-term-text">{id}</dd></div><div><dt>Cutoff / known by this capture</dt><dd>{capture.cutoffAt}</dd></div><div><dt>Method / scaling</dt><dd>ecb-sample-log-volatility/1 · centered sample, N−1 · {annualize?"√252 annualized":"daily, factor 1"}</dd></div><div><dt>Historical calendar / coverage</dt><dd>ecb-target-history-2025-2028/1 · {capture.schedule.dates.length}/253 expected dates</dd></div></dl>
          {metric?.firstReturn && <p>First return: {metric.firstReturn.startDate} → {metric.firstReturn.endDate}. Last return: {metric.lastReturn?.startDate} → {metric.lastReturn?.endDate}.</p>}
          <button type="button" className="term-btn disabled:opacity-50" disabled={loading||replay==="Checking…"} onClick={()=>{void verify();}}>Verify volatility replay</button><p role="status">{replay}</p>
          <details><summary className="cursor-pointer text-term-text">Inspect source records and qualified levels</summary><p className="py-2">Each return uses consecutive qualified pair levels below. Original source legs retain their own direction, revision and ingestion evidence. Common Gold read starts {data?.volatility?.goldReadStartedAt??"at the retained capture's recorded clock"}; capture cutoff above is the latest known-by bound.</p>
            <div className="max-h-96 max-w-full overflow-auto" tabIndex={0} role="region" aria-label="Volatility source evidence"><table aria-label="Volatility source records" className="w-full text-left"><thead><tr><th className="p-2">Date</th><th className="p-2">Pair level</th><th className="p-2">Source legs / evidence</th></tr></thead><tbody>{pair?.points.map(point=><tr key={point.observationDate} className="border-b border-term-border"><th scope="row" className="whitespace-nowrap p-2 align-top">{point.observationDate}</th><td className="p-2 align-top font-mono">{point.displayLevel??"Unavailable"}</td><td className="p-2">{point.reasons.map(r=><p key={r.code}>{r.code}: {r.message}</p>)}{point.evidenceIds.map(eid=>{const e=capture.evidence.find(e=>e.evidenceId===eid);return e?<details key={eid}><summary className="cursor-pointer">{e.sourceLevel} {e.sourceUnit}</summary><p className="break-all">{e.seriesId} · {e.observationDate}<br/>Revision: {e.revisionId}<br/>Recorded upstream ingestion: {e.upstreamRecordedAt}<br/>Evidence: {e.evidenceId}</p></details>:null;})}</td></tr>)}</tbody></table></div>
          </details>
        </>}
      </div>
    </Panel>
  </div>;
}
