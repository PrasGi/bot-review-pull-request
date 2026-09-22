import { describe, expect, it } from "vitest";
import { hasPullRequestMetadataChanged } from "@/lib/review/metadata";

describe("hasPullRequestMetadataChanged", () => {
  it("returns false when title and body match the reviewed snapshot", () => {
    expect(
      hasPullRequestMetadataChanged(
        { prTitle: "feat: add export", prBody: "Adds CSV export." },
        { title: "feat: add export", body: "Adds CSV export." },
      ),
    ).toBe(false);
  });

  it("detects a title change", () => {
    expect(
      hasPullRequestMetadataChanged(
        { prTitle: "refactor: move helper", prBody: "Pure refactor." },
        { title: "fix: preserve duplicate lines", body: "Pure refactor." },
      ),
    ).toBe(true);
  });

  it("detects a description change", () => {
    expect(
      hasPullRequestMetadataChanged(
        { prTitle: "refactor: move helper", prBody: "Pure refactor." },
        {
          title: "refactor: move helper",
          body: "Also changes duplicate-line handling.",
        },
      ),
    ).toBe(true);
  });

  it("supports an absent PR description as a reviewed value", () => {
    expect(
      hasPullRequestMetadataChanged(
        { prTitle: "chore: cleanup", prBody: null },
        { title: "chore: cleanup", body: null },
      ),
    ).toBe(false);
  });

  it("forces one full re-review for legacy snapshots", () => {
    expect(
      hasPullRequestMetadataChanged(
        { prTitle: "fix: legacy review" },
        { title: "fix: legacy review", body: null },
      ),
    ).toBe(true);
  });
});
