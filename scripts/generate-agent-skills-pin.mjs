import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import { compareSnapshotPaths, readSnapshotEntry, snapshotHashes } from "./lib/agent-skills-pin.mjs";

function option(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

const sourceRoot = option("--source-root");
const commit = option("--commit");
const reviewedOn = option("--reviewed-on");
if (!sourceRoot || !/^[0-9a-f]{40}$/.test(commit ?? "") || !/^\d{4}-\d{2}-\d{2}$/.test(reviewedOn ?? "")) {
  console.error("Usage: node scripts/generate-agent-skills-pin.mjs --source-root <directory> --commit <40-char-sha> --reviewed-on <YYYY-MM-DD>");
  process.exit(1);
}

const existingPin = JSON.parse(await readFile("contracts/agent/agent-skills.pin.json", "utf8"));
const resolvedSourceRoot = path.resolve(sourceRoot);
let checkedOutCommit;
let workingTreeStatus;
let trackedPaths;
try {
  checkedOutCommit = execFileSync("git", ["-C", resolvedSourceRoot, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  workingTreeStatus = execFileSync("git", ["-C", resolvedSourceRoot, "status", "--porcelain"], { encoding: "utf8" }).trim();
  trackedPaths = execFileSync("git", ["-C", resolvedSourceRoot, "ls-files", "-z"], { encoding: "utf8" })
    .split("\0")
    .filter(Boolean)
    .sort(compareSnapshotPaths);
} catch {
  console.error("Source root must be a readable Git checkout.");
  process.exit(1);
}
if (checkedOutCommit !== commit) {
  console.error(`Source checkout is ${checkedOutCommit}, not declared commit ${commit}.`);
  process.exit(1);
}
if (workingTreeStatus !== "") {
  console.error("Source checkout must be clean before generating the pin.");
  process.exit(1);
}

const entries = await Promise.all(trackedPaths.map(async (relativePath) => ({
  relativePath,
  ...await readSnapshotEntry(path.join(resolvedSourceRoot, ...relativePath.split("/"))),
})));
const files = entries.map((entry) => ({
  source_path: entry.relativePath,
  local_path: path.posix.join(".agents", entry.relativePath),
  type: entry.type,
  mode: entry.mode,
  ...(entry.type === "symlink" ? { link_target: entry.linkTarget } : {}),
  ...snapshotHashes(entry.bytes),
}));
const skills = files
  .map((file) => file.source_path.match(/^skills\/([^/]+)\/SKILL\.md$/)?.[1])
  .filter(Boolean)
  .sort(compareSnapshotPaths);

const pin = {
  schema_version: "agent-skills-pin/3",
  source: {
    repository: existingPin.source.repository,
    url: existingPin.source.url,
    commit,
    reviewed_on: reviewedOn,
  },
  layout: {
    strategy: "full-repository-mirror",
    source_root: ".",
    local_root: ".agents",
  },
  skills,
  files,
};

await writeFile("contracts/agent/agent-skills.pin.json", `${JSON.stringify(pin, null, 2)}\n`);
console.log(`Wrote full Agent Skills pin for ${files.length} paths and ${skills.length} skills.`);
