
import type { KeyboardEvent } from "react";

export interface GraphNode {
  id: string;
  label: string;
  group: "SOURCE" | "ENGINE" | "USE";
  size?: number;
}
export interface GraphEdge {
  source: string;
  target: string;
  value: number;
}

interface NetworkGraphProps {
  nodes: GraphNode[];
  edges: GraphEdge[];
  height?: number;
  className?: string;
  selectedNodeId?: string | null;
  onNodeSelect?: (nodeId: string) => void;
}

const GROUP_COLOR: Record<GraphNode["group"], string> = {
  SOURCE: "#3B9DFF",
  ENGINE: "#FF8C00",
  USE: "#2ECC71",
};

/** Deterministic 3-column network/flow graph (sources → engine → uses). */
export function NetworkGraph({ nodes, edges, height = 320, className, selectedNodeId, onNodeSelect }: NetworkGraphProps) {
  const W = 600;
  const H = height;
  const cols: Record<GraphNode["group"], GraphNode[]> = { SOURCE: [], ENGINE: [], USE: [] };
  nodes.forEach((n) => cols[n.group].push(n));
  const colX: Record<GraphNode["group"], number> = { SOURCE: 70, ENGINE: W / 2, USE: W - 70 };

  const pos: Record<string, { x: number; y: number; r: number }> = {};
  (Object.keys(cols) as GraphNode["group"][]).forEach((g) => {
    const ns = cols[g];
    ns.forEach((n, i) => {
      const y = ns.length === 1 ? H / 2 : 28 + (i / (ns.length - 1)) * (H - 56);
      pos[n.id] = { x: colX[g], y, r: n.size ?? (g === "ENGINE" ? 26 : 7) };
    });
  });

  const maxV = Math.max(...edges.map((e) => e.value), 1e-9);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={className} style={{ width: "100%", height }}>
      {edges.map((e, i) => {
        const s = pos[e.source];
        const t = pos[e.target];
        if (!s || !t) return null;
        const mx = (s.x + t.x) / 2;
        return (
          <path
            key={i}
            d={`M${s.x},${s.y} C${mx},${s.y} ${mx},${t.y} ${t.x},${t.y}`}
            fill="none"
            stroke="#FF8C00"
            strokeWidth={0.6 + (e.value / maxV) * 3.5}
            opacity={0.22}
          />
        );
      })}
      {nodes.map((n) => {
        const p = pos[n.id];
        const isEngine = n.group === "ENGINE";
        const isSelected = selectedNodeId === n.id;
        const handleKeyDown = (event: KeyboardEvent<SVGGElement>) => {
          if (onNodeSelect && (event.key === "Enter" || event.key === " ")) {
            event.preventDefault();
            onNodeSelect(n.id);
          }
        };
        return (
          <g
            key={n.id}
            role={onNodeSelect ? "button" : undefined}
            tabIndex={onNodeSelect ? 0 : undefined}
            aria-label={onNodeSelect ? `Drill through ${n.label}` : undefined}
            aria-pressed={onNodeSelect ? isSelected : undefined}
            aria-controls={onNodeSelect ? "kgr-impact-drillthrough" : undefined}
            onClick={onNodeSelect ? () => onNodeSelect(n.id) : undefined}
            onKeyDown={onNodeSelect ? handleKeyDown : undefined}
            style={onNodeSelect ? { cursor: "pointer" } : undefined}
          >
            <title>{n.label}</title>
            <circle cx={p.x} cy={p.y} r={p.r} fill={GROUP_COLOR[n.group]} opacity={n.group === "ENGINE" ? 0.92 : 0.85} stroke={isSelected ? "#F5F5F7" : "#0A0A0A"} strokeWidth={isSelected ? 2.5 : 1} />
            <text
              x={n.group === "SOURCE" ? p.x - p.r - 6 : p.x + p.r + 6}
              y={p.y + 3}
              textAnchor={n.group === "SOURCE" ? "end" : "start"}
              fontSize={isEngine ? 9 : 8.5}
              fill={isEngine ? "#F5F5F7" : "#C9C9D1"}
              stroke={isEngine ? "#0A0A0A" : "none"}
              strokeWidth={isEngine ? 2.5 : 0}
              paintOrder="stroke"
              strokeLinecap="round"
              strokeLinejoin="round"
              fontFamily="var(--font-mono)"
              fontWeight={isEngine ? 700 : 400}
            >
              {n.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
