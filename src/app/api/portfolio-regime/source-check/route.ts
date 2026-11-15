import { json } from "@/lib/server/http";
import { PORA_ASSETS, PoraEvidenceError, type PoraAsset } from "@/lib/server/portfolioRegime/multiAssetEvidence";
import { readMultiAssetPreview } from "@/lib/server/portfolioRegime/multiAssetReader";

export const runtime = "nodejs";
const respond = (body: unknown, status = 200) => json(body, { status, headers: { "Cache-Control": "no-store" } });
export async function GET(request: Request) {
  const query = new URL(request.url).searchParams;
  const ids = (query.get("ids") ?? "").split(",");
  if ([...query.keys()].some((key) => key !== "ids") || query.getAll("ids").length !== 1 || ids.length < 2 || ids.length > 4 || new Set(ids).size !== ids.length || ids.some((id) => !PORA_ASSETS.includes(id as PoraAsset))) return respond({ source: "ERR", assets: [], error: "Select two to four distinct supported assets." }, 400);
  try { return respond(await readMultiAssetPreview(ids as PoraAsset[])); }
  catch (error) { return respond({ source: "ERR", assets: [], error: error instanceof PoraEvidenceError ? error.message : "Source history or retained evidence is unavailable." }, 503); }
}
