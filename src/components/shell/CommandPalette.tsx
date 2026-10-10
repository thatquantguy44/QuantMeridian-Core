
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "@/lib/navigation";
import { NAV } from "@/lib/nav";
import { UNIVERSE } from "@/data/universe";
import { Modal } from "@/components/ui/Modal";
import { Search, CornerDownLeft } from "lucide-react";

/** Bloomberg-style command line: type a mnemonic (SLAB, PB, MKT...) or a ticker. */
export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [idx, setIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQ("");
      setIdx(0);
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  }, [open]);

  const results = useMemo(() => {
    const term = q.trim().toUpperCase();
    const navHits = NAV.filter((n) => !term || n.code.includes(term) || n.label.toUpperCase().includes(term) || n.desc.toUpperCase().includes(term)).map((n) => ({
      type: "MODULE" as const,
      code: n.code,
      label: n.label,
      desc: n.desc,
      href: n.href,
    }));
    const secHits = !term
      ? []
      : UNIVERSE.filter((s) => s.ticker.includes(term) || s.name.toUpperCase().includes(term))
          .slice(0, 6)
          .map((s) => ({ type: "SECURITY" as const, code: s.ticker, label: s.name, desc: `${s.assetClass} · ${s.sector}`, href: `/markets?sym=${s.ticker}` }));
    return [...navHits, ...secHits].slice(0, 12);
  }, [q]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setIdx((i) => Math.min(i + 1, results.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setIdx((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        const r = results[idx];
        if (r) {
          router.push(r.href);
          onClose();
        }
      } else if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, results, idx, router, onClose]);

  return (
    <Modal open={open} onClose={onClose} align="top" label="Command line — run a module or find a security" className="w-[640px] max-w-[92vw] border border-term-amber/50 bg-term-panel shadow-glow">
      <div>
        <div className="flex items-center gap-2 border-b border-term-border px-3 py-2">
          <Search size={15} className="text-term-amber" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setIdx(0);
            }}
            placeholder="Command / security  —  e.g. SLAB, PB, NVDA, GME…"
            className="w-full bg-transparent font-mono text-sm text-term-text outline-none placeholder:text-term-text-mute"
          />
          <span className="term-kbd">ESC</span>
        </div>
        <div className="max-h-[50vh] overflow-y-auto py-1">
          {results.length === 0 && <div className="px-3 py-4 text-center text-2xs text-term-text-mute">No matches</div>}
          {results.map((r, i) => (
            <button
              key={`${r.type}-${r.code}`}
              onMouseEnter={() => setIdx(i)}
              onClick={() => {
                router.push(r.href);
                onClose();
              }}
              className={`flex w-full items-center gap-3 px-3 py-1.5 text-left ${i === idx ? "bg-term-amber-soft" : ""}`}
            >
              <span className={`w-14 shrink-0 font-mono text-2xs font-semibold ${r.type === "MODULE" ? "text-term-amber" : "text-term-blue"}`}>{r.code}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs text-term-text">{r.label}</span>
                <span className="block truncate text-3xs text-term-text-mute">{r.desc}</span>
              </span>
              <span className="shrink-0 text-3xs uppercase text-term-text-mute">{r.type}</span>
              {i === idx && <CornerDownLeft size={12} className="shrink-0 text-term-amber" />}
            </button>
          ))}
        </div>
        <div className="flex items-center justify-between border-t border-term-border px-3 py-1.5 text-3xs text-term-text-mute">
          <span className="flex gap-2">
            <span><span className="term-kbd">↑</span> <span className="term-kbd">↓</span> navigate</span>
            <span><span className="term-kbd">↵</span> open</span>
          </span>
          <span>QIT Command Line</span>
        </div>
      </div>
    </Modal>
  );
}
