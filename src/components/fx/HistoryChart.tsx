import { useId } from "react";
import { historyGeometry, type HistoryChartPoint } from "@/lib/fx/historyChart";

export function HistoryChart({ points, units }: { points: readonly HistoryChartPoint[]; units: string }) {
  const id = useId(), g = historyGeometry(points);
  if (!g.segments.length) return <p className="py-8 text-xs text-term-text-dim">No qualified historical observations to plot.</p>;
  const x = (v: number) => 70 + v * 510, y = (v: number) => 16 + v * 180;
  const format = (v: number) => new Intl.NumberFormat("en-US", { maximumSignificantDigits: 6 }).format(v);
  return <svg viewBox="0 0 600 232" className="block w-full text-term-amber" role="img" aria-labelledby={`${id}-title ${id}-description`}>
    <title id={`${id}-title`}>Historical reference levels, {units}</title>
    <desc id={`${id}-description`}>Current-vintage dated observations from {g.firstDate} to {g.lastDate}. {g.gapCount} unavailable observations break the line. Exact observations are in the history table.</desc>
    {[0, 1].map(v => <g key={v}>
      <line x1="70" x2="580" y1={y(v)} y2={y(v)} className="stroke-term-border" />
      <text x="62" y={y(v) + 4} textAnchor="end" className="fill-term-text-dim text-[10px]">{format(v === 0 ? g.max! : g.min!)}</text>
    </g>)}
    {g.segments.map((segment, i) => <g key={i}>
      <path d={segment.map((p, j) => `${j ? "L" : "M"}${x(p.x)},${y(p.y)}`).join(" ")} fill="none" stroke="currentColor" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
      {segment.map(p => <circle key={p.date} cx={x(p.x)} cy={y(p.y)} r="2" fill="currentColor"><title>{p.date}: {format(p.value)} {units}</title></circle>)}
    </g>)}
    <text x="70" y="220" className="fill-term-text-dim text-[10px]">{g.firstDate}</text>
    <text x="580" y="220" textAnchor="end" className="fill-term-text-dim text-[10px]">{g.lastDate}</text>
  </svg>;
}
