
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import { Play, Pause, RotateCcw, Plus, X, Search } from "lucide-react";
import { PageHeader, KpiStrip } from "@/components/ui/PageHeader";
import { Panel, Stat, Tag } from "@/components/ui/Panel";
import { ProvenanceBadge } from "@/components/ui/ProvenanceBadge";
import { ChartCanvas } from "@/components/charting/ChartCanvas";
import { useChartSeries } from "@/lib/charting/resolver";
import { RANGE_PRESETS, SERIES_COLORS, type RangePreset, type SeriesRef } from "@/lib/charting/spec";
import { TRANSFORMS, TRANSFORM_LABELS, transformFmt, type Transform } from "@/lib/charting/transforms";
import { US_RECESSIONS } from "@/lib/charting/recessions";
import { MACRO_CATALOG, type CatalogItem } from "@/data/chartCatalog";

type Mode = "race" | "trace";
const SPEEDS = [0.5, 1, 2, 4];
const MAX_SERIES = 8;
const FULL_DURATION_MS = 14_000; // wall-clock for a full timeline at 1x

const DEFAULT_REFS: SeriesRef[] = [
  { source: "econ", id: "CPIAUCSL" },
  { source: "econ", id: "PCEPI" },
  { source: "econ", id: "PAYEMS" },
  { source: "econ", id: "INDPRO" },
  { source: "econ", id: "RSAFS" },
];

function refKey(r: SeriesRef) {
  return `${r.source}:${r.id}`;
}

