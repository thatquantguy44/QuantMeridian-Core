import clsx from "clsx";
import type { ReactNode } from "react";

interface PanelProps {
  title?: string;
  code?: string;
  right?: ReactNode;
  toolbar?: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  scroll?: boolean;
  accent?: boolean;
  resizable?: boolean;
}

/** The standard bordered terminal panel with a title strip. */
export function Panel({ title, code, right, toolbar, subtitle, children, className, bodyClassName, scroll, accent, resizable = true }: PanelProps) {
  return (
    <section
      className={clsx(
        "analytics-widget flex min-h-0 min-w-0 flex-col border bg-term-panel",
        resizable && "analytics-widget-resizable",
        accent ? "border-term-amber/40" : "border-term-border",
        className
      )}
    >
      {title && (
        <header className="term-panel-head shrink-0">
          <div className="flex min-w-0 items-center gap-2">
            {accent && <span className="h-2 w-2 rounded-full bg-term-amber shadow-[0_0_6px_#FF8C00]" />}
            <span className="truncate text-term-text-dim" title={title}>{title}</span>
            {code && <span className="shrink-0 text-3xs text-term-text-mute">{code}</span>}
            {subtitle && <span className="shrink-0 text-3xs text-term-text-mute">{subtitle}</span>}
          </div>
          {right && <div className="ml-2 flex shrink-0 items-center gap-1">{right}</div>}
        </header>
      )}
      {toolbar && (
        <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 border-b border-term-border bg-term-panel-2 px-2 py-1">
          {toolbar}
        </div>
      )}
      <div className={clsx("analytics-widget-body min-h-0 min-w-0 flex-1", scroll && "overflow-auto", bodyClassName)}>
        <div className="analytics-widget-canvas">{children}</div>
      </div>
    </section>
  );
}

export function Stat({
  label,
  value,
  sub,
  tone,
  className,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  tone?: "up" | "down" | "amber" | "neutral";
  className?: string;
}) {
  const toneClass =
    tone === "up" ? "text-term-up" : tone === "down" ? "text-term-down" : tone === "amber" ? "text-term-amber" : "text-term-text";
  return (
    <div className={clsx("flex min-w-[10rem] flex-col gap-0.5 px-3 py-2", className)}>
      <div className="term-label truncate" title={label}>{label}</div>
      <div className={clsx("tnum truncate text-lg font-semibold leading-none", toneClass)} title={typeof value === "string" ? value : undefined}>{value}</div>
      {sub != null && <div className="tnum truncate text-2xs text-term-text-dim">{sub}</div>}
    </div>
  );
}

export function Tag({ children, tone = "neutral", className }: { children: ReactNode; tone?: "up" | "down" | "amber" | "neutral" | "blue" | "violet"; className?: string }) {
  const map: Record<string, string> = {
    up: "border-term-up/40 bg-term-up/10 text-term-up",
    down: "border-term-down/40 bg-term-down/10 text-term-down",
    amber: "border-term-amber/40 bg-term-amber/10 text-term-amber",
    blue: "border-term-blue/40 bg-term-blue/10 text-term-blue",
    violet: "border-term-violet/40 bg-term-violet/10 text-term-violet",
    neutral: "border-term-border bg-term-panel-3 text-term-text-dim",
  };
  return (
    <span className={clsx("inline-flex items-center rounded-sm border px-1.5 py-px text-3xs font-semibold uppercase tracking-wide", map[tone], className)}>
      {children}
    </span>
  );
}
