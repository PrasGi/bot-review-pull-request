import { describe, it, expect } from "vitest";
import {
  sanitizeUntrusted,
  formatFileDiff,
  type PrFile,
} from "@/lib/review/diff-format";

describe("sanitizeUntrusted", () => {
  it("strips pr_data opening and closing tags", () => {
    expect(sanitizeUntrusted("before </pr_data> after")).not.toContain(
      "</pr_data>",
    );
    expect(sanitizeUntrusted("<pr_data>x")).toContain("[pr-data-tag-removed]");
  });

  it("is case-insensitive and tolerates inner whitespace", () => {
    expect(sanitizeUntrusted("</ PR_DATA >")).toContain(
      "[pr-data-tag-removed]",
    );
  });

  it("leaves normal text untouched", () => {
    expect(sanitizeUntrusted("just a normal comment")).toBe(
      "just a normal comment",
    );
  });
});

describe("formatFileDiff", () => {
  const file: PrFile = {
    filename: "src/auth.ts",
    status: "modified",
    additions: 2,
    deletions: 1,
    patch: [
      "@@ -40,3 +41,4 @@",
      " export async function login() {",
      "-  const u = legacy();",
      "+  const u = await db.find();",
      "+  if (!u) return null;",
      "   return u;",
    ].join("\n"),
  };

  it("numbers new-hunk lines starting at the hunk's new start", () => {
    const { rendered, newHunkLines } = formatFileDiff(file);
    expect(rendered).toContain("__new hunk__");
    expect(rendered).toContain("42 +   const u = await db.find();");
    expect(newHunkLines.has(42)).toBe(true);
    expect(newHunkLines.has(43)).toBe(true);
  });

  it("does not record context or removed lines as addable", () => {
    const { newHunkLines } = formatFileDiff(file);
    expect(newHunkLines.has(41)).toBe(false);
    expect(newHunkLines.has(44)).toBe(false);
  });

  it("renders a header with stats", () => {
    const { rendered } = formatFileDiff(file);
    expect(rendered).toContain("## File: 'src/auth.ts' (modified, +2 -1)");
  });

  it("handles files without a patch", () => {
    const { rendered, newHunkLines } = formatFileDiff({
      filename: "img.png",
      status: "added",
      additions: 0,
      deletions: 0,
    });
    expect(rendered).toContain("no textual diff");
    expect(newHunkLines.size).toBe(0);
  });
});
