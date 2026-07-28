import { describe, it, expect } from "vitest";
import {
  loginSchema,
  repoConfigSchema,
  requestsQuerySchema,
  usageQuerySchema,
  settingsUpdateSchema,
} from "@/lib/schemas";

describe("loginSchema", () => {
  it("accepts a valid email + password", () => {
    expect(loginSchema.safeParse({ email: "a@b.com", password: "x" }).success).toBe(true);
  });
  it("rejects a bad email", () => {
    expect(loginSchema.safeParse({ email: "notanemail", password: "x" }).success).toBe(false);
  });
});

describe("repoConfigSchema", () => {
  it("rejects an out-of-range confidence threshold", () => {
    const base = {
      provider: null,
      model: null,
      reviewProfile: "normal",
      autoVerdict: true,
      confidenceThreshold: 1.5,
      customGuidelines: "",
      ignorePatterns: [],
      contextFiles: [],
      maxChunks: 3,
    };
    expect(repoConfigSchema.safeParse(base).success).toBe(false);
  });
  it("rejects an invalid review profile", () => {
    const r = repoConfigSchema.safeParse({ reviewProfile: "godmode" });
    expect(r.success).toBe(false);
  });
});

describe("requestsQuerySchema", () => {
  it("coerces string page/pageSize and applies defaults", () => {
    const r = requestsQuerySchema.parse({ page: "2", pageSize: "50" });
    expect(r.page).toBe(2);
    expect(r.pageSize).toBe(50);
  });
  it("defaults page to 1 and pageSize to 20", () => {
    const r = requestsQuerySchema.parse({});
    expect(r.page).toBe(1);
    expect(r.pageSize).toBe(20);
  });
  it("caps pageSize at 100", () => {
    expect(requestsQuerySchema.safeParse({ pageSize: "500" }).success).toBe(false);
  });
});

describe("usageQuerySchema", () => {
  it("defaults to 30 days grouped by day", () => {
    const r = usageQuerySchema.parse({});
    expect(r.days).toBe(30);
    expect(r.groupBy).toBe("day");
  });
});

describe("settingsUpdateSchema", () => {
  it("accepts a partial pricing update", () => {
    const r = settingsUpdateSchema.safeParse({
      modelPricing: [
        { provider: "glm", model: "glm-4.6", inputPerM: 0.6, outputPerM: 2.2 },
      ],
    });
    expect(r.success).toBe(true);
  });
  it("rejects a negative price", () => {
    const r = settingsUpdateSchema.safeParse({
      modelPricing: [
        { provider: "glm", model: "x", inputPerM: -1, outputPerM: 2 },
      ],
    });
    expect(r.success).toBe(false);
  });
});
