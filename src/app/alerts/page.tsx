
import { useMemo, useState } from "react";
import { PageHeader, KpiStrip } from "@/components/ui/PageHeader";
import { Panel, Stat, Tag } from "@/components/ui/Panel";
import { ProvenanceBadge } from "@/components/ui/ProvenanceBadge";
import { BarChart } from "@/components/charts/BarChart";
import { ProgressBar } from "@/components/charts/Radial";
import { useTick } from "@/lib/hooks";
import { useLiveSeriesSet } from "@/lib/useEcon";
import {
  getAlerts,
  evaluateLiveAlerts,
  ALERT_FRED_IDS,
  SEVERITY_TONE,
  CATEGORY_LABEL,
  type Alert,
  type AlertSeverity,
  type AlertCategory,
} from "@/data/alerts";

const SEVERITIES: AlertSeverity[] = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];
const CATEGORIES = Object.keys(CATEGORY_LABEL) as AlertCategory[];

const SEV_COLOR: Record<AlertSeverity, string> = {
  CRITICAL: "#FF3B3B",
  HIGH: "#FF8C00",
  MEDIUM: "#3B9DFF",
  LOW: "#5E5E66",
};

const CAT_COLOR: Record<AlertCategory, string> = {
  SEC_LENDING: "#FF8C00",
  PRIME: "#3B9DFF",
  OPTIMIZATION: "#8B5CF6",
  COLLATERAL: "#2ECC71",
  TREASURY: "#E6B800",
  MARKET: "#9A9AA3",
  SENTIMENT: "#A78BFA",
};

// Canonical configured rules per the spec (rules-engine surface).
const RULE_GROUPS: { category: AlertCategory; rules: string[] }[] = [
  { category: "SEC_LENDING", rules: ["Utilization > 95%", "Inventory shortages", "Borrow rate spikes", "Recall events"] },
  { category: "PRIME", rules: ["Exposure breaches", "Margin calls", "Financing stress"] },
  { category: "OPTIMIZATION", rules: ["Solver failures", "Constraint violations", "Savings opportunities"] },
];

