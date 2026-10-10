
import { useId, useRef, useState } from "react";

export interface CurveLine {
  label: string;
  color: string;
  points: { months: number; tenor: string; yield: number }[];
  dashed?: boolean;
  dots?: boolean;
}

interface YieldCurveProps {
  lines: CurveLine[];
  height?: number;
  className?: string;
  /** highlight inversion shading where front > back */
  shadeInversion?: boolean;
  /** hover a tenor to see every curve's yield at that point (default true) */
  interactive?: boolean;
}

/**
 * Treasury yield curve chart. X axis is tenor on a log-month scale (so the short
 * end is readable), Y axis is yield %. Supports overlaying multiple snapshots.
 * Hovering a tenor shows a tooltip with every overlaid curve's yield there.
 */
export function YieldCurve({ lines, height = 280, className, shadeInversion, interactive = true }: YieldCurveProps) {
  const id = useId();
  const wrapRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<{ months: number; tenor: string; px: number; py: number } | null>(null);

  const W = 620;
  const H = height;
  const padL = 40;
  const padR = 44;
  const padT = 12;
  const padB = 26;

  const all = lines.flatMap((l) => l.points);
  const maxY = Math.max(...all.map((p) => p.yield)) + 0.3;
  const minY = Math.min(0, ...all.map((p) => p.yield)) - 0.1;
  const months = Array.from(new Set(all.map((p) => p.months))).sort((a, b) => a - b);
  const lx = (m: number) => Math.log(m);
  const minX = lx(Math.min(...months));
  const maxX = lx(Math.max(...months));
  const x = (m: number) => padL + ((lx(m) - minX) / (maxX - minX || 1)) * (W - padL - padR);
  const y = (v: number) => padT + (1 - (v - minY) / (maxY - minY || 1)) * (H - padT - padB);

  const yticks = 5;
  const tenorLabels = lines[0]?.points ?? all;
  const monthTenor = new Map(all.map((p) => [p.months, p.tenor]));

  function onMove(e: React.MouseEvent<HTMLDivElement>) {
    if (!interactive || !wrapRef.current) return;
    const rect = wrapRef.current.getBoundingClientRect();
    const relX = e.clientX - rect.left;
    const relY = e.clientY - rect.top;
    const vbX = (relX / rect.width) * W; // map to viewBox units
    let best = months[0];
    let bd = Infinity;
    for (const m of months) {
      const d = Math.abs(x(m) - vbX);
      if (d < bd) {
        bd = d;
        best = m;
      }
    }
    setHover({ months: best, tenor: monthTenor.get(best) ?? "", px: relX, py: relY });
  }

  // Values for every line at the hovered tenor (for the tooltip + markers).
  const hoverValues =
    hover &&
    lines
      .map((l) => {
        const pt = l.points.find((p) => p.months === hover.months);
        return pt ? { label: l.label, color: l.color, yield: pt.yield } : null;
      })
      .filter((v): v is { label: string; color: string; yield: number } => v !== null);

  return (
    <div ref={wrapRef} className={`relative ${className ?? ""}`} onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ width: "100%", height, display: "block" }}>
        {/* y grid */}
        {Array.from({ length: yticks + 1 }, (_, i) => minY + ((maxY - minY) * i) / yticks).map((v, i) => (
          <g key={i}>
            <line x1={padL} x2={W - padR} y1={y(v)} y2={y(v)} stroke="#1A1A1D" strokeWidth={1} />
            <text x={padL - 5} y={y(v) + 3} textAnchor="end" fontSize={9} fill="#5E5E66" fontFamily="var(--font-mono)">
              {v.toFixed(1)}
            </text>
          </g>
        ))}
        {/* x tenor ticks */}
        {tenorLabels.map((p) => (
          <text key={p.tenor} x={x(p.months)} y={H - 8} textAnchor="middle" fontSize={9} fill={hover?.months === p.months ? "#FF8C00" : "#5E5E66"} fontFamily="var(--font-mono)">
            {p.tenor}
          </text>
        ))}

        {/* inversion shading */}
        {shadeInversion && lines[0] && (() => {
          const pts = [...lines[0].points].sort((a, b) => a.months - b.months);
          const back = pts[pts.length - 1].yield;
          const segs = pts.filter((p) => p.yield > back + 0.01);
          if (segs.length < 1) return null;
          return (
            <g>
              {segs.map((p, i) => (
                <line key={i} x1={x(p.months)} x2={x(p.months)} y1={y(p.yield)} y2={y(back)} stroke="#FF3B3B" strokeWidth={1} opacity={0.18} />
              ))}
            </g>
          );
        })()}

        {/* hover guide line */}
        {hover && (
          <line x1={x(hover.months)} x2={x(hover.months)} y1={padT} y2={H - padB} stroke="#FF8C00" strokeWidth={1} strokeDasharray="3 2" opacity={0.6} />
        )}

        {lines.map((l, li) => {
          const pts = [...l.points].sort((a, b) => a.months - b.months);
          const d = pts.map((p, i) => `${i ? "L" : "M"}${x(p.months).toFixed(1)},${y(p.yield).toFixed(1)}`).join(" ");
          return (
            <g key={li}>
              <path d={d} fill="none" stroke={l.color} strokeWidth={1.75} strokeDasharray={l.dashed ? "5 3" : undefined} strokeLinejoin="round" />
              {(l.dots ?? li === 0) &&
                pts.map((p, i) => <circle key={i} cx={x(p.months)} cy={y(p.yield)} r={2.2} fill={l.color} />)}
            </g>
          );
        })}

        {/* hover markers — ring each curve's value at the hovered tenor */}
        {hover &&
          lines.map((l, li) => {
            const pt = l.points.find((p) => p.months === hover.months);
            return pt ? <circle key={li} cx={x(pt.months)} cy={y(pt.yield)} r={3.4} fill="none" stroke={l.color} strokeWidth={1.5} /> : null;
          })}
      </svg>

      {/* tooltip — all curves' yields at the hovered tenor */}
      {hover && hoverValues && hoverValues.length > 0 && (
        <div
          className="pointer-events-none absolute z-20 min-w-[140px] rounded-sm border border-term-border bg-term-panel-3/95 px-2 py-1.5 shadow-lg backdrop-blur-sm"
          style={{
            left: Math.min(hover.px + 14, (wrapRef.current?.clientWidth ?? W) - 150),
            top: Math.max(8, hover.py - 8),
          }}
        >
          <div className="mb-1 border-b border-term-border-soft pb-0.5 text-3xs font-semibold uppercase tracking-wide text-term-amber">
            {hover.tenor} Tenor
          </div>
          <div className="flex flex-col gap-0.5">
            {hoverValues.map((v, i) => (
              <div key={i} className="flex items-center gap-1.5 text-2xs">
                <span className="h-2 w-2 shrink-0 rounded-sm" style={{ background: v.color }} />
                <span className="truncate text-term-text-dim" title={v.label}>{v.label}</span>
                <span className="tnum ml-auto font-semibold text-term-text">{v.yield.toFixed(2)}%</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
