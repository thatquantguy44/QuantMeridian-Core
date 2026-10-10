import type { IncomingMessage, ServerResponse } from "node:http";

/**
 * Minimal, self-contained Vercel diagnostic — no app imports, no Vite bundle.
 * Visit /api/_ping on the deployment to isolate what's broken:
 *   - JSON with fredKeyPresent:true  → functions run AND the env var is bound;
 *     the problem is downstream (the main function's bundle import or FRED).
 *   - JSON with fredKeyPresent:false → functions run but the env var isn't in
 *     this deployment's runtime → set it for this environment and redeploy.
 *   - The app UI / 404 instead of JSON → serverless functions aren't running
 *     at all (vercel.json / framework / routing), not an env issue.
 */
export default function handler(_req: IncomingMessage, res: ServerResponse): void {
  res.statusCode = 200;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.end(
    JSON.stringify({
      ok: true,
      runtime: "vercel-serverless",
      node: process.version,
      now: new Date().toISOString(),
      fredKeyPresent: Boolean(process.env.FRED_API_KEY),
      fredKeyLen: (process.env.FRED_API_KEY ?? "").length,
      marketPipelineConfigured: Boolean(process.env.MARKET_PIPELINE_URL || process.env.MARKET_DB_URL),
    })
  );
}
