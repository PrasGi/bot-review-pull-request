/** The PR comment posted while a review runs. It is deleted when the run ends. */
export function buildStatusComment(liveUrl: string): string {
  return [
    "**Reviewing this pull request.**",
    "",
    `Follow the progress here: ${liveUrl}`,
    "",
    "The link keeps working for 24 hours after the review finishes. This comment is removed when the review is posted.",
  ].join("\n");
}
