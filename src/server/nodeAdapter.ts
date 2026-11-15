/**
 * Adapters between Node's `http` primitives and the Web `Request`/`Response`
 * objects the route handlers speak. Shared by the dev-server middleware and the
 * standalone production server so both convert requests/responses identically.
 */
import type { IncomingMessage, ServerResponse } from "node:http";

/** Optional limits are applied at socket ingestion for bounded research routes. */
export function readBody(req: IncomingMessage, limits?: { maxBytes: number; timeoutMs: number; signal?: AbortSignal }): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let length = 0;
    const cleanup = () => {
      clearTimeout(timer); req.off("data", data); req.off("end", end); req.off("error", fail);
      req.off("aborted", aborted); limits?.signal?.removeEventListener("abort", aborted);
    };
    const fail = (error: Error) => { cleanup(); reject(error); };
    const rejected = (status: number, message: string) => { req.pause(); fail(Object.assign(new Error(message), { status })); };
    const aborted = () => rejected(408, "Request cancelled");
    const data = (chunk: Buffer) => {
      length += chunk.length;
      if (limits && length > limits.maxBytes) return rejected(413, "Request too large");
      chunks.push(chunk);
    };
    const end = () => { cleanup(); resolve(Buffer.concat(chunks)); };
    const timer = limits ? setTimeout(() => rejected(408, "Request body timeout"), limits.timeoutMs) : undefined;
    req.on("data", data); req.once("end", end); req.once("error", fail); req.once("aborted", aborted);
    limits?.signal?.addEventListener("abort", aborted, { once: true });
    if (limits?.signal?.aborted) aborted();
  });
}

/** Use on bounded research requests; disconnecting a browser aborts upstream fetch. */
export function linkClientAbort(req: IncomingMessage, res: ServerResponse) {
  const controller = new AbortController();
  const abort = () => controller.abort();
  const close = () => { if (!res.writableFinished) abort(); };
  req.once("aborted", abort); res.once("close", close);
  if (req.aborted || res.destroyed) abort();
  return { signal: controller.signal, cleanup: () => { req.off("aborted", abort); res.off("close", close); } };
}

export function toWebRequest(req: IncomingMessage, url: URL, body?: Buffer, signal?: AbortSignal): Request {
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (Array.isArray(value)) value.forEach((v) => headers.append(key, v));
    else if (typeof value === "string") headers.set(key, value);
  }
  const method = (req.method ?? "GET").toUpperCase();
  const hasBody = body && body.length > 0 && method !== "GET" && method !== "HEAD";
  const request = new Request(url.toString(), {
    method,
    headers,
    signal,
    ...(hasBody ? { body, duplex: "half" } : {}),
  } as RequestInit);
  // Internal socket evidence, never taken from Host or forwarding headers.
  // Symbol.for keeps this identity across Vite's config and SSR module graphs.
  Object.defineProperty(request, Symbol.for("market-terminal.peer-address"), { value: req.socket.remoteAddress });
  return request;
}

export async function sendWebResponse(res: ServerResponse, response: Response): Promise<void> {
  res.statusCode = response.status;
  response.headers.forEach((value, key) => res.setHeader(key, value));
  const buffer = Buffer.from(await response.arrayBuffer());
  if (!res.hasHeader("content-length")) res.setHeader("content-length", String(buffer.byteLength));
  await new Promise<void>((resolve, reject) => {
    res.once("error", reject);
    res.end(buffer, () => {
      res.off("error", reject);
      resolve();
    });
  });
}
