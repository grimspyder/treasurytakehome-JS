import { describe, expect, it } from "vitest";
import { runWithConcurrency } from "./concurrency";

describe("runWithConcurrency", () => {
  it("processes all items exactly once", async () => {
    const processed: number[] = [];
    await runWithConcurrency([1, 2, 3, 4, 5], {
      concurrency: 2,
      worker: async (item) => {
        processed.push(item);
      },
    });
    expect(processed.sort()).toEqual([1, 2, 3, 4, 5]);
  });

  it("never exceeds the concurrency limit", async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    await runWithConcurrency([1, 2, 3, 4, 5, 6, 7, 8], {
      concurrency: 3,
      worker: async () => {
        inFlight++;
        maxInFlight = Math.max(maxInFlight, inFlight);
        await new Promise((r) => setTimeout(r, 5));
        inFlight--;
      },
    });
    expect(maxInFlight).toBeLessThanOrEqual(3);
  });

  it("collects errored indices without aborting the batch", async () => {
    const { erroredIndices } = await runWithConcurrency([1, 2, 3, 4], {
      concurrency: 2,
      worker: async (item) => {
        if (item === 2 || item === 4) throw new Error("boom");
      },
    });
    expect(erroredIndices.sort()).toEqual([1, 3]);
  });

  it("handles an empty list", async () => {
    const { erroredIndices } = await runWithConcurrency([], {
      concurrency: 3,
      worker: async () => {},
    });
    expect(erroredIndices).toEqual([]);
  });

  it("calls onItemSettled for every item", async () => {
    const settled: number[] = [];
    await runWithConcurrency([10, 20, 30], {
      concurrency: 2,
      worker: async () => {},
      onItemSettled: ({ index }) => settled.push(index),
    });
    expect(settled.sort()).toEqual([0, 1, 2]);
  });
});
