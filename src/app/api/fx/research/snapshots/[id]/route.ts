import { fxJson, requestError, unavailable } from "@/lib/server/fx/api";
import { localFxService } from "@/lib/server/fx/service";
import { ID_PATTERN } from "@/lib/server/fx/snapshot";

export async function GET(request: Request, context: { params: { id: string } }): Promise<Response> {
  const invalid = requestError(request);
  if (invalid) return invalid;
  if (!ID_PATTERN.test(context.params.id)) return fxJson({ error: { code: "REPLAY_UNAVAILABLE", message: "Snapshot ID is not supported." } }, 400);
  let service;
  try { service = localFxService(); } catch (e) { return unavailable(e); }
  try { return fxJson(await service.replay(context.params.id)); }
  catch (e) {
    const message = (e as Error).message;
    const code = ["INTEGRITY_FAILURE", "REPLAY_VERSION_UNSUPPORTED"].includes(message) ? message : "REPLAY_UNAVAILABLE";
    return fxJson({ error: { code, message: code === "INTEGRITY_FAILURE" ? "Retained snapshot failed verification."
      : code === "REPLAY_VERSION_UNSUPPORTED" ? "The retained snapshot's policy/method version is unsupported."
        : "Retained snapshot is absent, expired or inaccessible." } }, code === "REPLAY_UNAVAILABLE" ? 404 : 409);
  }
}
