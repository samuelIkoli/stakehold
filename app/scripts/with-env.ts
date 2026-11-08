// Load the same env files Next.js uses (repo-root .env.local + app/.env), then run a script.
//   tsx scripts/with-env.ts scripts/<name>.ts [args]
import path from "node:path";
import { pathToFileURL } from "node:url";
import { loadEnvConfig } from "@next/env";

// loadEnvConfig caches its first result, so it can only be called once; the root file goes in directly.
loadEnvConfig(process.cwd());
try {
  process.loadEnvFile(path.resolve(process.cwd(), "..", ".env.local"));
} catch {}

const target = process.argv[2];
if (!target) {
  console.error("usage: with-env.ts <script>");
  process.exit(1);
}
process.argv.splice(2, 1);
void import(pathToFileURL(path.resolve(target)).href);
