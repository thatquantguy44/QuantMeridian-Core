/**
 * Framework-agnostic JSON response helper, replacing `NextResponse.json`.
 * Returns a standard Web `Response` so the API route handlers run unchanged
 * under the Vite dev server middleware (and any other Web-standard runtime).
 */
export function json(data: unknown, init?: ResponseInit): Response {
  const headers = new Headers(init?.headers);
  if (!headers.has("content-type")) {
    headers.set("content-type", "application/json; charset=utf-8");
  }
  return new Response(JSON.stringify(data), { ...init, headers });
}
