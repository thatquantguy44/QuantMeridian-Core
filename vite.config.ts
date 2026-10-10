import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { devApiPlugin } from "./vite-plugins/dev-api";

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ mode }) => {
  // Vite parses `.env*` files but only exposes `VITE_`-prefixed vars (and only
  // to the client). The dev API route handlers run in Node and read server
  // secrets off `process.env` (FRED_API_KEY, MARKET_*_URL, NEWS_NLP_URL, …), so
  // a key placed in `.env` would otherwise be invisible to them and every route
  // would fall back to SIM. Load `.env*` and copy any var not already set in the
  // real environment onto `process.env` so `npm run dev` picks up `.env` keys.
  const env = loadEnv(mode, root, "");
  for (const [key, value] of Object.entries(env)) {
    if (process.env[key] === undefined) process.env[key] = value;
  }

  return {
    plugins: [react(), devApiPlugin()],
    resolve: {
      alias: {
        "@": path.resolve(root, "src"),
      },
    },
    server: {
      port: 3000,
      host: true,
    },
    preview: {
      port: 3000,
    },
    build: {
      outDir: "dist",
      sourcemap: true,
    },
  };
});
