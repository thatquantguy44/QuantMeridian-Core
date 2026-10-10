/**
 * Framework-agnostic file-system route matching, shared by the dev-server
 * middleware (`vite-plugins/dev-api.ts`) and the standalone production server
 * (`src/server/index.ts`). Keeping the pattern logic in one place means dev and
 * prod resolve `src/app/api/**` identically — no second source of truth.
 *
 * This module must stay dependency-free (no `@/` alias, no `import.meta.glob`)
 * so it can be imported both from app code and from the Vite config context.
 */
export interface RouteDef {
  /** Matches a request pathname, e.g. `/api/market/SPX`. */
  pattern: RegExp;
  /** Dynamic-segment names captured by the pattern, in order. */
  paramNames: string[];
}

/** Turn `app/api`-relative path segments into a matcher (`[view]` → capture). */
export function buildPattern(segments: string[]): RouteDef {
  const paramNames: string[] = [];
  const parts = segments.map((seg) => {
    const dynamic = seg.match(/^\[(.+)\]$/);
    if (dynamic) {
      paramNames.push(dynamic[1]);
      return "([^/]+)";
    }
    return seg.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  });
  return {
    pattern: new RegExp(`^/api${parts.length ? "/" + parts.join("/") : ""}/?$`),
    paramNames,
  };
}

/** Match a pathname against a route, returning its decoded params or `null`. */
export function extractParams(def: RouteDef, pathname: string): Record<string, string> | null {
  const match = pathname.match(def.pattern);
  if (!match) return null;
  const params: Record<string, string> = {};
  def.paramNames.forEach((name, i) => {
    params[name] = decodeURIComponent(match[i + 1] ?? "");
  });
  return params;
}

/** Sort more-specific (longer) patterns first so static segments beat params. */
export function bySpecificity<T extends RouteDef>(a: T, b: T): number {
  return b.pattern.source.length - a.pattern.source.length;
}
