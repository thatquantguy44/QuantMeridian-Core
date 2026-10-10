
interface ScatterProps {
  points: { x: number; y: number }[];
  height?: number;
  className?: string;
  xLabel?: string;
  yLabel?: string;
  /** optional regression line y = slope*x + intercept */
  fit?: { slope: number; intercept: number };
  color?: string;
}

/** Scatter plot with optional OLS fit line — used for econ regressions. */
export function ScatterPlot({ points, height = 260, className, xLabel, yLabel, fit, color = "#3B9DFF" }: ScatterProps) {
  const W = 600;
  const H = height;
  const padL = 42;
  const padR = 10;
  const padT = 10;
  const padB = 28;
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const x = (v: number) => padL + ((v - minX) / (maxX - minX || 1)) * (W - padL - padR);
  const y = (v: number) => padT + (1 - (v - minY) / (maxY - minY || 1)) * (H - padT - padB);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={className} preserveAspectRatio="none" style={{ width: "100%", minWidth: 420, height }}>
      {Array.from({ length: 5 }, (_, i) => minY + ((maxY - minY) * i) / 4).map((v, i) => (
        <g key={i}>
          <line x1={padL} x2={W - padR} y1={y(v)} y2={y(v)} stroke="#1A1A1D" strokeWidth={1} />
          <text x={padL - 5} y={y(v) + 3} textAnchor="end" fontSize={9} fill="#5E5E66" fontFamily="var(--font-mono)">
            {v.toFixed(1)}
          </text>
        </g>
      ))}
      {fit && (
        <line
          x1={x(minX)}
          y1={y(fit.slope * minX + fit.intercept)}
          x2={x(maxX)}
          y2={y(fit.slope * maxX + fit.intercept)}
          stroke="#FF8C00"
          strokeWidth={1.5}
          strokeDasharray="5 3"
        />
      )}
      {points.map((p, i) => (
        <circle key={i} cx={x(p.x)} cy={y(p.y)} r={2.4} fill={color} opacity={0.7} />
      ))}
      {xLabel && (
        <text x={(W + padL) / 2} y={H - 4} textAnchor="middle" fontSize={9} fill="#9A9AA3" fontFamily="var(--font-mono)">
          {xLabel}
        </text>
      )}
      {yLabel && (
        <text x={10} y={padT + 4} fontSize={9} fill="#9A9AA3" fontFamily="var(--font-mono)">
          {yLabel}
        </text>
      )}
    </svg>
  );
}
