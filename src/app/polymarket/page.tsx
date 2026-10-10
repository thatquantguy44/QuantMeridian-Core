import { useMemo, useState } from "react";
import clsx from "clsx";
import { PageHeader, KpiStrip } from "@/components/ui/PageHeader";
import { Panel, Stat, Tag } from "@/components/ui/Panel";
import { ProvenanceBadge } from "@/components/ui/ProvenanceBadge";
import { DataGrid, type Column } from "@/components/ui/DataGrid";
import { Sparkline } from "@/components/charts/Sparkline";
import { LineChart } from "@/components/charts/LineChart";
import { BarChart } from "@/components/charts/BarChart";
import { usePolymarkets, usePolyEvents, usePolyHistory } from "@/lib/usePolymarket";
import { fmtUsdAbbr, fmtSignedPct, fmtPct, pnlClass } from "@/lib/format";
import type { PolyMarket, PolyEvent, PolyCategory } from "@/data/polymarket";
import { getPolyCategories } from "@/data/polymarket";

type View = "BOARD" | "EVENTS" | "MOVERS" | "CATEGORY";
const VIEWS: { key: View; label: string }[] = [
  { key: "BOARD", label: "Markets" },
  { key: "EVENTS", label: "Events" },
  { key: "MOVERS", label: "Movers" },
  { key: "CATEGORY", label: "Categories" },
];

const CAT_COLORS: Record<PolyCategory, string> = {
  Politics: "#FF8C00",
  Crypto: "#F7931A",
  Economics: "#2ECC71",
  Sports: "#3498DB",
  Science: "#9B59B6",
  Culture: "#E91E8A",
  Tech: "#00D4FF",
  Climate: "#27AE60",
};

const CAT_TONE: Record<PolyCategory, "amber" | "up" | "blue" | "violet" | "neutral"> = {
  Politics: "amber",
  Crypto: "amber",
  Economics: "up",
  Sports: "blue",
  Science: "violet",
  Culture: "violet",
  Tech: "blue",
  Climate: "up",
};

function ProbBar({ prob }: { prob: number }) {
  const pct = prob * 100;
  const color = pct >= 50 ? "#2ECC71" : "#FF3B3B";
  return (
    <div className="flex items-center gap-2">
      <div className="relative h-2.5 w-16 rounded-sm bg-term-panel-3">
        <div
          className="absolute inset-y-0 left-0 rounded-sm"
          style={{ width: `${pct}%`, background: color, opacity: 0.8 }}
        />
      </div>
      <span className="tnum text-xs font-semibold" style={{ color }}>{pct.toFixed(0)}%</span>
    </div>
  );
}

function MarketDetail({ market }: { market: PolyMarket }) {
  const { data: history } = usePolyHistory(market.id, 90);
  const prices = history.map((p) => p.price * 100);
  const labels = history.map((p) => p.date.slice(5));

  return (
    <div className="flex flex-col gap-3 p-3">
      <div className="text-sm font-semibold text-term-text">{market.question}</div>
      <div className="flex flex-wrap gap-2">
        <Tag tone={CAT_TONE[market.category]}>{market.category}</Tag>
        <Tag tone={market.chg24h >= 0 ? "up" : "down"}>
          24h {fmtSignedPct(market.chg24h * 100, 1)}
        </Tag>
        <Tag tone="neutral">Ends {market.endDate}</Tag>
      </div>

      <Panel title="Probability History" code="PROB">
        <LineChart
          series={[{ name: "Yes", data: prices, color: "#2ECC71", area: true }]}
          height={200}
          labels={labels}
          yFmt={(n) => `${n.toFixed(0)}%`}
        />
      </Panel>

      <div className="grid grid-cols-2 gap-2">
        <div className="rounded border border-term-border bg-term-panel-2 p-2">
          <div className="term-label">Yes Price</div>
          <div className="tnum text-lg font-bold text-term-up">{fmtPct(market.yesPrice * 100, 1)}</div>
        </div>
        <div className="rounded border border-term-border bg-term-panel-2 p-2">
          <div className="term-label">No Price</div>
          <div className="tnum text-lg font-bold text-term-down">{fmtPct(market.noPrice * 100, 1)}</div>
        </div>
        <div className="rounded border border-term-border bg-term-panel-2 p-2">
          <div className="term-label">24h Volume</div>
          <div className="tnum text-sm font-semibold text-term-text">{fmtUsdAbbr(market.volume24h)}</div>
        </div>
        <div className="rounded border border-term-border bg-term-panel-2 p-2">
          <div className="term-label">Liquidity</div>
          <div className="tnum text-sm font-semibold text-term-text">{fmtUsdAbbr(market.liquidity)}</div>
        </div>
        <div className="rounded border border-term-border bg-term-panel-2 p-2">
          <div className="term-label">Spread</div>
          <div className="tnum text-sm font-semibold text-term-text">{(market.spread * 100).toFixed(1)}c</div>
        </div>
        <div className="rounded border border-term-border bg-term-panel-2 p-2">
          <div className="term-label">Total Volume</div>
          <div className="tnum text-sm font-semibold text-term-text">{fmtUsdAbbr(market.totalVolume)}</div>
        </div>
      </div>
    </div>
  );
}

