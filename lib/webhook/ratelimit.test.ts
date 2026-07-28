import { describe, it, expect } from "vitest";
import { allowRequest, penalizeSignatureFailure } from "@/lib/webhook/ratelimit";

describe("rate limiter", () => {
  it("allows requests under the burst capacity", () => {
    const ip = "10.0.0.1";
    for (let i = 0; i < 60; i += 1) {
      expect(allowRequest(ip)).toBe(true);
    }
  });

  it("blocks once the bucket is drained", () => {
    const ip = "10.0.0.2";
    for (let i = 0; i < 60; i += 1) allowRequest(ip);
    expect(allowRequest(ip)).toBe(false);
  });

  it("signature failures drain the bucket 10x faster", () => {
    const ip = "10.0.0.3";
    for (let i = 0; i < 6; i += 1) penalizeSignatureFailure(ip);
    expect(allowRequest(ip)).toBe(false);
  });

  it("isolates buckets per IP", () => {
    const drained = "10.0.0.4";
    for (let i = 0; i < 60; i += 1) allowRequest(drained);
    expect(allowRequest(drained)).toBe(false);
    expect(allowRequest("10.0.0.5")).toBe(true);
  });
});
