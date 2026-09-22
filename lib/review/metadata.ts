export interface ReviewedPullRequestMetadata {
  prTitle?: string;
  prBody?: string | null;
}

export interface CurrentPullRequestMetadata {
  title: string;
  body: string | null;
}

/**
 * Legacy reviews did not persist the metadata they evaluated. Treat that as
 * changed so the next re-review establishes a trustworthy baseline.
 */
export function hasPullRequestMetadataChanged(
  previous: ReviewedPullRequestMetadata,
  current: CurrentPullRequestMetadata,
): boolean {
  if (previous.prTitle === undefined || previous.prBody === undefined) {
    return true;
  }

  return previous.prTitle !== current.title || previous.prBody !== current.body;
}
