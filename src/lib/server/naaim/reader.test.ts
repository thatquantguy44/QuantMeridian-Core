import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, writeFile, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { naaimArtifactFixture } from "@/lib/naaim/testFixtures";
import { localNaaimConfigured, readNaaimArtifact } from "./reader";

afterEach(() => vi.unstubAllEnvs());
describe("NAAIM local research artifact reader", () => {
  it("reads only a bounded local artifact and validates it before presentation", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "naaim-test-"));
    const artifact = path.join(directory, "naaim.json");
    await writeFile(artifact, JSON.stringify(naaimArtifactFixture()));
    await expect(readNaaimArtifact(artifact)).resolves.toMatchObject({
      provenance: { latestAsOfDate: "2026-07-08", delayedPublicDisplay: true },
    });
    await writeFile(artifact, "not json");
    await expect(readNaaimArtifact(artifact)).rejects.toThrow("INTEGRITY_FAILURE");
  });
  it("rejects missing files and symlink indirection", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "naaim-test-"));
    await expect(readNaaimArtifact(path.join(directory, "missing.json"))).rejects.toThrow("SOURCE_UNAVAILABLE");
    const original = path.join(directory, "artifact.json"), linked = path.join(directory, "linked.json");
    await writeFile(original, JSON.stringify(naaimArtifactFixture()));
    await symlink(original, linked);
    await expect(readNaaimArtifact(linked)).rejects.toThrow("INTEGRITY_FAILURE");
  });
  it("requires local opt-in, an absolute path, and is always disabled outside local development", () => {
    vi.stubEnv("NODE_ENV", "test"); vi.stubEnv("VERCEL", ""); vi.stubEnv("AWS_LAMBDA_FUNCTION_NAME", "");
    vi.stubEnv("NAAIM_RESEARCH_LOCAL_ENABLED", "1"); vi.stubEnv("NAAIM_RESEARCH_ARTIFACT_PATH", "/tmp/naaim.json");
    expect(localNaaimConfigured()).toBe(true);
    vi.stubEnv("NAAIM_RESEARCH_ARTIFACT_PATH", "data/naaim.json"); expect(localNaaimConfigured()).toBe(false);
    vi.stubEnv("NAAIM_RESEARCH_ARTIFACT_PATH", "/tmp/naaim.json"); vi.stubEnv("NODE_ENV", "production");
    expect(localNaaimConfigured()).toBe(false);
  });
});
