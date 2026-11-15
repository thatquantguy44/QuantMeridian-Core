import { fxJson, requestError, unavailable } from "@/lib/server/fx/api";
import { localFxHistoryService } from "@/lib/server/fx/service";
import { HISTORY_ID_PATTERN } from "@/lib/server/fx/history";

export async function GET(request: Request, context: { params: { id: string } }): Promise<Response> {
  const invalid = requestError(request);
  if (invalid) return invalid;
  if (!HISTORY_ID_PATTERN.test(context.params.id)) return fxJson({ error: { code: "REPLAY_UNAVAILABLE", message: "History identity is not supported." } }, 400);
  let service;
  try { service = localFxHistoryService(); } catch (e) { return unavailable(e, "HISTORY"); }
  try { return fxJson(await service.replay(context.params.id)); }
  catch (e) {
    const message = (e as Error).message;
    const code = ["INTEGRITY_FAILURE", "REPLAY_VERSION_UNSUPPORTED"].includes(message) ? message : "REPLAY_UNAVAILABLE";
    return fxJson({ error: { code, message: code === "INTEGRITY_FAILURE" ? "Retained history failed verification."
      : code === "REPLAY_VERSION_UNSUPPORTED" ? "The retained history's policy/method version is unsupported."
        : "Retained history is absent, expired or inaccessible." } }, code === "REPLAY_UNAVAILABLE" ? 404 : 409);
  }
}
