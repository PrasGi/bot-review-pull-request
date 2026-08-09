import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // pnpm-workspace.yaml makes Next.js infer a monorepo root and relocate the
  // standalone output. Pinning the tracing root here keeps server.js at
  // .next/standalone/server.js, which the Dockerfile CMD depends on.
  outputFileTracingRoot: path.join(__dirname),
};

export default nextConfig;
