/**
 * Vite-built entry that exposes the API route registry to runtimes which bundle
 * *outside* Vite — specifically the Vercel serverless function in `api/`.
 *
 * `registry.ts` resolves `@/` aliases and `import.meta.glob`, neither of which
 * Vercel's function bundler understands. Building this entry with Vite
 * (`npm run build:handler` → `dist-vercel/handler.js`) produces a self-contained
 * module with all of that already resolved, so the Vercel function can import
 * `handleApiRequest` directly.
 */
export { handleApiRequest } from "./registry";
