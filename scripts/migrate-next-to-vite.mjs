// One-shot codemod: strips Next.js directives/imports and rewrites API route
// handlers to use Web-standard Request/Response. Idempotent — safe to re-run.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(ROOT, "src");

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(entry.name)) out.push(full);
  }
  return out;
}

const files = walk(SRC);
let changed = 0;

for (const file of files) {
  let src = fs.readFileSync(file, "utf8");
  const before = src;
  const isApiRoute = /[\\/]app[\\/]api[\\/].*route\.tsx?$/.test(file);

  // 1. Drop the "use client" directive (no-op under Vite).
  src = src.replace(/^\s*["']use client["'];?[ \t]*\r?\n/, "");

  // 2. Rewrite client-side Next imports to local shims.
  src = src.replace(/(["'])next\/link\1/g, '"@/components/Link"');
  src = src.replace(/(["'])next\/navigation\1/g, '"@/lib/navigation"');

  if (isApiRoute) {
    // 3. Remove the next/server import line entirely.
    src = src.replace(/^import\s*\{[^}]*\}\s*from\s*["']next\/server["'];?[ \t]*\r?\n/m, "");

    // 4. Inject the json() helper import if NextResponse.json was used.
    if (/NextResponse\.json/.test(src) && !/from ["']@\/lib\/server\/http["']/.test(src)) {
      src = `import { json } from "@/lib/server/http";\n` + src;
    }

    // 5. Swap the Next request/response primitives for Web standards.
    src = src.replace(/NextResponse\.json/g, "json");
    src = src.replace(/NextRequest/g, "Request");
    src = src.replace(/req\.nextUrl\.searchParams/g, "new URL(req.url).searchParams");
    src = src.replace(/req\.nextUrl\.origin/g, "new URL(req.url).origin");
    src = src.replace(/req\.nextUrl/g, "new URL(req.url)");

    // 6. Strip Next route-segment config exports.
    src = src.replace(/^export const (dynamic|runtime|revalidate|fetchCache|preferredRegion)\s*=\s*[^;]+;[ \t]*\r?\n/gm, "");
  }

  if (src !== before) {
    fs.writeFileSync(file, src);
    changed++;
    console.log("updated", path.relative(ROOT, file));
  }
}

console.log(`\nDone. ${changed} file(s) changed of ${files.length} scanned.`);