function BoardView({ markets, selected, onSelect }: { markets: PolyMarket[]; selected: PolyMarket | null; onSelect: (m: PolyMarket) => void }) {
  const cols: Column<PolyMarket>[] = [
    {
      key: "question",
      header: "Contract",
      width: "320px",
      render: (r) => <span className="text-term-text" title={r.question}>{r.question.length > 55 ? `${r.question.slice(0, 55)}...` : r.question}</span>,
      sortVal: (r) => r.question,
    },
    {
      key: "category",
      header: "Cat",
      width: "80px",
      render: (r) => <Tag tone={CAT_TONE[r.category]}>{r.category}</Tag>,
      sortVal: (r) => r.category,
    },
    {
      key: "prob",
      header: "Prob",
      width: "120px",
      align: "right",
      render: (r) => <ProbBar prob={r.yesPrice} />,
      sortVal: (r) => r.yesPrice,
    },
    {
      key: "chg",
      header: "24h Chg",
      width: "80px",
      align: "right",
      render: (r) => <span className={pnlClass(r.chg24h)}>{fmtSignedPct(r.chg24h * 100, 1)}</span>,
      sortVal: (r) => r.chg24h,
    },
    {
      key: "vol",
      header: "24h Vol",
      width: "90px",
      align: "right",
      render: (r) => <span className="text-term-text-dim">{fmtUsdAbbr(r.volume24h)}</span>,
      sortVal: (r) => r.volume24h,
    },
    {
      key: "spread",
      header: "Spread",
      width: "70px",
      align: "right",
      render: (r) => <span className="text-term-text-dim">{(r.spread * 100).toFixed(1)}c</span>,
      sortVal: (r) => r.spread,
    },
    {
      key: "spark",
      header: "30d",
      width: "90px",
      align: "center",
      render: (r) => <Sparkline data={r.spark} width={80} height={20} />,
    },
    {
      key: "end",
      header: "Ends",
      width: "90px",
      render: (r) => <span className="text-term-text-mute">{r.endDate}</span>,
      sortVal: (r) => r.endDate,
    },
  ];

  return (
    <DataGrid
      columns={cols}
      rows={markets}
      rowKey={(r) => r.id}
      onRowClick={onSelect}
      selectedKey={selected?.id}
      initialSort={{ key: "vol", dir: "desc" }}
      maxHeight="calc(100vh - 220px)"
    />
  );
}

