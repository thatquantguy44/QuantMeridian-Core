import { TermToggle } from "./TermToggle";

interface TermToggleGroupProps<T extends string> {
  label?: string;
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string }[];
  size?: "sm" | "md";
  className?: string;
}

export function TermToggleGroup<T extends string>({ label, value, onChange, options, size = "md", className }: TermToggleGroupProps<T>) {
  return (
    <div className={`flex items-center gap-1 ${className ?? ""}`}>
      {label && <span className="term-label">{label}</span>}
      {options.map((o) => (
        <TermToggle key={o.value} on={value === o.value} onClick={() => onChange(o.value)} size={size}>
          {o.label}
        </TermToggle>
      ))}
    </div>
  );
}
