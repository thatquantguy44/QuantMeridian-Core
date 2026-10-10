import { useLocation, useNavigate } from "react-router-dom";

/**
 * Compatibility shims for the `next/navigation` hooks the shell components use.
 * They wrap react-router so the existing call sites (`router.push`, `usePathname`)
 * keep working unchanged after the Vite migration.
 */
export function useRouter() {
  const navigate = useNavigate();
  return {
    push: (href: string) => navigate(href),
    replace: (href: string) => navigate(href, { replace: true }),
    back: () => navigate(-1),
    forward: () => navigate(1),
    refresh: () => navigate(0),
    prefetch: () => {},
  };
}

export function usePathname(): string {
  return useLocation().pathname;
}

export function useSearchParamsString(): string {
  return useLocation().search;
}