export default function AlertCenter() {
  const tick = useTick(3000);
  const { data: liveData, source: liveSource } = useLiveSeriesSet(ALERT_FRED_IDS, "lin", 5);
  const simAlerts = useMemo(() => getAlerts(), []);
  const liveAlerts = useMemo(() => evaluateLiveAlerts(liveData), [liveData]);
  const all = useMemo(() => {
    const merged = [...liveAlerts, ...simAlerts];
    return merged.sort((a, b) => a.minsAgo - b.minsAgo);
  }, [liveAlerts, simAlerts]);
  const hasLive = liveAlerts.length > 0;
  const alertSource = hasLive && liveSource !== "SIM" ? liveSource : "SIM";

  const [sevFilter, setSevFilter] = useState<AlertSeverity | "ALL">("ALL");
  const [catFilter, setCatFilter] = useState<AlertCategory | "ALL">("ALL");
  const [acked, setAcked] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(all.map((a) => [a.id, a.acked]))
  );
  const [rules, setRules] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(RULE_GROUPS.flatMap((g) => g.rules.map((r) => [`${g.category}:${r}`, true])))
  );

  const isAcked = (a: Alert) => acked[a.id] ?? a.acked;
  const activeCount = all.filter((a) => !isAcked(a)).length;
  const sevCount = (s: AlertSeverity) => all.filter((a) => a.severity === s).length;
  const catCount = (c: AlertCategory) => all.filter((a) => a.category === c).length;

  const filtered = all
    .filter((a) => (sevFilter === "ALL" ? true : a.severity === sevFilter))
    .filter((a) => (catFilter === "ALL" ? true : a.category === catFilter))
    .sort((a, b) => a.minsAgo - b.minsAgo);

  const volByCat = CATEGORIES.map((c) => ({
    label: CATEGORY_LABEL[c],
    value: catCount(c),
    color: CAT_COLOR[c],
  })).sort((a, b) => b.value - a.value);

  return (
    <div className="flex min-h-full flex-col">
      <PageHeader
        code="ALRT"
        title="Alert Center"
        desc="Streaming Risk & Operations Alerts"
        right={<span className="flex items-center gap-1"><ProvenanceBadge source={alertSource} /><Tag tone="down">{all.filter((a) => a.severity === "CRITICAL" && !isAcked(a)).length} CRIT</Tag></span>}
      />

      <KpiStrip>
        <Stat label="Active Alerts" value={activeCount} sub={`${all.length} total`} tone="amber" />
        <Stat label="Critical" value={sevCount("CRITICAL")} tone="down" />
        <Stat label="High" value={sevCount("HIGH")} tone="amber" />
        <Stat label="Sec Lending" value={catCount("SEC_LENDING")} sub="alerts" />
        <Stat label="Prime" value={catCount("PRIME")} sub="alerts" />
        <Stat label="Optimization" value={catCount("OPTIMIZATION")} sub="alerts" />
      </KpiStrip>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3 border-b border-term-border bg-term-panel px-3 py-1.5">
        <div className="flex items-center gap-1">
          <span className="mr-1 text-3xs uppercase tracking-wider text-term-text-mute">Severity</span>
          <button className={`term-btn ${sevFilter === "ALL" ? "term-btn-active" : ""}`} onClick={() => setSevFilter("ALL")}>
            All
          </button>
          {SEVERITIES.map((s) => (
            <button
              key={s}
              className={`term-btn ${sevFilter === s ? "term-btn-active" : ""}`}
              onClick={() => setSevFilter(s)}
            >
              {s}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-1">
          <span className="mr-1 text-3xs uppercase tracking-wider text-term-text-mute">Category</span>
          <button className={`term-btn ${catFilter === "ALL" ? "term-btn-active" : ""}`} onClick={() => setCatFilter("ALL")}>
            All
          </button>
          {CATEGORIES.map((c) => (
            <button
              key={c}
              className={`term-btn ${catFilter === c ? "term-btn-active" : ""}`}
              onClick={() => setCatFilter(c)}
            >
              {CATEGORY_LABEL[c]}
            </button>
          ))}
        </div>
      </div>

      <div className="grid flex-1 grid-cols-1 gap-2 p-2 xl:grid-cols-[1fr_320px]">
        {/* Main alert stream */}
        <Panel
          title="Alert Stream"
          code="STREAM"
          accent
          right={
            <span className="tnum flex items-center gap-1.5 text-3xs text-term-text-mute" suppressHydrationWarning>
              <span className="h-1.5 w-1.5 animate-blink rounded-full bg-term-up" />
              updated · tick {String(tick).padStart(4, "0")} · {filtered.length} shown
            </span>
          }
        >
          <div className="flex flex-col">
            {filtered.length === 0 && (
              <div className="px-3 py-6 text-center text-2xs text-term-text-mute">No alerts match the current filters.</div>
            )}
            {filtered.map((a) => {
              const ackd = isAcked(a);
              const crit = a.severity === "CRITICAL";
              return (
                <div
                  key={a.id}
                  className={`flex items-start gap-2 border-b border-term-border-soft px-2 py-1.5 ${
                    crit && !ackd ? "bg-term-down/[0.06]" : ""
                  } ${ackd ? "opacity-55" : ""}`}
                >
                  <span
                    className="mt-1 h-full w-1 shrink-0 self-stretch rounded-full"
                    style={{ background: SEV_COLOR[a.severity] }}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <Tag tone={SEVERITY_TONE[a.severity]}>{CATEGORY_LABEL[a.category]}</Tag>
                      <span className="text-3xs font-semibold" style={{ color: SEV_COLOR[a.severity] }}>
                        {a.severity}
                      </span>
                      <span className="tnum text-3xs text-term-text-mute" suppressHydrationWarning>
                        {a.ts} · {a.minsAgo}m ago
                      </span>
                      {ackd && <Tag tone="neutral">ACKED</Tag>}
                    </div>
                    <div className="mt-0.5 text-2xs font-semibold text-term-text">{a.title}</div>
                    <div className="text-2xs text-term-text-dim">{a.detail}</div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    {a.metric && <span className="tnum text-2xs font-semibold text-term-amber">{a.metric}</span>}
                    <button
                      className={`term-btn ${ackd ? "term-btn-active" : ""}`}
                      onClick={() => setAcked((m) => ({ ...m, [a.id]: !ackd }))}
                    >
                      {ackd ? "Unack" : "ACK"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>

        {/* Side panels */}
        <div className="flex flex-col gap-2">
          <Panel title="Alert Volume by Category" code="VOL">
            <div className="p-2">
              <BarChart data={volByCat} horizontal fmt={(n) => String(Math.round(n))} />
            </div>
          </Panel>

          <Panel title="Severity Breakdown" code="SEV">
            <div className="flex flex-col gap-2 p-2">
              {SEVERITIES.map((s) => (
                <div key={s} className="flex flex-col gap-1">
                  <div className="flex items-center justify-between text-2xs">
                    <span className="font-semibold" style={{ color: SEV_COLOR[s] }}>
                      {s}
                    </span>
                    <span className="tnum text-term-text-dim">{sevCount(s)}</span>
                  </div>
                  <ProgressBar value={sevCount(s)} max={all.length} color={SEV_COLOR[s]} height={6} />
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="Alert Rules Engine" code="RULES">
            <div className="flex flex-col divide-y divide-term-border">
              {RULE_GROUPS.map((g) => (
                <div key={g.category} className="p-2">
                  <div className="mb-1 flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full" style={{ background: CAT_COLOR[g.category] }} />
                    <span className="text-2xs font-semibold text-term-text-dim">{CATEGORY_LABEL[g.category]}</span>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    {g.rules.map((r) => {
                      const key = `${g.category}:${r}`;
                      const on = rules[key];
                      return (
                        <button
                          key={key}
                          onClick={() => setRules((m) => ({ ...m, [key]: !on }))}
                          className="flex items-center justify-between px-1 py-0.5 text-left text-2xs hover:bg-term-panel-2"
                        >
                          <span className="text-term-text-dim">{r}</span>
                          <Tag tone={on ? "up" : "neutral"}>{on ? "ON" : "OFF"}</Tag>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
