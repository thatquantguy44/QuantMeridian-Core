/**
 * Vercel serverless catch-all for `/api/*`.
 *
 * Vercel's function bundler cannot resolve the app's `@/` aliases or Vite's
 * `import.meta.glob`, so this function loads the **Vite-built** handler bundle
 * (`dist-vercel/handler.js`, produced by `npm run build:vercel` before functions
 * are bundled) rather than the TypeScript source. The Node↔Web adapters come
 * from `src/server/nodeAdapter.ts`, which is alias-free and bundles directly.
 *
 * The handler bundle is imported dynamically inside the request so that, if the
 * build step didn't produce/include it, the endpoint returns a clear JSON error
 * instead of a silent platform 500 (which would just look like SIM downstream).
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import { toWebRequest, sendWebResponse, readBody } from "../src/server/nodeAdapter";

type Registry = { handleApiRequest: (request: Request) => Promise<Response | null> };

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  let registry: Registry;
  try {
    // Literal specifier so @vercel/nft traces & bundles the built handler.
    registry = (await import("../dist-vercel/handler.js")) as unknown as Registry;
  } catch (err) {
    res.statusCode = 500;
    res.setHeader("content-type", "application/json");
    res.end(
      JSON.stringify({
        error: "api-handler-bundle-not-loaded",
        detail: (err as Error).message,
        hint: "build:vercel must produce dist-vercel/handler.js before functions are bundled",
      })
    );
    return;
  }

  try {
    const url = new URL(req.url ?? "/", `https://${req.headers.host ?? "localhost"}`);
    const method = (req.method ?? "GET").toUpperCase();
    const body =
      method !== "GET" && method !== "HEAD" && !req.readableEnded ? await readBody(req) : undefined;

    const request = toWebRequest(req, url, body);
    const response = await registry.handleApiRequest(request);
    if (!response) {
      res.statusCode = 404;
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify({ error: "Not found" }));
      return;
    }
    await sendWebResponse(res, response);
  } catch (err) {
    res.statusCode = 500;
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ error: (err as Error).message ?? "internal error" }));
  }
}
