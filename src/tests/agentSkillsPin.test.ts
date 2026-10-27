import { createHash } from "node:crypto";
import { mkdtemp, mkdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { validateAgentSkillsPin } from "../../scripts/lib/agent-skills-pin.mjs";

const temporaryRoots: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

function hashes(bytes: Buffer) {
  return {
    git_blob_sha: createHash("sha1")
      .update(Buffer.concat([Buffer.from(`blob ${bytes.length}\0`), bytes]))
      .digest("hex"),
    sha256: `sha256:${createHash("sha256").update(bytes).digest("hex")}`,
  };
}

async function fixture() {
  const repositoryRoot = await mkdtemp(join(tmpdir(), "agent-skills-pin-test-"));
  temporaryRoots.push(repositoryRoot);
  await mkdir(join(repositoryRoot, ".agents/skills/example"), { recursive: true });
  await mkdir(join(repositoryRoot, ".agents/.opencode"), { recursive: true });

  const skillBytes = Buffer.from("---\nname: example\n---\n");
  const linkTarget = "../skills/";
  await writeFile(join(repositoryRoot, ".agents/skills/example/SKILL.md"), skillBytes);
  await symlink(linkTarget, join(repositoryRoot, ".agents/.opencode/skills"));

  const pin = {
    schema_version: "agent-skills-pin/3",
    source: {
      repository: "thatquantguy44/agent-skills",
      url: "https://github.com/thatquantguy44/agent-skills",
      commit: "f63ec56a3cc936408d792956ae583c3c96a825bd",
      reviewed_on: "2026-10-24",
    },
    layout: {
      strategy: "full-repository-mirror",
      source_root: ".",
      local_root: ".agents",
    },
    skills: ["example"],
    files: [
      {
        source_path: ".opencode/skills",
        local_path: ".agents/.opencode/skills",
        type: "symlink",
        mode: "120000",
        link_target: linkTarget,
        ...hashes(Buffer.from(linkTarget)),
      },
      {
        source_path: "skills/example/SKILL.md",
        local_path: ".agents/skills/example/SKILL.md",
        type: "file",
        mode: "100644",
        ...hashes(skillBytes),
      },
    ],
  };

  return { pin, repositoryRoot };
}

describe("full Agent Skills repository pin", () => {
  it("accepts a complete byte-for-byte mirror including symlinks", async () => {
    const { pin, repositoryRoot } = await fixture();
    await expect(validateAgentSkillsPin(pin, repositoryRoot)).resolves.toEqual([]);
  });

  it("rejects changed and unmanifested snapshot content", async () => {
    const { pin, repositoryRoot } = await fixture();
    await writeFile(join(repositoryRoot, ".agents/skills/example/SKILL.md"), "changed\n");
    await writeFile(join(repositoryRoot, ".agents/unreviewed.txt"), "surprise\n");

    const errors = await validateAgentSkillsPin(pin, repositoryRoot);
    expect(errors).toContain("SHA-256 mismatch: .agents/skills/example/SKILL.md");
    expect(errors).toContain("unmanifested snapshot path: .agents/unreviewed.txt");
  });
});
