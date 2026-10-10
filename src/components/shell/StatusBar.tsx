
import clsx from "clsx";
import { useClock } from "@/lib/hooks";
import { fmtClock } from "@/lib/format";
import { getActiveAlerts } from "@/data/alerts";
import { useProviderHealth } from "@/lib/useProviderHealth";

/** Bottom status bar: clocks, feed health, live data provenance, alerts, build tag. */
export function StatusBar() {
  const now = useClock(120);
  const alerts = getActiveAlerts();
  const critical = alerts.filter((a) => a.severity === "CRITICAL").length;
  const high = alerts.filter((a) => a.severity === "HIGH").length;

  // Global data-provenance indicator — probes the real backends (FRED key,
  // market pipeline, news_nlp …) so live-vs-sim is visible from every module.
  const probe = useProviderHealth();
  const entries = probe.health ? Object.entries(probe.health) : [];
  const liveCount = entries.filter(([, v]) => v.status === "LIVE").length;
  const total = entries.length;
  const dataTone = !probe.health ? "mute" : liveCount === total ? "up" : liveCount > 0 ? "amber" : "down";
  const dataDot = dataTone === "up" ? "bg-term-up" : dataTone === "amber" ? "bg-term-amber" : dataTone === "down" ? "bg-term-down" : "bg-term-text-mute";
  const dataText = dataTone === "up" ? "text-term-up" : dataTone === "amber" ? "text-term-amber" : dataTone === "down" ? "text-term-down" : "text-term-text-mute";
  const dataTitle = entries.length
    ? entries.map(([k, v]) => `${k}: ${v.status} — ${v.detail}`).join("\n") + (probe.probedAt ? `\n\nprobed ${probe.probedAt.slice(11, 19)}` : "")
    : "Probing data providers…";

  // Feed indicator reflects the same real provider probe as DATA, instead of a
  // hardcoded green "LIVE" — there is no live tick stream in this build.
  const feedLabel = !probe.health ? "···" : liveCount === 0 ? "SIM" : liveCount === total ? "LIVE" : "PARTIAL";

  const tz = (label: string, offset: number) => {
    if (!now) return "--:--:--";
    const d = new Date(now.getTime() + offset * 3600 * 1000);
    return `${label} ${d.toUTCString().slice(17, 25)}`;
  };

  return (
    <footer className="flex h-6 shrink-0 items-center justify-between border-t border-term-border bg-term-panel px-3 text-3xs text-term-text-dim">
      <div className="flex items-center gap-4">
        <span className={clsx("flex items-center gap-1.5 font-semibold", dataText)} title={dataTitle}>
          <span className={clsx("h-1.5 w-1.5 rounded-full", dataDot, feedLabel === "LIVE" && "animate-blink")} /> FEED {feedLabel}
        </span>
        <span className={clsx("flex items-center gap-1.5 font-semibold", dataText)} title={dataTitle}>
          <span className={clsx("h-1.5 w-1.5 rounded-full", dataDot)} /> DATA {probe.health ? `${liveCount}/${total} LIVE` : "···"}
        </span>
        <span className="tnum">{now ? fmtClock(now) : "--:--:--"}</span>
        <span className="hidden tnum text-term-text-mute md:inline">{tz("NY", -5)}</span>
        <span className="hidden tnum text-term-text-mute md:inline">{tz("LDN", 0)}</span>
        <span className="hidden tnum text-term-text-mute lg:inline">{tz("TKY", 9)}</span>
      </div>
      <div className="flex items-center gap-4">
        <span className="tnum text-term-text-mute" title="Illustrative — no streaming bus is wired in this build">KAFKA <span className="text-term-text-mute">●</span> 8.2k msg/s · SIM</span>
        <span className="tnum text-term-text-mute" title="Illustrative — no live websocket streams in this build">WS <span className="text-term-text-mute">●</span> 14 streams · SIM</span>
        {critical > 0 && <span className="tnum font-semibold text-term-down">⚠ {critical} CRIT</span>}
        {high > 0 && <span className="tnum text-term-amber">{high} HIGH</span>}
        <span className="tnum text-term-text-mute">QIT-TERM v0.1.0</span>
      </div>
    </footer>
  );
}
