
interface Bar {
  label: string;
  value: number;
  color?: string;
}

interface BarChartProps {
  data: Bar[];
  height?: number;
  horizontal?: boolean;
  fmt?: (n: number) => string;
  className?: string;
}

/** Simple bar chart. Horizontal mode is handy for "revenue by X" rankings. */
export function BarChart({ data, height = 200, horizontal, fmt, className }: BarChartProps) {
  const max = Math.max(...data.map((d) => Math.abs(d.value)), 1e-9);

  if (horizontal) {
    return (
      <div className={className} style={{ minWidth: 360 }}>
        {data.map((d, i) => (
          <div key={i} className="flex items-center gap-2 py-[3px]">
            <div className="w-20 shrink-0 truncate text-2xs text-term-text-dim" title={d.label}>
              {d.label}
            </div>
            <div className="relative h-3 flex-1 bg-term-panel-3">
              <div
                className="absolute inset-y-0 left-0"
                style={{ width: `${(Math.abs(d.value) / max) * 100}%`, background: d.color ?? "#FF8C00" }}
              />
            </div>
            <div className="tnum w-16 shrink-0 text-right text-2xs text-term-text">{fmt ? fmt(d.value) : d.value.toFixed(1)}</div>
          </div>
        ))}
      </div>
    );
  }

  const W = 600;
  const H = height;
  const padB = 22;
  const padT = 6;
  const bw = (W / data.length) * 0.66;
  const gap = (W / data.length) * 0.34;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={className} preserveAspectRatio="none" style={{ width: "100%", minWidth: 360, height }}>
      {data.map((d, i) => {
        const h = (Math.abs(d.value) / max) * (H - padT - padB);
        const x = i * (bw + gap) + gap / 2;
        return (
          <g key={i}>
            <rect x={x} y={H - padB - h} width={bw} height={h} fill={d.color ?? "#FF8C00"} opacity={0.9} />
            <text x={x + bw / 2} y={H - 8} textAnchor="middle" fontSize={9} fill="#5E5E66" fontFamily="var(--font-mono)">
              {d.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
