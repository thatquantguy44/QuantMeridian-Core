
import clsx from "clsx";
import { useState } from "react";
import { PageHeader, KpiStrip } from "@/components/ui/PageHeader";
import { Panel, Stat, Tag } from "@/components/ui/Panel";
import { DataGrid, type Column } from "@/components/ui/DataGrid";
import { YieldCurve, type CurveLine } from "@/components/charts/YieldCurve";
import { MarketDataControls } from "@/components/market/MarketDataControls";
import { useMarketView, type MarketSource } from "@/lib/useMarket";
import { ProvenanceBadge } from "@/components/ui/ProvenanceBadge";
import {
  marketSnapshot as snapFallback,
  crossAsset as caFallback,
  ratesView as ratesFallback,
  regimeView as regimeFallback,
  bilelloView as bilelloFallback,
  type SnapshotCard,
  type CrossAsset,
  type CrossAssetItem,
  type RatesView,
  type RegimeView,
  type BilelloView,
  type ReturnBasis,
} from "@/data/marketPipeline";
import { fmtNum, fmtSignedPct, fmtBps, pnlClass } from "@/lib/format";

/** decimal return (0.0123) → coloured +1.23% */
function Pct({ v, dp = 2 }: { v: number | null; dp?: number }) {
  if (v === null || v === undefined || !isFinite(v)) return <span className="text-term-flat">—</span>;
  return <span className={pnlClass(v)}>{fmtSignedPct(v * 100, dp)}</span>;
}

function PipeBadge({ source, asOf }: { source: MarketSource; asOf?: string | null }) {
  return <ProvenanceBadge source={source} asOf={asOf} />;
}

const TENOR_MONTHS: Record<string, number> = { "3M": 3, "2Y": 24, "5Y": 60, "10Y": 120, "30Y": 360 };

const regimeTone = (label: string): "up" | "down" | "neutral" | "amber" => {
  const l = label.toUpperCase();
  if (["RISK-ON", "EXPANSION", "EASY", "LOOSE", "DISINFLATION"].some((k) => l.includes(k))) return "up";
  if (["RISK-OFF", "CONTRACTION", "TIGHT", "HIGH", "RECESSION"].some((k) => l.includes(k))) return "down";
  if (["MODERATE", "RISING"].some((k) => l.includes(k))) return "amber";
  return "neutral";
};

