import { Component, type ReactNode } from "react";
import { AlertTriangle, RotateCw } from "lucide-react";

/**
 * Module-level error boundary. Keeps a thrown render error inside the terminal
 * chrome (the AppShell stays mounted) and offers a one-click recovery instead of
 * blanking the whole app — the React equivalent of Next's segment `error.tsx`.
 * Re-mount it with a `key` (e.g. the pathname) to auto-reset on navigation.
 */
interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    // Surface for observability; replace with a real sink when one exists.
    console.error("[terminal] render error:", error);
  }

  reset = () => this.setState({ error: null });

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="flex min-h-full items-center justify-center p-6">
        <div className="w-full max-w-lg border border-term-down/40 bg-term-panel shadow-panel">
          <div className="flex items-center gap-2 border-b border-term-border bg-term-panel-2 px-3 py-2">
            <AlertTriangle size={15} className="text-term-down" />
            <span className="font-mono text-sm font-bold text-term-down">MODULE FAULT</span>
            <span className="ml-auto font-mono text-3xs uppercase tracking-widest text-term-text-mute">
              QIT · runtime exception
            </span>
          </div>
          <div className="p-4">
            <p className="text-xs text-term-text-dim">
              This module hit an unexpected error and was halted to protect the rest of the terminal.
              The other modules are unaffected.
            </p>
            <pre className="mt-3 max-h-40 overflow-auto whitespace-pre-wrap break-words rounded-sm border border-term-border bg-term-bg px-2 py-1.5 font-mono text-3xs text-term-text-mute">
              {error.message || "Unknown error"}
            </pre>
            <div className="mt-4 flex items-center gap-2">
              <button
                onClick={this.reset}
                className="flex items-center gap-1.5 rounded-sm border border-term-amber bg-term-amber px-3 py-1 text-2xs font-semibold uppercase tracking-wide text-black transition-opacity hover:opacity-90"
              >
                <RotateCw size={12} /> Retry module
              </button>
              <a
                href="/"
                className="rounded-sm border border-term-border bg-term-panel-2 px-3 py-1 text-2xs font-semibold uppercase tracking-wide text-term-text-mute transition-colors hover:text-term-text"
              >
                Command center
              </a>
            </div>
          </div>
        </div>
      </div>
    );
  }
}
