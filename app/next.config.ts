import path from "node:path";
import type { NextConfig } from "next";

// Secrets live in the repo-root .env.local (one place for the whole monorepo).
// Next has already loaded app/ env files by now and caches that result, so a
// second loadEnvConfig() call is a no-op; load the root file directly instead.
// Values already in the environment win.
try {
  process.loadEnvFile(path.resolve(process.cwd(), "..", ".env.local"));
} catch {}

const nextConfig: NextConfig = {
  allowedDevOrigins: ["*.ngrok-free.app", "*.trycloudflare.com", "192.168.*.*"],
  serverExternalPackages: ["@prisma/client"],
  turbopack: {
    // @anchor-lang/core's browser bundle references fs for NodeWallet; never used client-side.
    resolveAlias: { fs: { browser: "./src/lib/empty.ts" } },
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
