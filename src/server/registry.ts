/**
 * Single source of truth for the application's API surface.
 *
 * `import.meta.glob` eagerly bundles every `src/app/api/**​/route.ts` handler at
 * build time, so the same registry drives both the dev-server middleware and the
 * production server — there is no runtime filesystem walk and no risk of dev and
 * prod diverging. Each handler is a standard Web `Request → Response` function.
 */
import { buildPattern, extractParams, bySpecificity, type RouteDef } from "./routeMatch";
import { ensureProxy } from "@/lib/server/fetchProxy";

type RouteHandler = (
  request: Request,
  ctx: { params: Record<string, string> }
) => Promise<Response> | Response;

type RouteModule = Partial<
  Record<"GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "HEAD" | "OPTIONS", RouteHandler>
>;

interface RouteEntry extends RouteDef {
  module: RouteModule;
}

const modules = import.meta.glob<RouteModule>("/src/app/api/**/route.ts", { eager: true });

const entries: RouteEntry[] = Object.entries(modules)
  .map(([file, module]) => {
    const rel = file.replace(/^\/src\/app\/api\/?/, "").replace(/\/route\.tsx?$/, "");
    const segments = rel ? rel.split("/") : [];
    return { ...buildPattern(segments), module };
  })
  .sort(bySpecificity);

function jsonResponse(data: unknown, status: number): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

/**
 * Resolve and invoke the handler for an API request. Returns `null` for any
 * non-`/api` path so the caller can fall through to static/SPA handling, a 405
 * when the path matches but the method is unsupported, and a 404 when nothing
 * matches under `/api`.
 */
export async function handleApiRequest(request: Request): Promise<Response | null> {
  const url = new URL(request.url);
  if (!url.pathname.startsWith("/api/") && url.pathname !== "/api") return null;

  // Configure the outbound proxy (if any) before any route makes a fetch.
  await ensureProxy();

  for (const entry of entries) {
    const params = extractParams(entry, url.pathname);
    if (!params) continue;

    const method = (request.method ?? "GET").toUpperCase() as keyof RouteModule;
    const handler = entry.module[method] ?? (method === "HEAD" ? entry.module.GET : undefined);
    if (typeof handler !== "function") {
      return jsonResponse({ error: `Method ${method} not allowed` }, 405);
    }
    return handler(request, { params });
  }

  return jsonResponse({ error: "Not found" }, 404);
}
