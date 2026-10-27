import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchCompare } from "./compare";

const file = { filename: "a.ts", status: "modified", additions: 3, deletions: 1, patch: "@@" };

function respondWith(body: unknown, status = 200): void {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify(body), { status })),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchCompare", () => {
  it("returns the files when every commit in the range is a plain commit", async () => {
    respondWith({
      status: "ahead",
      total_commits: 1,
      commits: [{ parents: [{ sha: "a" }] }],
      files: [file],
    });

    await expect(fetchCompare("tok", "octo", "repo", "base", "head")).resolves.toEqual({
      ok: true,
      files: [file],
      status: "ahead",
    });
  });

  it("refuses a range that merges another branch in", async () => {
    respondWith({
      status: "ahead",
      total_commits: 2,
      commits: [{ parents: [{ sha: "a" }, { sha: "main" }] }, { parents: [{ sha: "b" }] }],
      files: [file],
    });

    await expect(fetchCompare("tok", "octo", "repo", "base", "head")).resolves.toEqual({
      ok: false,
      reason: "merged_base",
    });
  });

  it("refuses a range whose commit list GitHub truncated", async () => {
    respondWith({
      status: "ahead",
      total_commits: 300,
      commits: [{ parents: [{ sha: "a" }] }],
      files: [file],
    });

    await expect(fetchCompare("tok", "octo", "repo", "base", "head")).resolves.toEqual({
      ok: false,
      reason: "merged_base",
    });
  });

  it("reports a diverged range, such as after a force-push", async () => {
    respondWith({ status: "diverged", total_commits: 0, commits: [] });

    await expect(fetchCompare("tok", "octo", "repo", "base", "head")).resolves.toEqual({
      ok: false,
      reason: "diverged",
    });
  });
});
