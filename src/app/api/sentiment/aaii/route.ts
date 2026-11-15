import { readLocalAaii } from "@/lib/server/aaii/reader";

function json(value: unknown, status: number) {
  return new Response(JSON.stringify(value), { status, headers: {
    "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff",
  } });
}
export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const peer = (request as unknown as Record<symbol, unknown>)[Symbol.for("market-terminal.peer-address")];
  const origin = request.headers.get("origin");
  if (!["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(String(peer)) ||
      !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) || origin && origin !== url.origin) {
    return json({ selection: null, error: { code: "LOCAL_ONLY", message: "AAII is available only in the private local research application." } }, 403);
  }
  if ([...url.searchParams].length) return json({ selection: null, error: { code: "INVALID_REQUEST", message: "This read accepts no parameters or source/date overrides." } }, 400);
  try { return json({ ...await readLocalAaii(), error: null }, 200); }
  catch (error) {
    const candidate = error instanceof Error ? error.message : "";
    const code = ["LOCAL_NOT_CONFIGURED", "READER_NOT_ADMITTED", "INTEGRITY_FAILURE"].includes(candidate) ? candidate : "SOURCE_UNAVAILABLE";
    const message = code === "LOCAL_NOT_CONFIGURED" ? "Private local AAII research is not configured."
      : code === "READER_NOT_ADMITTED" ? "AAII reader access was not admitted."
      : code === "INTEGRITY_FAILURE" ? "AAII observations failed validation." : "AAII source is unavailable.";
    return json({ selection: null, readStartedAt: null, readCompletedAt: null, error: { code, message } }, 503);
  }
}
