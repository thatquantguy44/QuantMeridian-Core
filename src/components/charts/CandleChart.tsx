
import type { Candle } from "@/data/markets";

interface CandleChartProps {
  candles: Candle[];
  height?: number;
  vwap?: boolean;
  className?: string;
}

/** Intraday candlestick chart with volume sub-panel and VWAP overlay. */
export function CandleChart({ candles, height = 260, vwap = true, className }: CandleChartProps) {
  const W = 600;
  const H = height;
  const volH = H * 0.18;
  const padT = 8;
  const padR = 6;
  const padL = 44;
  const priceH = H - volH - padT - 16;
  const highs = candles.map((c) => c.h);
  const lows = candles.map((c) => c.l);
  const max = Math.max(...highs);
  const min = Math.min(...lows);
  const range = max - min || 1;
  const y = (v: number) => padT + (1 - (v - min) / range) * priceH;
  const cw = (W - padL - padR) / candles.length;
  const x = (i: number) => padL + i * cw + cw / 2;

  const maxVol = Math.max(...candles.map((c) => c.v), 1);
  const vy = (v: number) => H - 14 - (v / maxVol) * volH;

  // running vwap
  let cumPV = 0;
  let cumV = 0;
  const vwapLine = candles.map((c) => {
    cumPV += ((c.h + c.l + c.c) / 3) * c.v;
    cumV += c.v;
    return cumPV / cumV;
  });

  const yticks = 4;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={className} preserveAspectRatio="none" style={{ width: "100%", height }}>
      {Array.from({ length: yticks + 1 }, (_, i) => min + (range * i) / yticks).map((v, i) => (
        <g key={i}>
          <line x1={padL} x2={W - padR} y1={y(v)} y2={y(v)} stroke="#1A1A1D" strokeWidth={1} />
          <text x={padL - 5} y={y(v) + 3} textAnchor="end" fontSize={8.5} fill="#5E5E66" fontFamily="var(--font-mono)">
            {v.toFixed(1)}
          </text>
        </g>
      ))}
      {candles.map((c, i) => {
        const up = c.c >= c.o;
        const col = up ? "#2ECC71" : "#FF3B3B";
        return (
          <g key={i}>
            <line x1={x(i)} x2={x(i)} y1={y(c.h)} y2={y(c.l)} stroke={col} strokeWidth={0.8} />
            <rect x={x(i) - cw * 0.32} y={y(Math.max(c.o, c.c))} width={cw * 0.64} height={Math.max(0.6, Math.abs(y(c.o) - y(c.c)))} fill={col} />
            <rect x={x(i) - cw * 0.32} y={vy(c.v)} width={cw * 0.64} height={H - 14 - vy(c.v)} fill={col} opacity={0.35} />
          </g>
        );
      })}
      {vwap && (
        <path
          d={vwapLine.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ")}
          fill="none"
          stroke="#FF8C00"
          strokeWidth={1.2}
          strokeDasharray="3 2"
        />
      )}
    </svg>
  );
}
