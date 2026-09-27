import type { ReviewStage } from "@/lib/db/types";

// Every string of the live review section. Tests assert against these.

export const STAGE_LABEL: Record<ReviewStage, string> = {
  preparing: "Preparing the review",
  fetching_pr: "Fetching the pull request",
  fetching_files: "Fetching changed files",
  filtering: "Filtering ignored files",
  building_prompts: "Building prompts",
  reviewing: "Reviewing chunks",
  evaluating_replies: "Evaluating replies to the last review",
  finalizing: "Merging findings and deciding the verdict",
  posting: "Posting the review to GitHub",
  saving: "Saving the review",
};

/** Short names for the stepper. */
export const STEP_LABEL: Record<ReviewStage, string> = {
  preparing: "Prepare",
  fetching_pr: "Pull request",
  fetching_files: "Changed files",
  filtering: "Filter",
  building_prompts: "Prompts",
  reviewing: "Review",
  evaluating_replies: "Replies",
  finalizing: "Verdict",
  posting: "Post",
  saving: "Save",
};

const VERDICT_GLYPH: Record<string, string> = { APPROVE: "✓", REQUEST_CHANGES: "✕", COMMENT: "!" };

export const LIVE_COPY = {
  heading: "Live review",
  queued: "Waiting to start",
  moreRunning: (n: number) => `+${n} more running`,
  switchButton: (n: number) => `Switch · +${n} more running`,
  switchTo: "Follow another review",
  kind: { initial: "Initial review", re_review: "Re-review" },
  forDuration: (d: string) => `for ${d}`,
  chunkBar: (settled: number, total: number, percent: number) =>
    `${settled} of ${total} ${total === 1 ? "chunk" : "chunks"} · ${percent}%`,
  oldestChunk: (n: number, elapsed: string) => `Oldest running chunk: #${n}, ${elapsed}`,
  slowChunk: (n: number, elapsed: string) =>
    `Chunk ${n} has been running ${elapsed}, slower than usual. It times out at 10m.`,
  chunks: (c: { done: number; running: number; waiting: number; failed: number; total: number }) =>
    [
      `${c.done} done`,
      `${c.running} reviewing`,
      `${c.waiting} waiting`,
      ...(c.failed > 0 ? [`${c.failed} failed`] : []),
    ].join(" · ") + ` of ${c.total} ${c.total === 1 ? "chunk" : "chunks"}`,
  lastChunk: (ago: string) => `Last chunk finished ${ago} ago`,
  repairs: (n: number) => `${n} ${n === 1 ? "repair" : "repairs"} of malformed output`,
  unreviewed: (n: number) => `${n} ${n === 1 ? "file" : "files"} over the token budget, not reviewed`,
  files: (f: { changed: number; kept: number; skipped: number }) =>
    `${f.changed} changed · ${f.kept} reviewed · ${f.skipped} ignored`,
  stalled: (ago: string) =>
    `No heartbeat for ${ago}. The run may be stuck; the reaper fails it after 5m.`,
  result: {
    // The glyph follows the verdict, so a request for changes never reads as a tick.
    completed: (verdict: string, findings: number, duration: string) =>
      `${VERDICT_GLYPH[verdict] ?? "i"} ${verdict} · ${findings} ${findings === 1 ? "finding" : "findings"} · ${duration}`,
    completedNoReview: (duration: string) => `✓ Done · ${duration}`,
    failed: (reason: string) => `✕ Failed: ${reason}`,
    cancelled: (reason: string) => `Cancelled: ${reason}`,
  },
  openRequest: "Open request →",
  loadFailed: "Could not load the live review",
} as const;
