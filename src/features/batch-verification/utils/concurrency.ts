/**
 * A concurrency-limited async queue.
 *
 * Runs `worker` on each item with at most `concurrency` in flight at once.
 * Used by the client to process dozens/hundreds of labels without firing that
 * many simultaneous API requests (PERF-004). Items complete out of order and
 * surface individually so the UI can stream results as they finish
 * (PERF-005, BATCH section).
 */

export interface ConcurrencyLimitedQueueOptions<TItem> {
  /** Maximum number of items processed simultaneously. */
  concurrency: number;
  /** Processes a single item. May throw; the error is captured per item. */
  worker: (item: TItem, index: number) => Promise<void>;
  /** Called as each item settles. */
  onItemSettled?: (result: { index: number; error?: unknown }) => void;
}

/**
 * Process all items with a bounded concurrency. Resolves when every item has
 * settled (success or failure). Does not throw on item failures; those are
 * surfaced via `onItemSettled` and the returned erroredIndices.
 *
 * Uses a classic fixed-worker-pool: exactly `concurrency` workers pull from a
 * shared index cursor, so the pool is deterministic and never leaks 'void'
 * chained promises.
 */
export async function runWithConcurrency<TItem>(
  items: TItem[],
  options: ConcurrencyLimitedQueueOptions<TItem>
): Promise<{ erroredIndices: number[] }> {
  const erroredIndices: number[] = [];
  const poolSize = Math.max(1, Math.min(options.concurrency, items.length));

  if (items.length === 0) {
    return { erroredIndices };
  }

  let nextIndex = 0;

  async function workerLoops(): Promise<void> {
    while (true) {
      // Atomically claim the next index. Claims are made before awaiting, so
      // two workers never process the same item.
      const index = nextIndex;
      nextIndex++;
      if (index >= items.length) {
        return;
      }
      try {
        await options.worker(items[index], index);
      } catch (error) {
        erroredIndices.push(index);
        options.onItemSettled?.({ index, error });
        continue;
      }
      options.onItemSettled?.({ index });
    }
  }

  const workers: Promise<void>[] = [];
  for (let i = 0; i < poolSize; i++) {
    workers.push(workerLoops());
  }
  await Promise.all(workers);

  return { erroredIndices };
}