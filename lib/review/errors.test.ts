import { describe, it, expect } from "vitest";
import { PrClosedError } from "@/lib/review/errors";

describe("PrClosedError", () => {
  it("carries a pr_merged reason", () => {
    const err = new PrClosedError("pr_merged");
    expect(err).toBeInstanceOf(Error);
    expect(err.reason).toBe("pr_merged");
    expect(err.name).toBe("PrClosedError");
  });

  it("carries a pr_closed reason", () => {
    const err = new PrClosedError("pr_closed");
    expect(err.reason).toBe("pr_closed");
  });

  it("is distinguishable from a generic Error", () => {
    const generic = new Error("boom");
    expect(generic instanceof PrClosedError).toBe(false);
    expect(new PrClosedError("pr_merged") instanceof PrClosedError).toBe(true);
  });
});
