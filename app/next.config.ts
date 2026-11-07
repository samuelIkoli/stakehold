import path from "node:path";
import { loadEnvConfig } from "@next/env";
import type { NextConfig } from "next";

// Secrets live in the repo-root .env.local (one place for the whole monorepo).
loadEnvConfig(path.resolve(process.cwd(), ".."));

const nextConfig: NextConfig = {
  allowedDevOrigins: ["*.ngrok-free.app", "*.trycloudflare.com", "192.168.*.*"],
  serverExternalPackages: ["@prisma/client"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
