import { describe, it, expect } from "vitest";
import { mapWithConcurrency } from "@/lib/review/concurrency";

function deferred(): { promise: Promise<void>; resolve: () => void } {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

describe("mapWithConcurrency", () => {
  it("never runs more than the limit at once", async () => {
    let running = 0;
    let peak = 0;
    const items = Array.from({ length: 9 }, (_, i) => i);

    await mapWithConcurrency(items, 4, async (n) => {
      running += 1;
      peak = Math.max(peak, running);
      await new Promise((r) => setTimeout(r, 5));
      running -= 1;
      return n;
    });

    expect(peak).toBe(4);
  });

  it("returns results in input order regardless of completion order", async () => {
    const items = [30, 10, 20];
    const settled = await mapWithConcurrency(items, 3, async (ms) => {
      await new Promise((r) => setTimeout(r, ms));
      return ms;
    });

    expect(settled.map((s) => (s.status === "fulfilled" ? s.value : null))).toEqual([
      30, 10, 20,
    ]);
  });

  it("isolates a rejection so the other items still resolve", async () => {
    const settled = await mapWithConcurrency([1, 2, 3], 2, async (n) => {
      if (n === 2) throw new Error("boom");
      return n;
    });

    expect(settled.map((s) => s.status)).toEqual([
      "fulfilled",
      "rejected",
      "fulfilled",
    ]);
    expect(settled[1]?.status === "rejected" && settled[1].reason).toBeInstanceOf(
      Error,
    );
  });

  it("starts a queued item as soon as a slot frees up", async () => {
    const gate = deferred();
    const startOrder: number[] = [];

    const run = mapWithConcurrency([0, 1, 2], 2, async (n) => {
      startOrder.push(n);
      if (n === 0) await gate.promise;
      return n;
    });

    await new Promise((r) => setTimeout(r, 0));
    expect(startOrder).toEqual([0, 1, 2]);

    gate.resolve();
    await run;
  });

  it("handles an empty input without hanging", async () => {
    await expect(mapWithConcurrency([], 4, async (n) => n)).resolves.toEqual([]);
  });

  it("treats a limit below one as sequential rather than deadlocking", async () => {
    const settled = await mapWithConcurrency([1, 2], 0, async (n) => n);
    expect(settled.map((s) => (s.status === "fulfilled" ? s.value : null))).toEqual(
      [1, 2],
    );
  });
});
