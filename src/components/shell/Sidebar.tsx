
import { useEffect } from "react";
import Link from "@/components/Link";
import { usePathname } from "@/lib/navigation";
import clsx from "clsx";
import { NAV, NAV_GROUPS } from "@/lib/nav";

/**
 * Module navigation. On md+ it sits in normal flow and collapses to an icon rail.
 * Below md it becomes a slide-in drawer overlaying the content, opened from the
 * command bar and dismissed by tapping a link, the backdrop, or Escape.
 */
export function Sidebar({ collapsed, mobileOpen, onClose }: { collapsed: boolean; mobileOpen: boolean; onClose: () => void }) {
  const path = usePathname();

  // Close the mobile drawer on Escape.
  useEffect(() => {
    if (!mobileOpen) return;
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [mobileOpen, onClose]);

  // On mobile the drawer is always full-width (never the icon rail).
  const railed = collapsed; // only meaningful at md+

  return (
    <>
      {/* backdrop — mobile only, when open */}
      {mobileOpen && <div className="fixed inset-0 z-30 bg-black/60 md:hidden" onClick={onClose} aria-hidden />}

      <nav
        aria-label="Module navigation"
        className={clsx(
          "z-40 flex flex-col border-r border-term-border bg-term-panel transition-transform md:transition-all",
          // mobile: fixed drawer that slides in/out
          "fixed inset-y-0 left-0 w-52 md:static md:inset-auto md:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
          // desktop: in-flow rail width
          railed ? "md:w-12" : "md:w-52"
        )}
      >
        <div className="min-h-0 flex-1 overflow-y-auto py-1">
          {NAV_GROUPS.map((g) => {
            const items = NAV.filter((n) => n.group === g.id);
            return (
              <div key={g.id} className="mb-1">
                <div className={clsx("px-3 pb-0.5 pt-2 text-3xs font-semibold uppercase tracking-widest text-term-text-mute", railed && "md:hidden")}>{g.label}</div>
                {items.map((n) => {
                  const active = path === n.href;
                  const Icon = n.icon;
                  return (
                    <Link
                      key={n.href}
                      href={n.href}
                      onClick={onClose}
                      title={`${n.label} — ${n.desc}`}
                      className={clsx(
                        "group flex items-center gap-2.5 px-3 py-1.5 text-xs transition-colors",
                        active ? "border-l-2 border-term-amber bg-term-amber-soft text-term-amber" : "border-l-2 border-transparent text-term-text-dim hover:bg-term-panel-2 hover:text-term-text"
                      )}
                    >
                      <Icon size={15} className={clsx("shrink-0", active && "text-term-amber")} />
                      <span className={clsx("flex min-w-0 flex-1 items-center justify-between", railed && "md:hidden")}>
                        <span className="truncate">{n.label}</span>
                        <span className={clsx("ml-1 font-mono text-3xs", active ? "text-term-amber/70" : "text-term-text-mute")}>{n.code}</span>
                      </span>
                    </Link>
                  );
                })}
              </div>
            );
          })}
        </div>
        <div className={clsx("border-t border-term-border px-3 py-2 text-3xs text-term-text-mute", railed && "md:hidden")}>
          <div className="flex items-center justify-between">
            <span>SESSION</span>
            <span className="text-term-up">● LIVE</span>
          </div>
          <div className="mt-1 flex items-center justify-between">
            <span>LATENCY</span>
            <span className="tnum text-term-text-dim">2.4ms</span>
          </div>
        </div>
      </nav>
    </>
  );
}
