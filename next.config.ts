import path from "path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Emits .next/standalone with a self-contained server.js plus the traced
  // subset of node_modules — what scripts/build-dist.ps1 ships to end users.
  output: "standalone",
  // There is a stray lockfile in the parent folder; without pinning the root,
  // Next traces from it and the standalone output lands one level deeper
  // (.next/standalone/fb-publisher/server.js), breaking the launcher paths.
  turbopack: { root: __dirname },
  outputFileTracingRoot: __dirname,
};

export default nextConfig;
