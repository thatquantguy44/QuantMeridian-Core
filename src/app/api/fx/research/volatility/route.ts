import { fxJson, requestError, unavailable } from "@/lib/server/fx/api";
import { localFxVolatilityService } from "@/lib/server/fx/service";

export async function GET(request: Request): Promise<Response> {
  const invalid = requestError(request);
  if (invalid) return invalid;
  try {
    const result = await localFxVolatilityService().current();
    return fxJson(result, result.error ? 503 : 200);
  } catch (e) { return unavailable(e, "VOLATILITY"); }
}
