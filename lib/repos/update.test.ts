import { describe, expect, it } from "vitest";
import { buildRepoSet, countChanges } from "@/lib/repos/update";
import { parseAuthorRules } from "@/lib/repos/author-rules";
import { BULK_CONFIRM_COPY, describeChanges } from "@/lib/repos/copy";

const now = new Date("2026-09-27T00:00:00Z");

describe("buildRepoSet", () => {
  it("writes only the fields present, as dotted config paths", () => {
    expect(
      buildRepoSet({ enabled: false, config: { reviewProfile: "expert", provider: null, model: null } }, now),
    ).toEqual({
      updatedAt: now,
      enabled: false,
      "config.reviewProfile": "expert",
      "config.provider": null,
      "config.model": null,
    });
  });

  it("skips undefined values and counts real changes", () => {
    expect(buildRepoSet({ config: { maxChunks: undefined } }, now)).toEqual({ updatedAt: now });
    expect(countChanges({ enabled: true, config: { ignorePatterns: [] } })).toBe(2);
  });
});

describe("parseAuthorRules", () => {
  it("parses username = profile lines, last rule per login wins", () => {
    expect(parseAuthorRules("aziz-yoco = chill\n@Senior = EXPERT\n\naziz-yoco=normal")).toEqual({
      ok: true,
      rules: [
        { login: "aziz-yoco", profile: "normal" },
        { login: "Senior", profile: "expert" },
      ],
    });
    expect(parseAuthorRules("")).toEqual({ ok: true, rules: [] });
  });

  it("rejects malformed lines and unknown profiles", () => {
    expect(parseAuthorRules("aziz-yoco chill")).toMatchObject({ ok: false, error: expect.stringContaining("Line 1") });
    expect(parseAuthorRules("a = chill\nb = harsh")).toMatchObject({ ok: false, error: expect.stringContaining("Line 2") });
  });
});

describe("describeChanges", () => {
  it("summarises every changed field for the confirmation", () => {
    const lines = describeChanges({
      enabled: false,
      config: {
        reviewProfile: "professional",
        provider: "anthropic",
        model: "claude-sonnet-5",
        autoVerdict: true,
        maxChunks: 20,
        customGuidelines: "",
        ignorePatterns: ["*.md"],
        authorProfiles: [
          { login: "a", profile: "chill" },
          { login: "b", profile: "expert" },
        ],
      },
    });
    expect(lines).toEqual([
      "Reviews off",
      "Character → Professional",
      "Provider and model → Anthropic · claude-sonnet-5",
      "Auto verdict on",
      "Max chunks → 20",
      "Custom guidelines cleared",
      "Ignore patterns → 1 pattern",
      "Per-author overrides → 2 rules",
    ]);
    expect(describeChanges({ config: { provider: null, model: null } })).toEqual(["Provider and model → default"]);
  });

  it("names the consequence and uses non-generic labels", () => {
    expect(BULK_CONFIRM_COPY.title(12)).toBe("Update 12 repositories?");
    expect(BULK_CONFIRM_COPY.title(1)).toBe("Update 1 repository?");
    expect(BULK_CONFIRM_COPY.confirm(12)).toBe("Update 12 repositories");
    expect(BULK_CONFIRM_COPY.cancel).toBe("Keep editing");
  });
});
