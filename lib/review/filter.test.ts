import { describe, it, expect } from "vitest";
import { filterFiles } from "@/lib/review/filter";
import type { PrFile } from "@/lib/review/diff-format";

function file(filename: string, extra: Partial<PrFile> = {}): PrFile {
  return {
    filename,
    status: "modified",
    additions: 1,
    deletions: 0,
    patch: "@@ -1 +1 @@\n+x",
    ...extra,
  };
}

describe("filterFiles", () => {
  it("keeps normal source files", () => {
    const { kept } = filterFiles([file("src/index.ts")], []);
    expect(kept).toHaveLength(1);
  });

  it("skips lockfiles", () => {
    const { kept, skipped } = filterFiles([file("pnpm-lock.yaml")], []);
    expect(kept).toHaveLength(0);
    expect(skipped[0]?.reason).toBe("lockfile");
  });

  it("skips generated directories", () => {
    const { skipped } = filterFiles([file("dist/bundle.js")], []);
    expect(skipped[0]?.reason).toBe("generated");
  });

  it("skips binary files by extension", () => {
    const { skipped } = filterFiles([file("logo.png")], []);
    expect(skipped[0]?.reason).toBe("binary");
  });

  it("skips files without a patch", () => {
    const { skipped } = filterFiles(
      [file("src/big.ts", { patch: undefined })],
      [],
    );
    expect(skipped[0]?.reason).toBe("no_diff");
  });

  it("skips removed files", () => {
    const { skipped } = filterFiles(
      [file("src/gone.ts", { status: "removed" })],
      [],
    );
    expect(skipped[0]?.reason).toBe("removed");
  });

  it("honors repo ignore glob patterns", () => {
    const { kept, skipped } = filterFiles(
      [file("src/generated/api.ts")],
      ["**/generated/**"],
    );
    expect(kept).toHaveLength(0);
    expect(skipped[0]?.reason).toBe("ignored_pattern");
  });
});
