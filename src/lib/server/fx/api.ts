import { emptyVolatilityPairs } from "./volatility";
import { blockedPairs } from "./snapshot";
import { emptyHistoryPairs } from "./history";

export function fxJson(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), { status, headers: {
    "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  } });
}
export function requestError(request: Request): Response | null {
  const url = new URL(request.url);
  const peer = (request as unknown as Record<symbol, unknown>)[Symbol.for("market-terminal.peer-address")];
  if (!["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(String(peer)) ||
    !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) || request.headers.get("origin") && request.headers.get("origin") !== url.origin) {
    return fxJson({ error: { code: "LOCAL_ONLY", message: "FX snapshots are available only in the configured local research application." } }, 403);
  }
  if ([...url.searchParams].length) return fxJson({ error: { code: "INVALID_REQUEST", message: "This slice accepts no query parameters, dates or purpose overrides." } }, 400);
  return null;
}
export function unavailable(error: unknown, kind: "LEVEL" | "HISTORY" | "VOLATILITY" = "LEVEL") {
  const code = (error as Error).message === "LOCAL_NOT_CONFIGURED" ? "LOCAL_NOT_CONFIGURED" : "RETENTION_UNAVAILABLE";
  const message = code === "LOCAL_NOT_CONFIGURED" ? "Local FX research is not configured. No reference snapshot is available." : "Local snapshot retention is unavailable.";
  return fxJson({ ...(kind === "LEVEL" ? { snapshot: null, pairs: blockedPairs(code, message) }
    : kind === "HISTORY" ? { history: null, pairs: emptyHistoryPairs(code, message) } : { volatility: null, pairs: emptyVolatilityPairs(code, message) }), error: { code, message },
    assessedAt: new Date().toISOString(), nextCheckAt: null, retained: null }, 503);
}
