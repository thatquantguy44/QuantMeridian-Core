import { constants } from "node:fs";
import { link, lstat, mkdir, open, readdir, unlink } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { canonical, ID_PATTERN, ID_PREFIX, POLICIES, verifyManifest, type FxManifest } from "./snapshot";
import { HISTORY_ID_PATTERN, HISTORY_ID_PREFIX, verifyHistoryManifest, type FxHistoryManifest } from "./history";

import { VOLATILITY_ID_PATTERN, VOLATILITY_ID_PREFIX } from "@/lib/fx/volatilityContracts";
import { verifyVolatilityManifest, type FxVolatilityManifest } from "./volatility";

const MAX_BYTES = 1_048_576;
const FILE_PATTERN = /^[a-f0-9]{64}\.json$/;
const maxAge = POLICIES.retention.days * 86_400_000;
type Artifact = FxManifest | FxHistoryManifest | FxVolatilityManifest;
function header(m: Artifact) { return "volatility" in m ? m.volatility : "history" in m ? m.history : m.snapshot; }
function identity(m: Artifact) { return "volatility" in m ? m.volatility.volatilityId : "history" in m ? m.history.historyId : m.snapshot.snapshotId; }
function verifyArtifact(value: unknown): Artifact {
  if (value && typeof value === "object" && "volatility" in value) return verifyVolatilityManifest(value);
  return value && typeof value === "object" && "history" in value ? verifyHistoryManifest(value) : verifyManifest(value);
}

