import { fxJson, requestError, unavailable } from "@/lib/server/fx/api";
import { localFxService } from "@/lib/server/fx/service";

export async function GET(request: Request): Promise<Response> {
  const invalid = requestError(request);
  if (invalid) return invalid;
  try {
    const result = await localFxService().current();
    return fxJson(result, result.error ? 503 : 200);
  } catch (e) { return unavailable(e); }
}
