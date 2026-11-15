import { describe, expect, it } from "vitest";
import { normalizeNaaimArtifact } from "./normalize";
import { naaimArtifactFixture } from "./testFixtures";

describe("NAAIM research artifact normalization", () => {
  it("keeps delayed attribution, current-vintage basis and exact observation dates", () => {
    const selection = normalizeNaaimArtifact(naaimArtifactFixture());
    expect(selection).toMatchObject({
      schemaVersion: "naaim-exposure-research/1",
      provenance: { delayedPublicDisplay: true, providerDelayMonths: 3, latestAsOfDate: "2026-07-08" },
    });
    expect(selection.observations).toEqual([
      expect.objectContaining({ asOfDate: "2026-07-01", exposure: 62.5 }),
      expect.objectContaining({ asOfDate: "2026-07-08", exposure: 71.25 }),
    ]);
    expect(JSON.stringify(selection)).not.toContain("authorized_research_use_reference");
  });
  it.each([
    ["wrong schema", { schema_version: "naaim-research/0" }],
    ["missing authorization", { provenance: { authorized_research_use_reference: "" } }],
    ["removed delay label", { provenance: { delayed_public_display: false } }],
    ["bad date", { observations: [{ ...naaimArtifactFixture().observations[0], as_of_date: "2026-02-30" }] }],
    ["numeric string not finite decimal", { observations: [{ ...naaimArtifactFixture().observations[0], value: "Infinity" }] }],
  ])("rejects %s without creating a replacement value", (_label, override) => {
    const fixture = naaimArtifactFixture();
    const next = { ...fixture, ...override, provenance: { ...fixture.provenance, ...(override as { provenance?: object }).provenance } };
    expect(() => normalizeNaaimArtifact(next)).toThrow();
  });
  it("rejects duplicate dates even when capture lineage differs", () => {
    const fixture = naaimArtifactFixture();
    fixture.observations.push({ ...fixture.observations[1], capture_id: "c".repeat(64) });
    expect(() => normalizeNaaimArtifact(fixture)).toThrow("DUPLICATE_DATE");
  });
});
