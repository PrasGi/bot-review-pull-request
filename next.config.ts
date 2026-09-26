import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // No `output: "standalone"`: the VPS runs `next start` from a full release
  // (source + node_modules + .next). See docs/deploy.md.
  //
  // pnpm-workspace.yaml makes Next.js infer a monorepo root; pinning the
  // tracing root keeps it at this directory.
  outputFileTracingRoot: path.join(__dirname),
};

export default nextConfig;
