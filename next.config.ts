import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // No `output: "standalone"`: the VPS runs `next start` from a full release
  // (source + node_modules + .next). See docs/deploy.md.
  //
  // pnpm-workspace.yaml makes Next.js infer a monorepo root; pinning the
  // tracing root keeps it at this directory.
  outputFileTracingRoot: path.join(__dirname),

  // Invite URLs carry a bearer token; never leak it to GitHub via Referer.
  async headers() {
    return ["/invite/:path*", "/api/invite/:path*"].map((source) => ({
      source,
      headers: [
        { key: "Referrer-Policy", value: "no-referrer" },
        { key: "X-Robots-Tag", value: "noindex, nofollow" },
      ],
    }));
  },
};

export default nextConfig;
