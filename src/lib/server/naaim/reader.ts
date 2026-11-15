import { promises as fs } from "node:fs";
import path from "node:path";
import { normalizeNaaimArtifact } from "@/lib/naaim/normalize";

const MAX_ARTIFACT_BYTES = 1_000_000;

/** NAAIM is an explicitly enabled local research artifact, never a remote feed. */
export function localNaaimConfigured(): boolean {
  if (process.env.NAAIM_RESEARCH_LOCAL_ENABLED !== "1" || process.env.NODE_ENV === "production" ||
      process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) return false;
  const candidate = process.env.NAAIM_RESEARCH_ARTIFACT_PATH;
  return typeof candidate === "string" && candidate.length > 0 && path.isAbsolute(candidate);
}

export async function readNaaimArtifact(artifactPath: string) {
  let info: Awaited<ReturnType<typeof fs.lstat>>;
  try { info = await fs.lstat(artifactPath); }
  catch { throw new Error("SOURCE_UNAVAILABLE"); }
  if (!info.isFile() || info.size < 1 || info.size > MAX_ARTIFACT_BYTES) throw new Error("INTEGRITY_FAILURE");
  let raw: string;
  try { raw = await fs.readFile(artifactPath, "utf8"); }
  catch { throw new Error("SOURCE_UNAVAILABLE"); }
  try { return normalizeNaaimArtifact(JSON.parse(raw)); }
  catch (error) {
    if (error instanceof SyntaxError) throw new Error("INTEGRITY_FAILURE");
    throw new Error("INTEGRITY_FAILURE");
  }
}

let active: ReturnType<typeof capture> | undefined;
async function capture() {
  const readStartedAt = new Date().toISOString();
  const selection = await readNaaimArtifact(process.env.NAAIM_RESEARCH_ARTIFACT_PATH!);
  return { selection, readStartedAt, readCompletedAt: new Date().toISOString() };
}
export function readLocalNaaim() {
  if (!localNaaimConfigured()) throw new Error("LOCAL_NOT_CONFIGURED");
  // Coalesce only simultaneous local file reads; never cache prior artifact content.
  if (!active) active = capture().finally(() => { active = undefined; });
  return active;
}
