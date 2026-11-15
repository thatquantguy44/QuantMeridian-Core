/** Load the configured source URL without printing it; the Python tool creates its own target. */
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { loadEnv } from "vite";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const roots = args.filter((arg) => arg === "--pipeline-root" || arg.startsWith("--pipeline-root="));
if (roots.length > 1) {
  console.error("Specify --pipeline-root only once.");
  process.exit(2);
}
const flag = args.indexOf("--pipeline-root");
const inline = args.find((arg) => arg.startsWith("--pipeline-root="));
const root = flag >= 0 ? args[flag + 1] : inline?.slice("--pipeline-root=".length);
if ((flag >= 0 || inline !== undefined) && (!root || root.startsWith("--"))) {
  console.error("--pipeline-root requires a checkout path.");
  process.exit(2);
}
const pipeline = path.resolve(repo, root ?? "../../pipelines/fred-bronze-to-gold-pipeline");
const python = process.env.ECOMEDALLION_PYTHON || path.join(pipeline, ".venv/bin/python");
const env = { ...loadEnv("development", repo, ""), ...process.env, PYTHONDONTWRITEBYTECODE: "1" };
const commandArgs = [path.join(repo, "scripts/benchmark_full_rehearsal.py"), ...args];
if (!root) commandArgs.push("--pipeline-root", pipeline);
const result = spawnSync(python, commandArgs, { cwd: repo, env, stdio: "inherit" });
if (result.error) console.error(`Unable to start EcoMedallion Python (${result.error.code ?? "unknown error"}).`);
process.exit(result.status ?? 1);
