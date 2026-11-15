import { json } from "@/lib/server/http";
import { PORA_ASSETS, PoraEvidenceError, type PoraAsset } from "@/lib/server/portfolioRegime/multiAssetEvidence";
import { readMultiAssetSnapshot } from "@/lib/server/portfolioRegime/multiAssetReader";

export const runtime = "nodejs";
const respond = (body: unknown, status = 200) => json(body, { status, headers: { "Cache-Control": "no-store" } });
/** Rechecks current data and returns a session-only artifact; no server persistence. */
export async function GET(request: Request) {
  const query = new URL(request.url).searchParams;
  const ids = (query.get("ids") ?? "").split(",");
  if ([...query.keys()].some((key) => key !== "ids") || query.getAll("ids").length !== 1 || ids.length < 2 || ids.length > 4 || new Set(ids).size !== ids.length || ids.some((id) => !PORA_ASSETS.includes(id as PoraAsset))) return respond({ snapshot: null, preview: null, error: "Select two to four distinct supported assets." }, 400);
  try { return respond(await readMultiAssetSnapshot(ids as PoraAsset[])); }
  catch (error) { return respond({ snapshot: null, preview: null, error: error instanceof PoraEvidenceError ? error.message : "Source history or retained evidence is unavailable." }, 503); }
}