/** One local persistent directory, with an exclusive cross-process publication lock. */
export class FxSnapshotStore {
  private pending: Promise<unknown> = Promise.resolve();
  constructor(private readonly root: string) {}
  private filename(id: string) {
    const prefix = ID_PATTERN.test(id) ? ID_PREFIX : HISTORY_ID_PATTERN.test(id) ? HISTORY_ID_PREFIX : VOLATILITY_ID_PATTERN.test(id) ? VOLATILITY_ID_PREFIX : null;
    if (!prefix) throw new Error("REPLAY_UNAVAILABLE");
    return join(this.root, `${id.slice(prefix.length)}.json`);
  }
  private async readFile(path: string): Promise<unknown> {
    const file = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
    try {
      const stat = await file.stat();
      if (!stat.isFile() || stat.size > MAX_BYTES) throw new Error("INTEGRITY_FAILURE");
      const bytes = Buffer.alloc(stat.size + 1);
      const { bytesRead } = await file.read(bytes, 0, bytes.length, 0);
      if (bytesRead > MAX_BYTES) throw new Error("INTEGRITY_FAILURE");
      return JSON.parse(bytes.subarray(0, bytesRead).toString("utf8"));
    } finally { await file.close(); }
  }
  private async getArtifact(id: string, now: string): Promise<Artifact> {
    const path = this.filename(id);
    try {
      const m = verifyArtifact(await this.readFile(path));
      if (identity(m) !== id) throw new Error("INTEGRITY_FAILURE");
      const age = Date.parse(now) - Date.parse(header(m).createdAt);
      if (!Number.isFinite(age) || age < 0 || age >= maxAge) {
        if (age >= maxAge) await this.sweep(now);
        throw new Error("REPLAY_UNAVAILABLE");
      }
      return m;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") throw new Error("REPLAY_UNAVAILABLE");
      throw error;
    }
  }
  async get(id: string, now: string): Promise<FxManifest> {
    if (!ID_PATTERN.test(id)) throw new Error("REPLAY_UNAVAILABLE");
    const m = await this.getArtifact(id, now);
    if (!("snapshot" in m)) throw new Error("REPLAY_UNAVAILABLE");
    return m;
  }
  async getHistory(id: string, now: string): Promise<FxHistoryManifest> {
    if (!HISTORY_ID_PATTERN.test(id)) throw new Error("REPLAY_UNAVAILABLE");
    const m = await this.getArtifact(id, now);
    if (!("history" in m)) throw new Error("REPLAY_UNAVAILABLE");
    return m;
  }
  async getVolatility(id: string, now: string): Promise<FxVolatilityManifest> {
    if (!VOLATILITY_ID_PATTERN.test(id)) throw new Error("REPLAY_UNAVAILABLE");
    const m = await this.getArtifact(id, now);
    if (!("volatility" in m)) throw new Error("REPLAY_UNAVAILABLE");
    return m;
  }
  private async entries() {
    let files: string[];
    try { files = (await readdir(this.root)).filter(f => FILE_PATTERN.test(f)); }
    catch (e) { if ((e as NodeJS.ErrnoException).code === "ENOENT") return []; throw e; }
    if (files.length > 1000) throw new Error("RETENTION_UNAVAILABLE");
    // This timestamp is only an eviction index. Every actual replay validates the
    // complete digest and recomputes the original outcomes before returning data.
    const entries = [];
    for (const file of files) {
      const parsed = await this.readFile(join(this.root, file)) as Artifact;
      const at = Date.parse(header(parsed).createdAt);
      if (!Number.isFinite(at)) throw new Error("INTEGRITY_FAILURE");
      entries.push({ file, at, kind: "volatility" in parsed ? "VOLATILITY" : "history" in parsed ? "HISTORY" : "LEVEL" });
    }
    return entries;
  }
  async latest(now: string): Promise<FxManifest | null> {
    await this.sweep(now);
    const entries = (await this.entries()).filter(e => e.kind === "LEVEL").sort((a, b) => b.at - a.at || a.file.localeCompare(b.file));
    for (const entry of entries) {
      if (Date.parse(now) - entry.at >= maxAge || entry.at > Date.parse(now)) continue;
      return this.get(ID_PREFIX + entry.file.slice(0, -5), now);
    }
    return null;
  }
  async latestHistory(now: string): Promise<FxHistoryManifest | null> {
    await this.sweep(now);
    const entries = (await this.entries()).filter(e => e.kind === "HISTORY").sort((a, b) => b.at - a.at || a.file.localeCompare(b.file));
    for (const entry of entries) {
      if (Date.parse(now) - entry.at >= maxAge || entry.at > Date.parse(now)) continue;
      return this.getHistory(HISTORY_ID_PREFIX + entry.file.slice(0, -5), now);
    }
    return null;
  }
  async latestVolatility(now: string): Promise<FxVolatilityManifest | null> {
    await this.sweep(now);
    const entries = (await this.entries()).filter(e => e.kind === "VOLATILITY").sort((a,b) => b.at-a.at || a.file.localeCompare(b.file));
    for (const entry of entries) {
      if (Date.parse(now) - entry.at >= maxAge || entry.at > Date.parse(now)) continue;
      return this.getVolatility(VOLATILITY_ID_PREFIX + entry.file.slice(0,-5), now);
    }
    return null;
  }
  private async claim() {
    const name = `.writer-${process.pid}-${randomUUID()}.lock`;
    const path = join(this.root, name);
    const own = await open(path, "wx", 0o600);
    // Publish a choosing record before selecting a ticket. Other writers fail
    // busy while a record is incomplete. Unique filenames make dead-process
    // cleanup safe: a new owner never reuses the removed orphan's path.
    const scan = async () => {
      const names = (await readdir(this.root)).filter(n => /^\.writer-\d+-[a-f0-9-]+\.lock$/.test(n) && n !== name);
      if (names.length > 64) throw new Error("RETENTION_UNAVAILABLE");
      const records: { name: string; ticket: number }[] = [];
      for (const other of names) {
        const pid = Number(other.split("-")[1]);
        try { process.kill(pid, 0); }
        catch (e) {
          if ((e as NodeJS.ErrnoException).code === "ESRCH") { await unlink(join(this.root, other)).catch(() => {}); continue; }
        }
        const handle = await open(join(this.root, other), constants.O_RDONLY | constants.O_NOFOLLOW).catch(e => {
          if ((e as NodeJS.ErrnoException).code === "ENOENT") return null;
          throw e;
        });
        if (!handle) continue;
        try {
          if ((await handle.stat()).size > 128) throw new Error();
          const record = JSON.parse(await handle.readFile("utf8"));
          if (!Number.isSafeInteger(record.ticket) || record.ticket < 1) throw new Error();
          records.push({ name: other, ticket: record.ticket });
        } finally { await handle.close(); }
      }
      return records;
    };
    try {
      const ticket = Math.max(0, ...(await scan()).map(r => r.ticket)) + 1;
      if (!Number.isSafeInteger(ticket)) throw new Error();
      await own.writeFile(JSON.stringify({ ticket })); await own.sync();
      if ((await scan()).some(r => r.ticket < ticket || r.ticket === ticket && r.name < name)) throw new Error();
      return async () => { await own.close(); await unlink(path); };
    } catch (e) { await own.close(); await unlink(path).catch(() => {}); throw e; }
  }
  private async cleanStaging() {
    // Only called while holding the exclusive writer claim. No live writer can
    // own these unpublished UUID staging files at that point.
    for (const name of await readdir(this.root)) {
      if (/^\.pending-[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(name)) await unlink(join(this.root, name));
    }
  }
  async sweep(now: string): Promise<void> {
    const job = this.pending.then(async () => {
      try { await mkdir(this.root, { recursive: true, mode: 0o700 }); } catch { throw new Error("RETENTION_UNAVAILABLE"); }
      if ((await lstat(this.root)).isSymbolicLink()) throw new Error("RETENTION_UNAVAILABLE");
      const release = await this.claim();
      try {
        await this.cleanStaging();
        for (const entry of await this.entries()) if (Date.parse(now) - entry.at >= maxAge) await unlink(join(this.root, entry.file));
      } finally { await release(); }
    });
    this.pending = job.catch(() => {});
    return job;
  }
  async save(manifest: FxManifest): Promise<void> {
    return this.publish(verifyManifest(manifest));
  }
  async saveHistory(manifest: FxHistoryManifest): Promise<void> {
    return this.publish(verifyHistoryManifest(manifest));
  }
  async saveVolatility(manifest: FxVolatilityManifest): Promise<void> {
    return this.publish(verifyVolatilityManifest(manifest));
  }
  private async publish(manifest: Artifact): Promise<void> {
    const content = canonical(manifest);
    if (Buffer.byteLength(content) > MAX_BYTES) throw new Error("RETENTION_UNAVAILABLE");
    const id = identity(manifest), at = Date.parse(header(manifest).createdAt);
    const job = this.pending.then(async () => {
      let release: (() => Promise<void>) | undefined;
      let temp: string | undefined;
      let published = false;
      try {
        await mkdir(this.root, { recursive: true, mode: 0o700 });
        if ((await lstat(this.root)).isSymbolicLink()) throw new Error();
        release = await this.claim();
        await this.cleanStaging();
        const entries = (await this.entries()).sort((a, b) => a.at - b.at || a.file.localeCompare(b.file));
        const keep = entries.filter(e => at - e.at < maxAge);
        const evicted = [...entries.filter(e => at - e.at >= maxAge), ...keep.slice(0, Math.max(0, keep.length - 499))];
        for (const entry of evicted) await unlink(join(this.root, entry.file));
        temp = join(this.root, `.pending-${randomUUID()}`);
        const file = await open(temp, "wx", 0o600);
        try { await file.writeFile(content, "utf8"); await file.sync(); } finally { await file.close(); }
        try { await link(temp, this.filename(id)); published = true; }
        catch (e) {
          if ((e as NodeJS.ErrnoException).code !== "EEXIST" || canonical(await this.readFile(this.filename(id))) !== content) throw e;
        }
        await unlink(temp); temp = undefined;
        const dir = await open(this.root, "r");
        try { await dir.sync(); } finally { await dir.close(); }
      } catch {
        if (published) await unlink(this.filename(id)).catch(() => {});
        throw new Error("RETENTION_UNAVAILABLE");
      }
      finally {
        if (temp) await unlink(temp).catch(() => {});
        if (release) await release();
      }
    });
    this.pending = job.catch(() => {});
    return job;
  }
}
