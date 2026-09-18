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
  // The db and Playwright session dirs are resolved at runtime from
  // process.cwd(), which the tracer reads as a static dependency and copies
  // wholesale into the standalone output. Shipping them would leak the
  // developer's logged-in Facebook session and their real database.
  outputFileTracingExcludes: {
    "/*": ["data/**", "dist/**", "docs/**", "notas/**", ".next/cache/**"],
  },
};

export default nextConfig;
