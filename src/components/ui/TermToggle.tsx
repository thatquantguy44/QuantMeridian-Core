import clsx from "clsx";
import type { ReactNode } from "react";

interface TermToggleProps {
  on: boolean;
  onClick: () => void;
  children: ReactNode;
  size?: "sm" | "md";
  className?: string;
}

export function TermToggle({ on, onClick, children, size = "md", className }: TermToggleProps) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        "term-btn",
        on && "term-btn-active",
        size === "sm" && "px-1.5 py-0.5 text-3xs",
        className,
      )}
    >
      {children}
    </button>
  );
}
