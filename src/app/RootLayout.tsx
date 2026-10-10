import { Outlet, useLocation } from "react-router-dom";
import { AppShell } from "@/components/shell/AppShell";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { SimModeProvider } from "@/lib/simMode";

/**
 * Top-level route element: the persistent terminal chrome (AppShell) wrapping a
 * per-route error boundary. Keying the boundary on the pathname resets it on
 * navigation, matching Next's per-segment `error.tsx` behaviour.
 */
export function RootLayout() {
  const { pathname } = useLocation();
  return (
    <SimModeProvider>
      <AppShell>
        <ErrorBoundary key={pathname}>
          <Outlet />
        </ErrorBoundary>
      </AppShell>
    </SimModeProvider>
  );
}
