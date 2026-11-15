import { useRef, useState, type ReactNode } from "react";
import { Panel } from "@/components/ui/Panel";
import { exportPngFigure, exportSvgFigure } from "@/lib/presidential/exports";
import { buttonClass } from "./ResearchInputs";

export function FigurePanel({ id, title, caption, watermark, ready, children }: {
  id: string; title: string; caption: string; watermark: string | null; ready: boolean; children: ReactNode;
}) {
  const figure = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  async function save(format: "svg" | "png") {
    const svg = figure.current?.querySelector("svg");
    if (!svg) return;
    setError(null); setExporting(true);
    try {
      if (format === "svg") exportSvgFigure(svg, `${id}.svg`, caption, watermark);
      else await exportPngFigure(svg, `${id}.png`, caption, watermark);
    } catch { setError("Figure export failed. Retry or download the SVG instead."); }
    finally { setExporting(false); }
  }
  return <Panel title={title} resizable={false} right={<>
    <button type="button" className={buttonClass} disabled={!ready || exporting} aria-label={`Download ${title} SVG`} onClick={() => { void save("svg"); }}>SVG</button>
    <button type="button" className={buttonClass} disabled={!ready || exporting} aria-label={`Download ${title} PNG`} onClick={() => { void save("png"); }}>PNG</button>
  </>}>
    <figure className="min-w-0 space-y-2 p-3">
      <div ref={figure} className="max-w-full overflow-x-auto">{children}</div>
      <p className="text-3xs text-term-text-dim sm:hidden">Scroll horizontally to inspect the full figure. Downloads contain the complete chart.</p>
      <figcaption className="break-words text-2xs leading-relaxed text-term-text-dim">{caption}</figcaption>
      {error && <p role="alert" className="text-xs text-term-amber">{error}</p>}
    </figure>
  </Panel>;
}
