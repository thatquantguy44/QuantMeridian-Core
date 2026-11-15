import type { ResearchDataset } from "./contracts";
import { canonicalJson } from "./exports";
import { parseResearchDataset } from "./validation";

const MAX_BYTES = 5 * 1024 * 1024;

/** Scan JSON before parsing so duplicate keys cannot be silently overwritten. */
function assertUniqueJsonKeys(text: string): void {
  let pos = 0;
  const whitespace = () => { while (/[\x20\t\r\n]/.test(text[pos] ?? "\0")) pos++; };
  const fail = (): never => { throw new Error("Invalid or ambiguous JSON."); };
  function string(): string {
    if (text[pos++] !== '"') return fail();
    const start = pos - 1;
    while (pos < text.length) {
      const character = text[pos++];
      if (character === '"') {
        try { return JSON.parse(text.slice(start, pos)) as string; } catch { return fail(); }
      }
      if (character === "\\") {
        if (pos >= text.length) return fail();
        pos++;
      } else if (character.charCodeAt(0) < 32) return fail();
    }
    return fail();
  }
  function value(depth: number): void {
    if (depth > 128) return fail();
    whitespace();
    const char = text[pos];
    if (char === '"') { string(); return; }
    if (char === "{") {
      pos++; whitespace();
      const seen = new Set<string>();
      if (text[pos] === "}") { pos++; return; }
      while (true) {
        whitespace(); const key = string();
        if (seen.has(key)) return fail();
        seen.add(key); whitespace();
        if (text[pos++] !== ":") return fail();
        value(depth + 1); whitespace();
        if (text[pos] === "}") { pos++; return; }
        if (text[pos++] !== ",") return fail();
      }
    }
    if (char === "[") {
      pos++; whitespace();
      if (text[pos] === "]") { pos++; return; }
      while (true) {
        value(depth + 1); whitespace();
        if (text[pos] === "]") { pos++; return; }
        if (text[pos++] !== ",") return fail();
      }
    }
    const token = /^(?:true|false|null|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?)/.exec(text.slice(pos));
    if (!token) return fail();
    pos += token[0].length;
  }
  value(0); whitespace();
  if (pos !== text.length) fail();
}

export function parseStrictJson(bytes: Uint8Array): unknown {
  const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  assertUniqueJsonKeys(text);
  return JSON.parse(text) as unknown;
}

export async function sha256Bytes(bytes: Uint8Array): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), value => value.toString(16).padStart(2, "0")).join("");
}

/** Pipeline reads accept only explicitly supplied, digest-verified v1 records. */
export async function parsePipelineDataset(bytes: Uint8Array, expectedSha256: string): Promise<ResearchDataset> {
  if (bytes.byteLength > MAX_BYTES || !/^[0-9a-f]{64}$/.test(expectedSha256)) throw new Error("Invalid dataset bounds or digest.");
  if (await sha256Bytes(bytes) !== expectedSha256) throw new Error("Dataset byte digest mismatch.");
  const input = parseStrictJson(bytes);
  function checkNumbers(value: unknown): void {
    if (typeof value === "number" && (!Number.isFinite(value) || (Number.isInteger(value) && !Number.isSafeInteger(value)))) throw new Error("Unsafe dataset number.");
    if (Array.isArray(value)) value.forEach(checkNumbers);
    else if (value !== null && typeof value === "object") Object.values(value).forEach(checkNumbers);
  }
  checkNumbers(input);
  const parsed = parseResearchDataset(input);
  if (parsed.kind !== "USER_SUPPLIED") throw new Error("Pipeline dataset requires explicit supplied inputs.");
  return parsed;
}

export async function canonicalDatasetSha256(dataset: ResearchDataset): Promise<string> {
  return sha256Bytes(new TextEncoder().encode(canonicalJson(dataset)));
}