/** `MOTN` — animates user-selected economic series over time (race + trace). */
export function MotionStudio() {
  const [refs, setRefs] = useState<SeriesRef[]>(DEFAULT_REFS);
  const [range, setRange] = useState<RangePreset>("MAX");
  const [transform, setTransform] = useState<Transform>("index100");
  const [mode, setMode] = useState<Mode>("race");
  const [trail, setTrail] = useState(true);
  const [query, setQuery] = useState("");

  // Playback
  const [frac, setFrac] = useState(0); // 0..1 across the visible timeline
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const rafRef = useRef<number | undefined>(undefined);
  const lastRef = useRef<number | undefined>(undefined);

  const { axis, series, loading } = useChartSeries(refs, range, transform);
  const byId = useMemo(() => new Map(MACRO_CATALOG.map((c) => [c.id, c])), []);
  const n = axis.length;
  const frame = n > 0 ? Math.min(n - 1, Math.round(frac * (n - 1))) : 0;

  // Animation loop
  useEffect(() => {
    if (!playing) return;
    const step = (ts: number) => {
      if (lastRef.current == null) lastRef.current = ts;
      const dt = ts - lastRef.current;
      lastRef.current = ts;
      setFrac((f) => {
        const nf = f + (dt * speed) / FULL_DURATION_MS;
        if (nf >= 1) return 1;
        return nf;
      });
      rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      lastRef.current = undefined;
    };
  }, [playing, speed]);

  // Stop at the end.
  useEffect(() => {
    if (frac >= 1 && playing) setPlaying(false);
  }, [frac, playing]);

  // Reset the playhead whenever the dataset changes shape.
  useEffect(() => {
    setFrac(0);
    setPlaying(false);
  }, [range, transform, refs.length]);

  const togglePlay = () => {
    if (frac >= 1) setFrac(0);
    setPlaying((p) => !p);
  };
  const reset = () => {
    setPlaying(false);
    setFrac(0);
  };

  const results = useMemo(() => {
    const q = query.trim().toUpperCase();
    if (!q) return [];
    return MACRO_CATALOG.filter(
      (c) => c.id.toUpperCase().includes(q) || c.label.toUpperCase().includes(q) || (c.sub ?? "").toUpperCase().includes(q)
    ).slice(0, 8);
  }, [query]);

  const addRef = (item: CatalogItem) => {
    const ref: SeriesRef = { source: item.source, id: item.id };
    setRefs((prev) => (prev.some((r) => refKey(r) === refKey(ref)) || prev.length >= MAX_SERIES ? prev : [...prev, ref]));
    setQuery("");
  };
  const removeRef = (r: SeriesRef) => setRefs((prev) => prev.filter((x) => refKey(x) !== refKey(r)));

  const fmt = transformFmt(transform);
  const labelFor = useCallback((r: SeriesRef) => byId.get(r.id)?.label ?? r.id, [byId]);
  const colorFor = (i: number) => SERIES_COLORS[i % SERIES_COLORS.length];

  // First non-null value of a series within the window — the "start" for deltas.
  const startOf = (vals: (number | null)[]) => vals.find((v) => v != null) ?? null;

  // ── Race rows: current value + since-start delta, ranked ─────────────────────
  const rows = series.map((s, i) => {
    const value = s.values[frame] ?? null;
    const start = startOf(s.values);
    const deltaPct = value != null && start != null && start !== 0 ? (value / start - 1) * 100 : null;
    return {
      id: s.ref.id,
      label: labelFor(s.ref),
      sub: byId.get(s.ref.id)?.sub ?? "",
      color: colorFor(i),
      source: s.source,
      value,
      deltaPct,
    };
  });
  const ranked = [...rows].filter((r) => r.value != null).sort((a, b) => (b.value as number) - (a.value as number));
  const rankById = new Map(ranked.map((r, rank) => [r.id, rank]));
  const maxAbs = Math.max(1, ...ranked.map((r) => Math.abs(r.value as number)));
  const rowH = 38;

  // ── Trace series: reveal each series only up to the playhead ─────────────────
  // With Trail on, a faint full-path "ghost" is drawn under the bright revealed
  // line so you can see the whole trajectory the line is filling in. Ghosts also
  // keep the y-axis stable (their full range is in the extent) so the revealed
  // line doesn't rescale as it plays.
  const revealedSeries = series.map((s, i) => ({
    label: labelFor(s.ref),
    color: colorFor(i),
    values: s.values.map((v, idx) => (idx <= frame ? v : null)),
  }));
  const ghostSeries = trail
    ? series.map((s, i) => ({ label: labelFor(s.ref), color: colorFor(i), values: s.values, ghost: true }))
    : [];
  const traceSeries = [...ghostSeries, ...revealedSeries];

  const sources = Array.from(new Set(series.map((s) => s.source)));
  const currentDate = axis[frame] ?? "—";
  const progressPct = n > 1 ? (frame / (n - 1)) * 100 : 0;
  const btn = "rounded-sm border px-2 py-0.5 text-3xs font-semibold uppercase tracking-wide transition-colors";

  return (
    <div className="flex min-h-full flex-col">
      <PageHeader
        code="MOTN"
        title="Macro Motion Studio"
        desc="Animate economic series over time"
        right={<span className="flex items-center gap-1">{sources.map((s) => <ProvenanceBadge key={s} source={s} />)}</span>}
      />

      <KpiStrip>
        <Stat label="As Of" value={currentDate} sub={`frame ${frame + 1} / ${n || "—"}`} tone="amber" />
        <Stat label="Series" value={refs.length} sub={`of ${MAX_SERIES} max`} />
        <Stat label="Mode" value={mode === "race" ? "Bar race" : "Trace"} sub="animation" />
        <Stat label="Transform" value={TRANSFORM_LABELS[transform]} sub={transform === "none" ? "native units" : "applied"} tone={transform === "none" ? "neutral" : "amber"} />
        <Stat label="Speed" value={`${speed}×`} sub={playing ? "playing" : "paused"} tone={playing ? "up" : "neutral"} />
        <Stat label="Progress" value={`${progressPct.toFixed(0)}%`} sub={loading ? "loading…" : "timeline"} />
      </KpiStrip>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 border-b border-term-border bg-term-panel px-3 py-1.5">
        {/* Series search */}
        <div className="relative">
          <div className="flex items-center gap-1 rounded-sm border border-term-border bg-term-panel-2 px-2">
            <Search className="h-3 w-3 text-term-text-mute" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Add series…"
              className="h-6 w-40 bg-transparent text-2xs text-term-text outline-none placeholder:text-term-text-mute"
            />
          </div>
          {results.length > 0 && (
            <div className="absolute z-20 mt-1 max-h-72 w-64 overflow-auto rounded-sm border border-term-border bg-term-panel shadow-xl">
              {results.map((c) => (
                <button key={`${c.source}:${c.id}`} onClick={() => addRef(c)} className="flex w-full items-center justify-between gap-2 px-2 py-1 text-left text-2xs hover:bg-term-panel-3">
                  <span className="flex items-center gap-1.5">
                    <Plus className="h-3 w-3 text-term-amber" />
                    <span className="w-14 font-semibold text-term-text">{c.label}</span>
                    <span className="truncate text-term-text-mute">{c.sub}</span>
                  </span>
                  <Tag tone="neutral">{c.group}</Tag>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Mode toggle */}
        <div className="flex gap-1">
          {(["race", "trace"] as Mode[]).map((m) => (
            <button key={m} onClick={() => setMode(m)} className={clsx(btn, mode === m ? "border-term-amber bg-term-amber text-black" : "border-term-border bg-term-panel-2 text-term-text-mute hover:text-term-text")}>
              {m === "race" ? "Bar Race" : "Trace"}
            </button>
          ))}
        </div>

        {/* Trail toggle (trace only) */}
        {mode === "trace" && (
          <button onClick={() => setTrail((v) => !v)} className={clsx(btn, trail ? "border-term-amber bg-term-amber/15 text-term-amber" : "border-term-border bg-term-panel-2 text-term-text-mute hover:text-term-text")}>
            Trail
          </button>
        )}

        {/* Range */}
        <div className="flex flex-wrap gap-1">
          {RANGE_PRESETS.map((r) => (
            <button key={r} onClick={() => setRange(r)} className={clsx(btn, range === r ? "border-term-amber bg-term-amber text-black" : "border-term-border bg-term-panel-2 text-term-text-mute hover:text-term-text")}>
              {r}
            </button>
          ))}
        </div>

        {/* Transform */}
        <select value={transform} onChange={(e) => setTransform(e.target.value as Transform)} className="h-6 rounded-sm border border-term-border bg-term-panel-2 px-1.5 text-2xs text-term-text outline-none focus:border-term-amber">
          {TRANSFORMS.map((t) => <option key={t} value={t}>{TRANSFORM_LABELS[t]}</option>)}
        </select>
      </div>

      {/* Transport controls */}
      <div className="flex items-center gap-3 border-b border-term-border bg-term-panel-2 px-3 py-2">
        <button onClick={togglePlay} className="flex h-8 w-8 items-center justify-center rounded-sm border border-term-amber bg-term-amber text-black transition-opacity hover:opacity-90" aria-label={playing ? "Pause" : "Play"}>
          {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </button>
        <button onClick={reset} className="flex h-8 w-8 items-center justify-center rounded-sm border border-term-border bg-term-panel text-term-text-mute hover:text-term-text" aria-label="Reset">
          <RotateCcw className="h-3.5 w-3.5" />
        </button>

        {/* Scrubber */}
        <input
          type="range"
          min={0}
          max={1000}
          value={Math.round(frac * 1000)}
          onChange={(e) => { setPlaying(false); setFrac(Number(e.target.value) / 1000); }}
          className="h-1 flex-1 cursor-pointer accent-term-amber"
          aria-label="Timeline scrubber"
        />

        <span className="tnum w-24 text-right text-2xs font-semibold text-term-amber">{currentDate}</span>

        {/* Speed */}
        <div className="flex gap-1">
          {SPEEDS.map((s) => (
            <button key={s} onClick={() => setSpeed(s)} className={clsx(btn, speed === s ? "border-term-amber bg-term-amber/15 text-term-amber" : "border-term-border bg-term-panel text-term-text-mute hover:text-term-text")}>
              {s}×
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-2 p-2">
        <Panel title={mode === "race" ? "Series Race" : "Series Trace"} code="MOTN" accent>
          {refs.length === 0 ? (
            <div className="flex h-72 items-center justify-center text-2xs text-term-text-mute">Add a series to begin.</div>
          ) : mode === "race" ? (
            <div className="relative p-3" style={{ height: Math.max(120, series.length * rowH + 8) }}>
              {rows.map((r) => {
                const rank = rankById.get(r.id);
                const visible = rank != null && r.value != null;
                const width = visible ? (Math.abs(r.value as number) / maxAbs) * 100 : 0;
                return (
                  <div
                    key={r.id}
                    className="absolute left-3 right-3 flex items-center gap-2"
                    style={{ top: 4, height: rowH - 6, transform: `translateY(${(rank ?? series.length) * rowH}px)`, transition: "transform 0.45s cubic-bezier(0.4,0,0.2,1), opacity 0.3s", opacity: visible ? 1 : 0.25 }}
                  >
                    <span className="w-16 shrink-0 truncate text-right text-2xs font-semibold text-term-text">{r.label}</span>
                    <div className="relative h-full flex-1 overflow-hidden rounded-sm bg-term-panel-2">
                      <div className="absolute inset-y-0 left-0 rounded-sm" style={{ width: `${width}%`, background: r.color, transition: "width 0.45s cubic-bezier(0.4,0,0.2,1)", opacity: 0.85 }} />
                      <span className="absolute inset-y-0 left-2 flex items-center text-3xs font-semibold text-white/90 mix-blend-difference">{r.sub}</span>
                    </div>
                    <span className="tnum w-16 shrink-0 text-right text-2xs font-semibold text-term-text">{r.value == null ? "—" : fmt(r.value as number)}</span>
                    <span
                      className={clsx("tnum w-16 shrink-0 text-right text-2xs font-semibold", r.deltaPct == null ? "text-term-text-mute" : r.deltaPct >= 0 ? "text-term-up" : "text-term-down")}
                      title="Change since the start of the visible window"
                    >
                      {r.deltaPct == null ? "—" : `${r.deltaPct >= 0 ? "▲ +" : "▼ "}${r.deltaPct.toFixed(1)}%`}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-2">
              <ChartCanvas axis={axis} series={traceSeries} height={360} yFmt={fmt} recessions={transform === "none" || transform === "index100" ? US_RECESSIONS : undefined} />
            </div>
          )}

          {/* Legend */}
          <div className="flex flex-wrap gap-1.5 border-t border-term-border px-2 py-1.5">
            {series.map((s, i) => (
              <span key={refKey(s.ref)} className="flex items-center gap-1 rounded-sm border border-term-border bg-term-panel-2 px-1.5 py-0.5 text-2xs">
                <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: colorFor(i) }} />
                <span className="font-semibold text-term-text">{labelFor(s.ref)}</span>
                <ProvenanceBadge source={s.source} />
                <button onClick={() => removeRef(s.ref)} className="text-term-text-mute hover:text-term-down" aria-label="remove">
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        </Panel>
      </div>

      <div className="border-t border-term-border bg-term-panel px-3 py-1.5 text-3xs text-term-text-mute">
        <span className="text-term-amber">Macro Motion</span> — press play to animate the selected series across the visible window.
        {" "}Bar Race ranks series by their current value; Trace draws each series progressively. Index = 100 makes growth comparable across series.
      </div>
    </div>
  );
}
