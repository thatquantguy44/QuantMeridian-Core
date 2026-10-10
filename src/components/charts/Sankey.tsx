
interface SankeyNode {
  id: string;
  label: string;
  col: number;
}
interface SankeyLink {
  source: string;
  target: string;
  value: number;
}

interface SankeyProps {
  nodes: SankeyNode[];
  links: SankeyLink[];
  height?: number;
  className?: string;
}

const COLORS = ["#FF8C00", "#3B9DFF", "#2ECC71", "#A78BFA", "#22D3EE", "#EC4899", "#FFB400"];

/** Lightweight Sankey flow diagram (columnar layout). */
export function Sankey({ nodes, links, height = 300, className }: SankeyProps) {
  const W = 600;
  const H = height;
  const cols = Math.max(...nodes.map((n) => n.col)) + 1;
  const colX = (c: number) => 40 + (c / (cols - 1)) * (W - 120);
  const nodeW = 12;

  // layout nodes per column with throughput-proportional heights
  const flowOf = (id: string) =>
    links.filter((l) => l.source === id).reduce((a, l) => a + l.value, 0) + links.filter((l) => l.target === id).reduce((a, l) => a + l.value, 0);

  const byCol: Record<number, SankeyNode[]> = {};
  nodes.forEach((n) => (byCol[n.col] = [...(byCol[n.col] ?? []), n]));

  const pos: Record<string, { x: number; y: number; h: number; cx: number }> = {};
  Object.entries(byCol).forEach(([col, ns]) => {
    const totalFlow = ns.reduce((a, n) => a + flowOf(n.id), 0) || 1;
    const gap = 10;
    const avail = H - 20 - gap * (ns.length - 1);
    let y = 10;
    ns.forEach((n) => {
      const h = Math.max(14, (flowOf(n.id) / totalFlow) * avail);
      pos[n.id] = { x: colX(Number(col)), y, h, cx: Number(col) };
      y += h + gap;
    });
  });

  // track vertical offsets used on each node for stacking links
  const srcOff: Record<string, number> = {};
  const tgtOff: Record<string, number> = {};

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={className} preserveAspectRatio="none" style={{ width: "100%", height }}>
      {links.map((l, i) => {
        const s = pos[l.source];
        const t = pos[l.target];
        if (!s || !t) return null;
        const sFlow = links.filter((x) => x.source === l.source).reduce((a, x) => a + x.value, 0) || 1;
        const tFlow = links.filter((x) => x.target === l.target).reduce((a, x) => a + x.value, 0) || 1;
        const sh = (l.value / sFlow) * s.h;
        const th = (l.value / tFlow) * t.h;
        const sy = s.y + (srcOff[l.source] ?? 0);
        const ty = t.y + (tgtOff[l.target] ?? 0);
        srcOff[l.source] = (srcOff[l.source] ?? 0) + sh;
        tgtOff[l.target] = (tgtOff[l.target] ?? 0) + th;
        const x1 = s.x + nodeW;
        const x2 = t.x;
        const mx = (x1 + x2) / 2;
        const d = `M${x1},${sy + sh / 2} C${mx},${sy + sh / 2} ${mx},${ty + th / 2} ${x2},${ty + th / 2}`;
        return <path key={i} d={d} fill="none" stroke={COLORS[i % COLORS.length]} strokeWidth={Math.max(1, (sh + th) / 2)} opacity={0.28} />;
      })}
      {nodes.map((n, i) => {
        const p = pos[n.id];
        if (!p) return null;
        return (
          <g key={n.id}>
            <rect x={p.x} y={p.y} width={nodeW} height={p.h} fill={COLORS[i % COLORS.length]} opacity={0.95} />
            <text
              x={n.col === cols - 1 ? p.x - 4 : p.x + nodeW + 4}
              y={p.y + p.h / 2 + 3}
              textAnchor={n.col === cols - 1 ? "end" : "start"}
              fontSize={9}
              fill="#C9C9D1"
              fontFamily="var(--font-mono)"
            >
              {n.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
