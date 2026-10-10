import Link from "@/components/Link";
import { Compass } from "lucide-react";

/** Terminal-styled 404 for unknown module routes. */
export default function NotFound() {
  return (
    <div className="flex min-h-full items-center justify-center p-6">
      <div className="w-full max-w-lg border border-term-border bg-term-panel shadow-panel">
        <div className="flex items-center gap-2 border-b border-term-border bg-term-panel-2 px-3 py-2">
          <Compass size={15} className="text-term-amber" />
          <span className="font-mono text-sm font-bold text-term-amber">UNKNOWN MNEMONIC</span>
          <span className="ml-auto font-mono text-3xs uppercase tracking-widest text-term-text-mute">QIT · 404</span>
        </div>
        <div className="p-4">
          <p className="text-xs text-term-text-dim">
            No module is mapped to this route. Use the command line
            (<span className="term-kbd">⌘</span> <span className="term-kbd">K</span>) to jump to a module by mnemonic,
            or return to the command center.
          </p>
          <div className="mt-4">
            <Link
              href="/"
              className="rounded-sm border border-term-amber bg-term-amber px-3 py-1 text-2xs font-semibold uppercase tracking-wide text-black transition-opacity hover:opacity-90"
            >
              Command center
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
