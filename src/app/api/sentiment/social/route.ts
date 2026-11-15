import { fetchLiveSocial } from "@/lib/server/socialProviders";

export async function GET(request: Request): Promise<Response> {
  const headers = { "Content-Type": "application/json", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };
  if ([...new URL(request.url).searchParams].length) return new Response(JSON.stringify({ error: "No source or SIM overrides accepted." }), { status: 400, headers });
  try {
    const result = await fetchLiveSocial({ realOnly: true });
    return new Response(JSON.stringify({ source: result.source, ...result.intel }), { status: 200, headers });
  } catch {
    return new Response(JSON.stringify({ source: "ERR", platforms: [], tickers: [], sectors: [], themes: [], totalPosts: 0 }), { status: 503, headers });
  }
}
