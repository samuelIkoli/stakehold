import path from "node:path";
import { loadEnvConfig } from "@next/env";
import type { NextConfig } from "next";

// Secrets live in the repo-root .env.local (one place for the whole monorepo).
loadEnvConfig(path.resolve(process.cwd(), ".."));

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
