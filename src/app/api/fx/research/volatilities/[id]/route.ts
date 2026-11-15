import { fxJson, requestError, unavailable } from "@/lib/server/fx/api";
import { localFxVolatilityService } from "@/lib/server/fx/service";
import { VOLATILITY_ID_PATTERN } from "@/lib/fx/volatilityContracts";

export async function GET(request: Request, context: { params: { id: string } }): Promise<Response> {
  const invalid = requestError(request);
  if (invalid) return invalid;
  if (!VOLATILITY_ID_PATTERN.test(context.params.id)) return fxJson({ error: { code: "REPLAY_UNAVAILABLE", message: "Volatility identity is not supported." } }, 400);
  let service;
  try { service = localFxVolatilityService(); } catch (e) { return unavailable(e, "VOLATILITY"); }
  try { return fxJson(await service.replay(context.params.id)); }
  catch (e) {
    const message = (e as Error).message;
    const code = ["INTEGRITY_FAILURE", "REPLAY_VERSION_UNSUPPORTED"].includes(message) ? message : "REPLAY_UNAVAILABLE";
    return fxJson({ error: { code, message: code === "INTEGRITY_FAILURE" ? "Retained volatility failed verification."
      : code === "REPLAY_VERSION_UNSUPPORTED" ? "The retained volatility's policy/method version is unsupported."
        : "Retained volatility is absent, expired or inaccessible." } }, code === "REPLAY_UNAVAILABLE" ? 404 : 409);
  }
}
