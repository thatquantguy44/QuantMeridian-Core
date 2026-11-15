import { catalogResponse } from "@/lib/server/presidential/reader";
export function GET(request: Request): Promise<Response> { return catalogResponse(request); }
