export interface ReadCoverage {
  reviewedCount: number;
  /** Files the model never read: over the token budget, or in a chunk that failed. */
  unreadFiles: string[];
}

/**
 * Which files a review actually read. A chunk that failed, timed out or was
 * skipped for the deadline counts as unread, so the review never claims to have
 * read files whose chunk did not come back.
 */
export function computeReadCoverage(params: {
  totalFiles: number;
  overBudget: string[];
  chunkFiles: string[][];
  settled: PromiseSettledResult<unknown>[];
}): ReadCoverage {
  const failedChunkFiles = params.chunkFiles.flatMap((files, index) => {
    const result = params.settled[index];
    const succeeded = result?.status === "fulfilled" && result.value !== null;
    return succeeded ? [] : files;
  });
  const unreadFiles = [...new Set([...params.overBudget, ...failedChunkFiles])];
  return {
    reviewedCount: Math.max(0, params.totalFiles - unreadFiles.length),
    unreadFiles,
  };
}
