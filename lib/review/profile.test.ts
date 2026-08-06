import { describe, it, expect } from "vitest";
import { resolveReviewProfile } from "@/lib/review/profile";
import type { RepoConfig } from "@/lib/db/types";

function config(overrides: Partial<RepoConfig> = {}): RepoConfig {
  return {
    provider: null,
    model: null,
    reviewProfile: "chill",
    autoVerdict: true,
    confidenceThreshold: 0.5,
    customGuidelines: "",
    ignorePatterns: [],
    contextFiles: [],
    maxChunks: 8,
    ...overrides,
  };
}

describe("resolveReviewProfile", () => {
  it("falls back to the repo profile when the author has no rule", () => {
    const c = config({
      authorProfiles: [{ login: "aziz-yoco", profile: "expert" }],
    });
    expect(resolveReviewProfile(c, "someone-else")).toBe("chill");
  });

  it("applies the author's rule over the repo profile", () => {
    const c = config({
      authorProfiles: [{ login: "aziz-yoco", profile: "expert" }],
    });
    expect(resolveReviewProfile(c, "aziz-yoco")).toBe("expert");
  });

  it("matches the login case-insensitively, as GitHub does", () => {
    const c = config({
      authorProfiles: [{ login: "Aziz-Yoco", profile: "expert" }],
    });
    expect(resolveReviewProfile(c, "aziz-yoco")).toBe("expert");
  });

  it("supports different profiles for different authors in one repo", () => {
    const c = config({
      reviewProfile: "chill",
      authorProfiles: [
        { login: "user-a", profile: "expert" },
        { login: "user-b", profile: "normal" },
      ],
    });
    expect(resolveReviewProfile(c, "user-a")).toBe("expert");
    expect(resolveReviewProfile(c, "user-b")).toBe("normal");
    expect(resolveReviewProfile(c, "user-c")).toBe("chill");
  });

  it("keeps working for repos saved before the field existed", () => {
    expect(resolveReviewProfile(config(), "aziz-yoco")).toBe("chill");
  });

  it("ignores surrounding whitespace on a stored login", () => {
    const c = config({
      authorProfiles: [{ login: "  aziz-yoco  ", profile: "expert" }],
    });
    expect(resolveReviewProfile(c, "aziz-yoco")).toBe("expert");
  });

  it("uses the repo profile when the author login is blank", () => {
    const c = config({
      authorProfiles: [{ login: "aziz-yoco", profile: "expert" }],
    });
    expect(resolveReviewProfile(c, "")).toBe("chill");
  });

  it("honours the first rule when a login is listed twice", () => {
    const c = config({
      authorProfiles: [
        { login: "aziz-yoco", profile: "expert" },
        { login: "aziz-yoco", profile: "chill" },
      ],
    });
    expect(resolveReviewProfile(c, "aziz-yoco")).toBe("expert");
  });
});
