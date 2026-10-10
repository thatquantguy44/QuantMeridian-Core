import clsx from "clsx";

const FREQ_LABEL: Record<string, string> = {
  D: "DAILY",
  W: "WEEKLY",
  M: "MONTHLY",
  Q: "QUARTERLY",
};

const FREQ_TITLE: Record<string, string> = {
  D: "Updated every trading day",
  W: "Updated weekly (typically Thursday)",
  M: "Updated once per month",
  Q: "Updated once per quarter",
};

export function FrequencyBadge({ freq, className }: { freq: string; className?: string }) {
  const label = FREQ_LABEL[freq] ?? freq;
  const title = FREQ_TITLE[freq] ?? `Frequency: ${freq}`;
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-sm border border-term-border bg-term-panel-3 px-1.5 py-px text-3xs font-semibold uppercase tracking-wide text-term-text-dim",
        className,
      )}
      title={title}
    >
      {label}
    </span>
  );
}
