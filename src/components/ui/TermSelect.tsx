import clsx from "clsx";

type Option<T extends string> = { value: T; label: string } | T;

interface TermSelectProps<T extends string> {
  value: T;
  onChange: (value: T) => void;
  options: Option<T>[];
  size?: "sm" | "md";
  className?: string;
}

export function TermSelect<T extends string>({ value, onChange, options, size = "md", className }: TermSelectProps<T>) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as T)}
      className={clsx(
        "border border-term-border bg-term-panel-3 text-term-amber outline-none hover:border-term-amber",
        size === "sm" ? "px-1 py-px text-3xs" : "px-1.5 py-0.5 text-2xs",
        className,
      )}
    >
      {options.map((o) => {
        const val = typeof o === "string" ? o : o.value;
        const label = typeof o === "string" ? o : o.label;
        return (
          <option key={val} value={val} className="bg-term-panel text-term-text">
            {label}
          </option>
        );
      })}
    </select>
  );
}
