import { describe, expect, it } from "vitest";
import { reconcileSearch } from "@/lib/ui/search-sync";

describe("reconcileSearch", () => {
  it("keeps what the user typed when the URL catches up with an earlier push", () => {
    // Pushed "ab", then deleted back to "a" before the URL updated.
    expect(reconcileSearch({ text: "a", pending: ["ab"] }, "ab")).toEqual({ text: "a", pending: [] });
  });

  it("handles pushes that land out of step", () => {
    const afterFirst = reconcileSearch({ text: "abc", pending: ["a", "ab"] }, "a");
    expect(afterFirst).toEqual({ text: "abc", pending: ["ab"] });
    expect(reconcileSearch(afterFirst, "ab")).toEqual({ text: "abc", pending: [] });
  });

  it("clears to empty when the user deletes everything", () => {
    expect(reconcileSearch({ text: "", pending: [""] }, "")).toEqual({ text: "", pending: [] });
  });

  it("takes an outside change such as clear filters or the back button", () => {
    expect(reconcileSearch({ text: "invites", pending: [] }, "")).toEqual({ text: "", pending: [] });
    expect(reconcileSearch({ text: "x", pending: ["xy"] }, "older")).toEqual({ text: "older", pending: [] });
  });
});
