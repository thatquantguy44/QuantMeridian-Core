import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { canonicalJson } from "./exports";
import { canonicalDatasetSha256, parsePipelineDataset, sha256Bytes } from "./pipelineContract";

const vectorBytes = readFileSync("contracts/presidential_research/v1/boundary-vectors.json");
const vectors = JSON.parse(vectorBytes.toString("utf8"));
const pinnedSha = "7b8c29241d3f4a598e25254397c07f766efc1c3d5122575ee5f2fe4b131aa417";

describe("PR016-R06/N02 producer/consumer contract", () => {
  it("pins the producer's exact vector bytes", () => {
    expect(createHash("sha256").update(vectorBytes).digest("hex")).toBe(pinnedSha);
  });
  it("pins the structural schema", () => {
    const schema = readFileSync("contracts/presidential_research/v1/research-dataset.schema.json");
    expect(createHash("sha256").update(schema).digest("hex")).toBe("fca119b40d45307960417bb6e17fa1fce1bc1f65594e7fd0bd9fad762b5e75b3");
    expect(JSON.parse(schema.toString("utf8")).properties.kind).toEqual({ const: "USER_SUPPLIED" });
  });
  for (const sample of vectors.datasetCases) {
    it(sample.name, async () => {
      const bytes = new TextEncoder().encode(sample.payload);
      expect(await sha256Bytes(bytes)).toBe(sample.sha256);
      if (sample.valid) {
        const dataset = await parsePipelineDataset(bytes, sample.sha256);
        expect(canonicalJson(dataset)).toBe(sample.canonical);
        expect(await canonicalDatasetSha256(dataset)).toBe(sample.canonicalSha256);
        await expect(parsePipelineDataset(bytes, "0".repeat(64))).rejects.toThrow(/digest/i);
      } else {
        await expect(parsePipelineDataset(bytes, sample.sha256)).rejects.toThrow();
      }
    });
  }
  for (const sample of vectors.canonicalCases) {
    it(`canonical ${sample.name}`, () => expect(canonicalJson(sample.value)).toBe(sample.expected));
  }
  it("rejects escaped duplicate keys, invalid UTF-8 and oversized payloads", async () => {
    for (const bytes of [new TextEncoder().encode('{"a":1,"\\u0061":2}'), new Uint8Array([0xff]), new Uint8Array(5 * 1024 * 1024 + 1)]) {
      await expect(parsePipelineDataset(bytes, await sha256Bytes(bytes))).rejects.toThrow();
    }
  });
});
