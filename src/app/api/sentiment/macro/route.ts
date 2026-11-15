import { goldEnabled } from "@/lib/server/goldStore";
import { readSentMacro } from "@/lib/server/sentMacro";
import { emptyMacroSeries } from "@/lib/sentiment/macro";

function json(value: unknown, status: number) {
  return new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
}
export async function GET(request: Request): Promise<Response> {
  if ([...new URL(request.url).searchParams].length) return json({ error: { code: "INVALID_REQUEST", message: "This read accepts no source, date or SIM overrides." } }, 400);
  try {
    if (!goldEnabled()) throw new Error("SOURCE_UNAVAILABLE");
    return json(await readSentMacro(), 200);
  } catch (error) {
    const integrity = error instanceof Error && error.message === "INTEGRITY_FAILURE";
    return json({ schemaVersion: "sent-macro/1", assessedAt: new Date().toISOString(), series: emptyMacroSeries(integrity ? "INTEGRITY_FAILURE" : "SOURCE_UNAVAILABLE"),
      error: { code: integrity ? "INTEGRITY_FAILURE" : "SOURCE_UNAVAILABLE", message: integrity ? "Macro source validation failed." : "Macro Gold source is unavailable." } }, 503);
  }
}
