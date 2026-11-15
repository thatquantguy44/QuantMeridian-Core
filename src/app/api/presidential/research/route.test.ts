import { afterEach, describe, expect, it } from "vitest";
import { GET as catalog } from "./catalog/route";
import { GET as snapshot } from "./snapshots/[snapshotId]/route";

const env = { ...process.env };
afterEach(() => { process.env = { ...env }; });
function request(query = "", peer = "127.0.0.1") {
  const req = new Request(`http://localhost:3000/api/presidential/research/catalog${query}`);
  Object.defineProperty(req, Symbol.for("market-terminal.peer-address"), { value: peer });
  return req;
}
describe("PRES research routes", () => {
  it("returns sanitized 403, 400 and 503 errors", async () => {
    process.env.PRES_RESEARCH_LOCAL_ENABLED = "0";
    const forbidden = await catalog(request("", "192.0.2.1"));
    expect(forbidden.status).toBe(403);
    const invalid = await catalog(request("?root=x"));
    expect(invalid.status).toBe(400);
    const disabled = await catalog(request());
    expect(disabled.status).toBe(503);
    expect(await disabled.json()).toEqual({ error: { code: "LOCAL_NOT_CONFIGURED", message: "Local research data is not configured." }, selection: null });
    expect((await snapshot(request(), { params: { snapshotId: "../etc" } })).status).toBe(400);
  });
});
