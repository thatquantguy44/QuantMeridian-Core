import { snapshotResponse } from "@/lib/server/presidential/reader";
export function GET(request: Request, context: { params: Record<string, string> }): Promise<Response> {
  return snapshotResponse(request, context.params.snapshotId);
}
