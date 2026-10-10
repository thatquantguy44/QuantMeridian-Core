
import { useEffect, useRef, type ReactNode } from "react";
import clsx from "clsx";

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  /** Accessible name; rendered as a visually-hidden label if no labelledBy. */
  label?: string;
  /** id of an element inside that labels the dialog (takes precedence over label). */
  labelledBy?: string;
  /** Classes for the dialog panel (sizing/border/etc.). */
  className?: string;
  /** Alignment of the panel within the viewport. */
  align?: "center" | "top";
  children: ReactNode;
}

/**
 * Accessible modal primitive: role="dialog" + aria-modal, focus trap (Tab/Shift+Tab
 * cycle within), Escape to close, backdrop click to close, and focus restoration to
 * the previously-focused element on close. Only intercepts Tab/Escape, so callers
 * keep arrow-key / Enter handling (e.g. the command palette).
 */
export function Modal({ open, onClose, label, labelledBy, className, align = "center", children }: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    restoreRef.current = document.activeElement as HTMLElement | null;

    const panel = panelRef.current;
    // Focus the first focusable element, else the panel itself.
    const first = panel?.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? panel)?.focus();

    return () => {
      // Restore focus to whatever was focused before the modal opened.
      restoreRef.current?.focus?.();
    };
  }, [open]);

  if (!open) return null;

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      onClose();
      return;
    }
    if (e.key !== "Tab") return;
    const panel = panelRef.current;
    if (!panel) return;
    const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.offsetParent !== null);
    if (items.length === 0) {
      e.preventDefault();
      return;
    }
    const first = items[0];
    const last = items[items.length - 1];
    const active = document.activeElement as HTMLElement;
    if (e.shiftKey && active === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  };

  return (
    <div
      className={clsx("fixed inset-0 z-50 flex justify-center bg-black/60", align === "top" ? "items-start pt-[12vh]" : "items-center", "p-4")}
      onClick={onClose}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={labelledBy ? undefined : label}
        aria-labelledby={labelledBy}
        tabIndex={-1}
        className={clsx("outline-none", className)}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={onKeyDown}
      >
        {children}
      </div>
    </div>
  );
}