function EventsView({ events, onSelect }: { events: PolyEvent[]; onSelect: (m: PolyMarket) => void }) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const toggle = (id: string) => setExpanded((s) => {
    const next = new Set(s);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  return (
    <div className="flex flex-col gap-1 p-2">
      {events.map((evt) => (
        <div key={evt.id} className="border border-term-border bg-term-panel">
          <button
            onClick={() => toggle(evt.id)}
            className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-term-panel-2"
          >
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-term-text">{evt.title}</span>
              <Tag tone={CAT_TONE[evt.category]}>{evt.category}</Tag>
              <span className="text-2xs text-term-text-mute">{evt.markets.length} contracts</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="tnum text-2xs text-term-text-dim">{fmtUsdAbbr(evt.totalVolume)} vol</span>
              <span className="text-term-text-mute">{expanded.has(evt.id) ? "▼" : "▶"}</span>
            </div>
          </button>
          {expanded.has(evt.id) && (
            <div className="border-t border-term-border">
              {evt.markets.map((m) => (
                <button
                  key={m.id}
                  onClick={() => onSelect(m)}
                  className="flex w-full items-center justify-between border-b border-term-border-soft px-4 py-1.5 text-left hover:bg-term-panel-2"
                >
                  <span className="min-w-0 flex-1 truncate text-xs text-term-text">{m.question}</span>
                  <div className="flex items-center gap-3">
                    <ProbBar prob={m.yesPrice} />
                    <span className={clsx("tnum text-2xs", pnlClass(m.chg24h))}>{fmtSignedPct(m.chg24h * 100, 1)}</span>
                    <Sparkline data={m.spark} width={60} height={18} />
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function MoversView({ markets, onSelect }: { markets: PolyMarket[]; onSelect: (m: PolyMarket) => void }) {
  const movers = useMemo(
    () => [...markets].sort((a, b) => Math.abs(b.chg24h) - Math.abs(a.chg24h)).slice(0, 16),
    [markets]
  );
  const up = movers.filter((m) => m.chg24h > 0);
  const down = movers.filter((m) => m.chg24h < 0);

  const renderList = (list: PolyMarket[], label: string, tone: "up" | "down") => (
    <Panel title={label} code={tone === "up" ? "UP" : "DN"}>
      <div className="flex flex-col">
        {list.map((m) => (
          <button
            key={m.id}
            onClick={() => onSelect(m)}
            className="flex items-center justify-between border-b border-term-border-soft px-3 py-1.5 text-left hover:bg-term-panel-2"
          >
            <span className="min-w-0 flex-1 truncate text-xs text-term-text">{m.question}</span>
            <div className="flex items-center gap-3">
              <ProbBar prob={m.yesPrice} />
              <span className={clsx("tnum w-16 text-right text-xs font-semibold", pnlClass(m.chg24h))}>
                {fmtSignedPct(m.chg24h * 100, 1)}
              </span>
            </div>
          </button>
        ))}
        {list.length === 0 && <div className="px-3 py-4 text-center text-xs text-term-text-mute">No movers</div>}
      </div>
    </Panel>
  );

  return (
    <div className="grid grid-cols-1 gap-2 p-2 xl:grid-cols-2">
      {renderList(up, "Probability Up", "up")}
      {renderList(down, "Probability Down", "down")}
    </div>
  );
}

function CategoryView() {
  const categories = getPolyCategories();
  const bars = categories.map((c) => ({
    label: c.category,
    value: c.volume,
    color: CAT_COLORS[c.category],
  }));

  return (
    <div className="grid grid-cols-1 gap-2 p-2 xl:grid-cols-2">
      <Panel title="Volume by Category" code="VOL">
        <div className="p-3">
          <BarChart data={bars} horizontal fmt={(n) => fmtUsdAbbr(n)} />
        </div>
      </Panel>
      <Panel title="Market Count by Category" code="CNT">
        <div className="flex flex-col gap-1 p-3">
          {categories.map((c) => (
            <div key={c.category} className="flex items-center justify-between border-b border-term-border-soft py-1.5">
              <div className="flex items-center gap-2">
                <div className="h-2.5 w-2.5 rounded-sm" style={{ background: CAT_COLORS[c.category] }} />
                <span className="text-xs text-term-text">{c.category}</span>
              </div>
              <div className="flex items-center gap-4">
                <span className="tnum text-xs text-term-text-dim">{c.count} markets</span>
                <span className="tnum text-xs font-semibold text-term-text">{fmtUsdAbbr(c.volume)}</span>
              </div>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}

export default function PredictionMarkets() {
  const [view, setView] = useState<View>("BOARD");
  const [selected, setSelected] = useState<PolyMarket | null>(null);
  const { data: markets, source } = usePolymarkets();
  const { data: events } = usePolyEvents();

  const totalVol24h = useMemo(() => markets.reduce((s, m) => s + m.volume24h, 0), [markets]);
  const avgSpread = useMemo(() => {
    if (!markets.length) return 0;
    return (markets.reduce((s, m) => s + m.spread, 0) / markets.length) * 100;
  }, [markets]);
  const topCat = useMemo(() => {
    const cats = getPolyCategories();
    return cats.length ? cats[0].category : "—";
  }, []);

  return (
    <div className="flex min-h-full flex-col">
      <PageHeader
        code="POLY"
        title="Prediction Markets"
        desc="Event contract odds & probability curves"
        right={<ProvenanceBadge source={source} />}
      />

      <KpiStrip>
        <Stat label="Active Markets" value={markets.length} />
        <Stat label="24h Volume" value={fmtUsdAbbr(totalVol24h)} />
        <Stat label="Avg Spread" value={`${avgSpread.toFixed(1)}c`} />
        <Stat label="Top Category" value={topCat} />
        <Stat label="Events" value={events.length} />
        <Stat
          label="Biggest Mover"
          value={markets.length ? fmtSignedPct(
            [...markets].sort((a, b) => Math.abs(b.chg24h) - Math.abs(a.chg24h))[0].chg24h * 100, 1
          ) : "—"}
          tone={markets.length && [...markets].sort((a, b) => Math.abs(b.chg24h) - Math.abs(a.chg24h))[0].chg24h >= 0 ? "up" : "down"}
        />
      </KpiStrip>

      <div className="flex items-center gap-1 border-b border-term-border bg-term-panel-2 px-2 py-1">
        {VIEWS.map((v) => (
          <button
            key={v.key}
            onClick={() => setView(v.key)}
            className={clsx(
              "rounded px-2.5 py-1 text-2xs font-semibold uppercase tracking-wide transition-colors",
              view === v.key
                ? "bg-term-amber/20 text-term-amber"
                : "text-term-text-mute hover:text-term-text"
            )}
          >
            {v.label}
          </button>
        ))}
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-12 gap-0">
        <div className={clsx("min-h-0 overflow-auto", selected ? "col-span-12 xl:col-span-8" : "col-span-12")}>
          {!markets.length && source === "SIM" ? (
            <div className="flex flex-col items-center justify-center gap-2 py-20 text-center">
              <span className="text-sm text-term-text-mute">No live data available</span>
              <span className="text-2xs text-term-text-dim">Polymarket API unreachable — enable SIM mode for simulated data</span>
            </div>
          ) : (
            <>
              {view === "BOARD" && (
                <BoardView markets={markets} selected={selected} onSelect={setSelected} />
              )}
              {view === "EVENTS" && (
                <EventsView events={events} onSelect={setSelected} />
              )}
              {view === "MOVERS" && (
                <MoversView markets={markets} onSelect={setSelected} />
              )}
              {view === "CATEGORY" && <CategoryView />}
            </>
          )}
        </div>

        {selected && (
          <div className="col-span-12 border-l border-term-border xl:col-span-4">
            <div className="flex items-center justify-between border-b border-term-border bg-term-panel-2 px-3 py-1.5">
              <span className="text-2xs font-semibold uppercase tracking-wide text-term-text-mute">Contract Detail</span>
              <button
                onClick={() => setSelected(null)}
                className="text-2xs text-term-text-mute hover:text-term-amber"
              >
                CLOSE
              </button>
            </div>
            <MarketDetail market={selected} />
          </div>
        )}
      </div>
    </div>
  );
}
