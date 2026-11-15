#!/usr/bin/env node
/** Create one local, loopback-only PostgreSQL control database. Never touches the warehouse. */
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync, renameSync, unlinkSync, lstatSync } from "node:fs";
import { createServer } from "node:net";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const envFile = resolve(root, ".env.local");
const containerName = "market-terminal-benchmark-control";
const volumeName = "market-terminal-benchmark-control-data";
const dbName = "benchmark_control";
const owner = "benchmark_owner";
const appRole = "benchmark_app";
const option = "BENCHMARK_PROVIDER_LIMIT_DB_URL";
const require = createRequire(import.meta.url);
const { Client } = require("pg");
const secret = () => randomBytes(24).toString("hex");
const sleep = (ms) => new Promise((done) => setTimeout(done, ms));
function docker(args, options = {}) {
  const result = spawnSync("docker", args, { encoding: "utf8", timeout: 45000, ...options });
  if (result.error || result.status !== 0) throw new Error("Docker command failed. Check that Docker is running and the local postgres:16 image is available.");
  return result.stdout ?? "";
}
function settingIsPresent(path) {
  return existsSync(path) && readFileSync(path, "utf8").split(/\r?\n/).some((line) => new RegExp(`^\\s*(?:export\\s+)?${option}\\s*=`).test(line));
}
async function openPort() {
  const server = createServer();
  await new Promise((done, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", done); });
  const port = server.address().port;
  await new Promise((done, reject) => server.close((error) => error ? reject(error) : done()));
  return port;
}
let createdVolume = false, createdContainer = false, configured = false;
try {
  if (existsSync(envFile) && !lstatSync(envFile).isFile()) throw new Error("The local environment path is not a regular file; it was not changed.");
  if (process.env[option] || settingIsPresent(resolve(root, ".env")) || settingIsPresent(envFile)) throw new Error(`${option} is already present; existing configuration was not changed.`);
  const names = docker(["ps", "-a", "--format", "{{.Names}}"], { stdio: ["ignore", "pipe", "ignore"] }).trim().split("\n");
  const volumes = docker(["volume", "ls", "--format", "{{.Name}}"], { stdio: ["ignore", "pipe", "ignore"] }).trim().split("\n");
  if (names.includes(containerName) || volumes.includes(volumeName)) throw new Error("A benchmark control container or volume already exists; existing resources were not changed.");
  docker(["image", "inspect", "postgres:16"], { stdio: "ignore" });
  const port = await openPort();
  const ownerPassword = secret(), appPassword = secret();
  docker(["volume", "create", volumeName], { stdio: "ignore" }); createdVolume = true;
  docker(["run", "-d", "--pull", "never", "--name", containerName, "--restart", "unless-stopped", "-p", `127.0.0.1:${port}:5432`, "-v", `${volumeName}:/var/lib/postgresql/data`, "-e", `POSTGRES_USER=${owner}`, "-e", "POSTGRES_PASSWORD", "-e", `POSTGRES_DB=${dbName}`, "postgres:16"], { env: { ...process.env, POSTGRES_PASSWORD: ownerPassword }, stdio: "ignore" }); createdContainer = true;
  let ready = false;
  for (let i = 0; i < 60; i++) {
    try {
      const logs = docker(["logs", containerName], { stdio: ["ignore", "pipe", "pipe"] });
      if (!logs.includes("PostgreSQL init process complete")) throw new Error("initializing");
      docker(["exec", containerName, "pg_isready", "-U", owner, "-d", dbName], { stdio: "ignore", timeout: 3000 }); ready = true; break;
    } catch { await sleep(500); }
  }
  if (!ready) throw new Error("The dedicated PostgreSQL container did not become ready.");
  const migration = readFileSync(resolve(root, "docs/specs/spec033/PROVIDER_LIMITER_POSTGRES.sql"), "utf8");
  const grants = `\nCREATE ROLE ${appRole} LOGIN PASSWORD '${appPassword}' NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT;\nREVOKE ALL ON DATABASE ${dbName} FROM PUBLIC;\nGRANT CONNECT ON DATABASE ${dbName} TO ${appRole};\nREVOKE ALL ON SCHEMA public FROM PUBLIC;\nGRANT USAGE ON SCHEMA benchmark_provider_control TO ${appRole};\nGRANT SELECT, INSERT, UPDATE ON benchmark_provider_control.request_gate TO ${appRole};\n`;
  docker(["exec", "-i", containerName, "psql", "-v", "ON_ERROR_STOP=1", "-U", owner, "-d", dbName], { input: migration + grants, stdio: ["pipe", "ignore", "ignore"] });
  const url = new URL("postgresql://localhost"); url.username = appRole; url.password = appPassword; url.hostname = "127.0.0.1"; url.port = String(port); url.pathname = `/${dbName}`;
  const client = new Client({ connectionString: url.href, connectionTimeoutMillis: 5000 });
  try {
    await client.connect();
    const result = await client.query(`SELECT current_database() AS db, current_user AS role,
      has_schema_privilege(current_user, 'benchmark_provider_control', 'USAGE') AS usage,
      has_schema_privilege(current_user, 'benchmark_provider_control', 'CREATE') AS schema_create,
      has_table_privilege(current_user, 'benchmark_provider_control.request_gate', 'SELECT') AS gate_select,
      has_table_privilege(current_user, 'benchmark_provider_control.request_gate', 'INSERT') AS gate_insert,
      has_table_privilege(current_user, 'benchmark_provider_control.request_gate', 'UPDATE') AS gate_update,
      has_table_privilege(current_user, 'benchmark_provider_control.request_gate', 'DELETE') AS gate_delete,
      rolsuper AS superuser FROM pg_roles WHERE rolname=current_user`);
    const row = result.rows[0];
    if (!row || row.db !== dbName || row.role !== appRole || !row.usage || !row.gate_select || !row.gate_insert || !row.gate_update || row.schema_create || row.gate_delete || row.superuser) throw new Error("Control database permissions did not match the expected restricted role.");
  } finally { await client.end().catch(() => {}); }
  if (existsSync(envFile) && !lstatSync(envFile).isFile()) throw new Error("The local environment path is not a regular file; it was not changed.");
  const existing = existsSync(envFile) ? readFileSync(envFile, "utf8") : "";
  const prefix = existing && !existing.endsWith("\n") ? "\n" : "";
  const tempFile = resolve(root, `.env.benchmark-control-${randomBytes(8).toString("hex")}.local`);
  try {
    writeFileSync(tempFile, `${existing}${prefix}\n# Local BMRK/BRA provider-check control database\n${option}=${url.href}\n`, { flag: "wx", mode: 0o600 });
    if ((existsSync(envFile) ? readFileSync(envFile, "utf8") : "") !== existing) throw new Error("The local environment changed during setup; it was not overwritten.");
    renameSync(tempFile, envFile);
  } finally { if (existsSync(tempFile)) unlinkSync(tempFile); }
  configured = true;
  console.log(`Local control database ready: container ${containerName}; loopback port ${port}; persistent volume ${volumeName}.`);
  console.log("Restricted application credentials were saved to ignored .env.local. Restart the application to load them.");
} catch (error) {
  console.error(`Benchmark control setup failed: ${error instanceof Error ? error.message : "unknown error"}`);
  process.exitCode = 1;
} finally {
  if (!configured) {
    if (createdContainer) { try { docker(["rm", "-f", containerName], { stdio: "ignore", timeout: 15000 }); } catch {} }
    if (createdVolume) { try { docker(["volume", "rm", volumeName], { stdio: "ignore", timeout: 15000 }); } catch {} }
  }
}
