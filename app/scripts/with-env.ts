// Load the same env files Next.js uses (repo-root .env.local + app/.env), then run a script.
//   tsx scripts/with-env.ts scripts/<name>.ts [args]
import path from "node:path";
import { pathToFileURL } from "node:url";
import { loadEnvConfig } from "@next/env";

loadEnvConfig(path.resolve(process.cwd(), ".."));
loadEnvConfig(process.cwd());

const target = process.argv[2];
if (!target) {
  console.error("usage: with-env.ts <script>");
  process.exit(1);
}
process.argv.splice(2, 1);
await import(pathToFileURL(path.resolve(target)).href);
