import { createHash } from "node:crypto";
import { lstat, readFile, readdir, readlink } from "node:fs/promises";
import path from "node:path";

export function compareSnapshotPaths(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

export function snapshotHashes(bytes) {
  return {
    git_blob_sha: createHash("sha1")
      .update(Buffer.concat([Buffer.from(`blob ${bytes.length}\0`), bytes]))
      .digest("hex"),
    sha256: `sha256:${createHash("sha256").update(bytes).digest("hex")}`,
  };
}

function snapshotMode(stat, type) {
  if (type === "symlink") return "120000";
  return stat.mode & 0o111 ? "100755" : "100644";
}

export async function readSnapshotEntry(absolutePath) {
  const stat = await lstat(absolutePath);
  if (stat.isSymbolicLink()) {
    const linkTarget = await readlink(absolutePath);
    return {
      type: "symlink",
      mode: snapshotMode(stat, "symlink"),
      linkTarget,
      bytes: Buffer.from(linkTarget),
    };
  }
  if (!stat.isFile()) throw new Error(`unsupported snapshot entry type: ${absolutePath}`);
  return {
    type: "file",
    mode: snapshotMode(stat, "file"),
    bytes: await readFile(absolutePath),
  };
}

export async function collectSnapshotEntries(root, { excludeRootEntries = [] } = {}) {
  const entries = [];
  const excludedAtRoot = new Set(excludeRootEntries);

  async function visit(directory, relativeDirectory = "") {
    const children = await readdir(directory, { withFileTypes: true });
    children.sort((left, right) => compareSnapshotPaths(left.name, right.name));
    for (const child of children) {
      if (relativeDirectory === "" && excludedAtRoot.has(child.name)) continue;
      const relativePath = path.posix.join(relativeDirectory, child.name);
      const absolutePath = path.join(directory, child.name);
      if (child.isDirectory()) {
        await visit(absolutePath, relativePath);
        continue;
      }
      const entry = await readSnapshotEntry(absolutePath);
      entries.push({ relativePath, ...entry });
    }
  }

  await visit(root);
  return entries.sort((left, right) => compareSnapshotPaths(left.relativePath, right.relativePath));
}

function isSafeRelativePath(value) {
  return typeof value === "string"
    && value.length > 0
    && value !== "."
    && !path.posix.isAbsolute(value)
    && !value.split("/").includes("..")
    && !value.includes("\\");
}

function sameStringArray(left, right) {
  return Array.isArray(left)
    && Array.isArray(right)
    && left.length === right.length
    && left.every((value, index) => value === right[index]);
}

export async function validateAgentSkillsPin(pin, repositoryRoot = process.cwd()) {
  const errors = [];
  const localRoot = pin?.layout?.local_root;

  if (pin?.schema_version !== "agent-skills-pin/3") errors.push("unsupported pin schema");
  if (pin?.source?.repository !== "thatquantguy44/agent-skills") errors.push("unexpected source repository");
  if (pin?.source?.url !== "https://github.com/thatquantguy44/agent-skills") errors.push("unexpected source URL");
  if (!/^[0-9a-f]{40}$/.test(pin?.source?.commit ?? "")) errors.push("source commit must be a full immutable SHA");
  if (pin?.layout?.strategy !== "full-repository-mirror") errors.push("pin must use the full-repository-mirror strategy");
  if (pin?.layout?.source_root !== "." || localRoot !== ".agents") errors.push("unexpected snapshot layout");
  if (!Array.isArray(pin?.files) || pin.files.length === 0) errors.push("pinned file list is empty");

  const expectedLocalPaths = new Set();
  const sourcePaths = [];
  for (const file of pin?.files ?? []) {
    const sourcePath = file?.source_path;
    if (!isSafeRelativePath(sourcePath)) {
      errors.push(`unsafe source path: ${sourcePath}`);
      continue;
    }
    const expectedLocalPath = path.posix.join(localRoot ?? "", sourcePath);
    if (file.local_path !== expectedLocalPath || !isSafeRelativePath(file.local_path)) {
      errors.push(`invalid source/local mapping: ${sourcePath}`);
      continue;
    }
    if (expectedLocalPaths.has(file.local_path)) {
      errors.push(`duplicate pinned path: ${file.local_path}`);
      continue;
    }
    expectedLocalPaths.add(file.local_path);
    sourcePaths.push(sourcePath);

    let entry;
    try {
      entry = await readSnapshotEntry(path.join(repositoryRoot, ...file.local_path.split("/")));
    } catch {
      errors.push(`missing pinned path: ${file.local_path}`);
      continue;
    }
    if (file.type !== entry.type) errors.push(`entry type mismatch: ${file.local_path}`);
    if (file.mode !== entry.mode) errors.push(`Git mode mismatch: ${file.local_path}`);
    if (entry.type === "symlink" && file.link_target !== entry.linkTarget) {
      errors.push(`symlink target mismatch: ${file.local_path}`);
    }
    const hashes = snapshotHashes(entry.bytes);
    if (file.sha256 !== hashes.sha256) errors.push(`SHA-256 mismatch: ${file.local_path}`);
    if (file.git_blob_sha !== hashes.git_blob_sha) errors.push(`source Git blob mismatch: ${file.local_path}`);
  }

  const sortedSourcePaths = [...sourcePaths].sort(compareSnapshotPaths);
  if (!sameStringArray(sourcePaths, sortedSourcePaths)) errors.push("pinned file list must be sorted by source path");

  if (localRoot === ".agents") {
    try {
      const actualEntries = await collectSnapshotEntries(path.join(repositoryRoot, localRoot));
      const actualLocalPaths = new Set(actualEntries.map((entry) => path.posix.join(localRoot, entry.relativePath)));
      for (const actualPath of actualLocalPaths) {
        if (!expectedLocalPaths.has(actualPath)) errors.push(`unmanifested snapshot path: ${actualPath}`);
      }
      for (const expectedPath of expectedLocalPaths) {
        if (!actualLocalPaths.has(expectedPath)) errors.push(`manifest path absent from snapshot: ${expectedPath}`);
      }
    } catch {
      errors.push("snapshot root is missing or unreadable: .agents");
    }
  }

  const discoveredSkills = sourcePaths
    .map((sourcePath) => sourcePath.match(/^skills\/([^/]+)\/SKILL\.md$/)?.[1])
    .filter(Boolean)
    .sort(compareSnapshotPaths);
  const pinnedSkills = Array.isArray(pin?.skills) ? pin.skills : [];
  if (!sameStringArray(pinnedSkills, discoveredSkills)) errors.push("skill inventory does not match the full snapshot");

  return [...new Set(errors)];
}