export default function MarketSnapshotPage() {
  const [basis, setBasis] = useState<ReturnBasis>("total");
  const [asof, setAsOf] = useState("");
  const { data: snapData, source, earliestAsOf } = useMarketView<{ return_basis?: ReturnBasis; cards: SnapshotCard[] }>("market", basis, asof);
  const { data: ca } = useMarketView<CrossAsset>("cross-asset", basis, asof);
  const { data: rates } = useMarketView<RatesView>("rates");
  const { data: regime } = useMarketView<RegimeView>("regime", basis);
  const { data: bilello } = useMarketView<BilelloView>("bilello", basis, asof);

  const cards = snapData?.cards ?? snapFallback;
  const dataAsOf = cards[0]?.asof ?? ca?.asof ?? null;
  const cross = ca ?? caFallback;
  const rv = rates ?? ratesFallback;
  const reg = regime ?? regimeFallback;
  const bil = bilello ?? bilelloFallback;

  // yield curve from the rates view
  const curveLine: CurveLine = {
    label: "Treasury Curve",
    color: "#FF8C00",
    points: rv.curve
      .filter((p) => p.yield !== null && TENOR_MONTHS[p.tenor])
      .map((p) => ({ months: TENOR_MONTHS[p.tenor], tenor: p.tenor, yield: p.yield as number })),
  };

  const columns: Column<SnapshotCard>[] = [
    { key: "name", header: "Asset", sortVal: (r) => r.display_name, render: (r) => (
      <span className="flex items-center gap-1.5">
        <span className="font-semibold text-term-text">{r.series_id}</span>
        <span className="truncate text-term-text-mute">{r.display_name}</span>
      </span>
    )},
    { key: "class", header: "Class", align: "center", sortVal: (r) => r.asset_class, render: (r) => <Tag tone="neutral">{r.asset_class}</Tag> },
    { key: "asof", header: "As Of", align: "center", sortVal: (r) => r.asof ?? "", render: (r) => <span className="tnum text-term-text-mute">{r.asof ?? "—"}</span> },
    { key: "price", header: "Price", align: "right", sortVal: (r) => r.price ?? 0, render: (r) => <span className="tnum text-term-amber">{r.price !== null ? fmtNum(r.price, 2) : "—"}</span> },
    { key: "d1", header: "1D", align: "right", sortVal: (r) => r.ret_1d ?? 0, render: (r) => <Pct v={r.ret_1d} /> },
    { key: "d5", header: "5D", align: "right", sortVal: (r) => r.ret_5d ?? 0, render: (r) => <Pct v={r.ret_5d} /> },
    { key: "mtd", header: "MTD", align: "right", sortVal: (r) => r.mtd ?? 0, render: (r) => <Pct v={r.mtd} /> },
    { key: "ytd", header: "YTD", align: "right", sortVal: (r) => r.ytd ?? 0, render: (r) => <Pct v={r.ytd} /> },
    { key: "y1", header: "1Y", align: "right", sortVal: (r) => r.ret_1y ?? 0, render: (r) => <Pct v={r.ret_1y} /> },
    { key: "c3", header: "3Y a.", align: "right", sortVal: (r) => r.cagr_3y ?? 0, render: (r) => <Pct v={r.cagr_3y} /> },
    { key: "c5", header: "5Y a.", align: "right", sortVal: (r) => r.cagr_5y ?? 0, render: (r) => <Pct v={r.cagr_5y} /> },
    { key: "dd", header: "Max DD", align: "right", sortVal: (r) => r.max_drawdown ?? 0, render: (r) => <Pct v={r.max_drawdown} /> },
    { key: "h52", header: "vs 52wH", align: "right", sortVal: (r) => r.pct_from_52w_high ?? 0, render: (r) => <Pct v={r.pct_from_52w_high} /> },
  ];

  const buckets: [string, CrossAssetItem[]][] = [
    ["Equities", cross.equities], ["Bonds", cross.bonds], ["Commodities", cross.commodities],
    ["Credit", cross.credit], ["Volatility", cross.volatility], ["Currencies", cross.currencies],
  ];

  const s2s10 = rv.spreads?.two_s_ten_s_bps ?? null;
  const s3m10 = rv.spreads?.three_m_ten_y_bps ?? null;

  return (
    <div className="flex min-h-full flex-col">
      <PageHeader
        code="SNAP"
        title="Market Snapshot"
        desc="Cross-asset state of the market — market_data_pipeline"
        asOf={asof || dataAsOf || rv.asof || cross.asof || null}
        right={<span className="flex items-center gap-2"><MarketDataControls basis={basis} onBasisChange={setBasis} asof={asof} onAsOfChange={setAsOf} latestAsOf={dataAsOf} earliestAsOf={earliestAsOf} /><PipeBadge source={source} asOf={dataAsOf} /></span>}
      />

      <KpiStrip>
        <Stat label="Regime" value={reg.composite.label} sub={`score ${fmtNum(reg.composite.score, 0)}`} tone={regimeTone(reg.composite.label)} />
        <Stat label="Risk On/Off" value={reg.risk_on_off.label} sub={`${fmtNum(reg.risk_on_off.score, 0)}`} tone={regimeTone(reg.risk_on_off.label)} />
        <Stat label="Growth Momentum" value={reg.growth_momentum.label} sub={`${fmtNum(reg.growth_momentum.score, 0)}`} tone={regimeTone(reg.growth_momentum.label)} />
        <Stat label="Inflation Pressure" value={reg.inflation_pressure.label} sub={`${fmtNum(reg.inflation_pressure.score, 0)}`} tone={regimeTone(reg.inflation_pressure.label)} />
        <Stat label="Liquidity" value={reg.liquidity.label} sub={`${fmtNum(reg.liquidity.score, 0)}`} tone={regimeTone(reg.liquidity.label)} />
        <Stat label="2s10s" value={s2s10 !== null ? fmtBps(s2s10) : "—"} sub="curve slope" tone={s2s10 !== null && s2s10 < 0 ? "down" : "amber"} />
      </KpiStrip>

      <div className="border-b border-term-border bg-term-panel px-3 py-1 text-3xs text-term-text-mute">{reg.narrative}</div>

      <div className="grid flex-1 grid-cols-1 gap-2 p-2 xl:grid-cols-3">
        {/* Market snapshot table */}
        <Panel
          title="Market Snapshot — Returns & Drawdowns"
          code="RETURNS"
          className="xl:col-span-2"
          accent
          right={<span className="text-3xs text-term-text-mute">{source} · {basis === "total" ? "adjusted close" : "raw close"} · {asof || dataAsOf || "latest"}</span>}
        >
          <DataGrid columns={columns} rows={cards} rowKey={(r) => r.series_id} maxHeight="520px" initialSort={{ key: "ytd", dir: "desc" }} />
        </Panel>

        {/* Right rail: regime + curve */}
        <div className="flex flex-col gap-2">
          <Panel title="Treasury Curve" code="CURVE">
            <div className="p-2">
              <YieldCurve lines={[curveLine]} height={170} />
              <div className="mt-2 grid grid-cols-2 gap-px bg-term-border text-2xs">
                <div className="bg-term-panel p-2">
                  <div className="text-3xs uppercase tracking-wider text-term-text-mute">2s10s</div>
                  <div className={clsx("tnum font-semibold", s2s10 !== null && s2s10 < 0 ? "text-term-down" : "text-term-amber")}>{s2s10 !== null ? fmtBps(s2s10) : "—"}</div>
                </div>
                <div className="bg-term-panel p-2">
                  <div className="text-3xs uppercase tracking-wider text-term-text-mute">3m10y</div>
                  <div className={clsx("tnum font-semibold", s3m10 !== null && s3m10 < 0 ? "text-term-down" : "text-term-amber")}>{s3m10 !== null ? fmtBps(s3m10) : "—"}</div>
                </div>
              </div>
            </div>
          </Panel>

          <Panel title="Best / Worst YTD" code="MOVERS">
            <div className="grid grid-cols-2 gap-px bg-term-border">
              <div className="bg-term-panel p-2">
                <div className="mb-1 text-3xs uppercase tracking-wider text-term-up">Leaders</div>
                {bil.best_worst_ytd.best.slice(0, 6).map((r) => (
                  <div key={r.series_id} className="flex items-center justify-between py-px text-2xs">
                    <span className="truncate text-term-text-dim" title={r.display_name}>{r.series_id}</span>
                    <span className="tnum text-term-up">{fmtSignedPct(r.ytd * 100, 1)}</span>
                  </div>
                ))}
              </div>
              <div className="bg-term-panel p-2">
                <div className="mb-1 text-3xs uppercase tracking-wider text-term-down">Laggards</div>
                {bil.best_worst_ytd.worst.slice(0, 6).map((r) => (
                  <div key={r.series_id} className="flex items-center justify-between py-px text-2xs">
                    <span className="truncate text-term-text-dim" title={r.display_name}>{r.series_id}</span>
                    <span className="tnum text-term-down">{fmtSignedPct(r.ytd * 100, 1)}</span>
                  </div>
                ))}
              </div>
            </div>
          </Panel>
        </div>

        {/* Cross-asset dashboard */}
        <Panel title="Cross-Asset Dashboard" code="XASSET" className="xl:col-span-3">
          <div className="grid grid-cols-2 gap-px bg-term-border md:grid-cols-3 xl:grid-cols-6">
            {buckets.map(([name, items]) => (
              <div key={name} className="bg-term-panel p-2">
                <div className="mb-1 text-3xs uppercase tracking-wider text-term-amber">{name}</div>
                <div className="flex flex-col gap-0.5">
                  {items.length === 0 && <span className="text-3xs text-term-text-mute">—</span>}
                  {items.map((it) => (
                    <div key={it.series_id} className="flex items-center gap-1 text-2xs">
                      <span className="w-9 font-semibold text-term-text">{it.series_id}</span>
                      <span className="tnum ml-auto w-16 text-right"><Pct v={it.ytd} dp={1} /></span>
                      <span className="tnum w-16 text-right text-term-text-mute"><Pct v={it.ret_1y} dp={1} /></span>
                    </div>
                  ))}
                  <div className="mt-0.5 flex items-center gap-1 text-3xs text-term-text-mute">
                    <span className="ml-auto w-16 text-right">YTD</span><span className="w-16 text-right">1Y</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <div className="border-t border-term-border bg-term-panel px-3 py-1.5 text-3xs text-term-text-mute">
        Served by the <span className="text-violet-300">market_data_pipeline</span> (FRED official macro · Yahoo prototype market · pluggable vendors). Return basis: <span className="text-term-amber">{basis === "total" ? "total return / adjusted close" : "price return / raw close"}</span>; CAGR annualized.
      </div>
    </div>
  );
}
