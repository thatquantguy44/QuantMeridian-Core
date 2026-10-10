interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  stroke?: string;
  fill?: boolean;
  className?: string;
  baseline?: boolean;
}

/** Compact inline trend line. Auto-colors up/down vs first point unless stroke given. */
export function Sparkline({ data, width = 80, height = 22, stroke, fill = false, className, baseline }: SparklineProps) {
  if (!data || data.length < 2) return <svg width={width} height={height} className={className} />;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const dx = width / (data.length - 1);
  const pts = data.map((v, i) => [i * dx, height - ((v - min) / range) * (height - 2) - 1] as const);
  const d = pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
  const up = data[data.length - 1] >= data[0];
  const color = stroke ?? (up ? "#2ECC71" : "#FF3B3B");
  const areaD = `${d} L${width},${height} L0,${height} Z`;
  return (
    <svg width={width} height={height} className={className} preserveAspectRatio="none">
      {fill && <path d={areaD} fill={color} opacity={0.12} />}
      {baseline && <line x1={0} y1={height - ((data[0] - min) / range) * (height - 2) - 1} x2={width} y2={height - ((data[0] - min) / range) * (height - 2) - 1} stroke="#3a3a40" strokeWidth={0.5} strokeDasharray="2 2" />}
      <path d={d} fill="none" stroke={color} strokeWidth={1.25} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
