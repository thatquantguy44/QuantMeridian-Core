import { expect, it } from "vitest";
import type { IncomingMessage } from "node:http";
import { toWebRequest } from "./nodeAdapter";

it("preserves socket evidence separately from spoofable HTTP headers", () => {
  const req = { method: "GET", headers: { host: "localhost", "x-forwarded-for": "127.0.0.1", "market-terminal.peer-address": "127.0.0.1" },
    socket: { remoteAddress: "192.0.2.7" } } as unknown as IncomingMessage;
  const request = toWebRequest(req, new URL("http://localhost/api/fx/research/snapshot"));
  expect((request as unknown as Record<symbol, unknown>)[Symbol.for("market-terminal.peer-address")]).toBe("192.0.2.7");
  expect(Object.getOwnPropertyDescriptor(request, Symbol.for("market-terminal.peer-address"))?.writable).toBe(false);
});

it("bounds research socket ingestion and propagates client disconnect", async () => {
  const { EventEmitter } = await import("node:events");
  const { readBody, linkClientAbort } = await import("./nodeAdapter");
  const req = Object.assign(new EventEmitter(), { method: "POST", headers: {}, socket: { remoteAddress: "127.0.0.1" }, pause() {} }) as unknown as IncomingMessage;
  const res = Object.assign(new EventEmitter(), { writableFinished: false }) as unknown as import("node:http").ServerResponse;
  const lifecycle = linkClientAbort(req, res);
  const request = toWebRequest(req, new URL("http://localhost/api/example/run"), Buffer.from("{}"), lifecycle.signal);
  res.emit("close"); expect(request.signal.aborted).toBe(true); lifecycle.cleanup();
  const pending = readBody(req, { maxBytes: 16, timeoutMs: 100 });
  req.emit("data", Buffer.alloc(17));
  await expect(pending).rejects.toMatchObject({ status: 413 });
  await expect(readBody(req, { maxBytes: 16, timeoutMs: 5 })).rejects.toMatchObject({ status: 408 });
});
