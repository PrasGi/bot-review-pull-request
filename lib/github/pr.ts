import type { PrFile } from "@/lib/review/diff-format";
import type { Verdict } from "@/lib/db/types";
import { ghRequest } from "@/lib/github/http";

export interface PullRequestData {
  number: number;
  title: string;
  body: string | null;
  draft: boolean;
  state: "open" | "closed";
  merged: boolean;
  headSha: string;
  baseSha: string;
  authorLogin: string;
  htmlUrl: string;
  commitMessages: string[];
}

interface PrApiResponse {
  number: number;
  title: string;
  body: string | null;
  draft: boolean;
  state: "open" | "closed";
  merged?: boolean;
  head: { sha: string };
  base: { sha: string };
  user: { login: string };
  html_url: string;
}

interface CommitApiResponse {
  commit: { message: string };
}

export async function fetchPullRequest(
  token: string,
  owner: string,
  repo: string,
  prNumber: number,
): Promise<PullRequestData> {
  const prResult = await ghRequest<PrApiResponse>(
    `/repos/${owner}/${repo}/pulls/${prNumber}`,
    token,
  );
  if (!prResult.ok) {
    throw new Error(`fetch PR failed: ${prResult.status}`);
  }
  const pr = prResult.data;

  const commitsResult = await ghRequest<CommitApiResponse[]>(
    `/repos/${owner}/${repo}/pulls/${prNumber}/commits?per_page=20`,
    token,
  );
  const commitMessages = commitsResult.ok
    ? commitsResult.data.map((c) => c.commit.message.split("\n")[0] ?? "")
    : [];

  return {
    number: pr.number,
    title: pr.title,
    body: pr.body,
    draft: pr.draft,
    state: pr.state,
    merged: pr.merged ?? false,
    headSha: pr.head.sha,
    baseSha: pr.base.sha,
    authorLogin: pr.user.login,
    htmlUrl: pr.html_url,
    commitMessages,
  };
}

export async function fetchPullRequestFiles(
  token: string,
  owner: string,
  repo: string,
  prNumber: number,
): Promise<PrFile[]> {
  const files: PrFile[] = [];
  const MAX_PAGES = 3;
  let page = 1;
  for (;;) {
    const result = await ghRequest<PrFile[]>(
      `/repos/${owner}/${repo}/pulls/${prNumber}/files?per_page=100&page=${page}`,
      token,
    );
    if (!result.ok) throw new Error(`fetch PR files failed: ${result.status}`);
    files.push(...result.data);
    if (result.data.length < 100 || page >= MAX_PAGES) break;
    page += 1;
  }
  return files;
}

export interface InlineComment {
  path: string;
  line: number;
  start_line?: number;
  body: string;
}

export interface SubmitReviewInput {
  owner: string;
  repo: string;
  prNumber: number;
  commitId: string;
  event: Verdict;
  body: string;
  comments: InlineComment[];
}

export interface SubmitReviewResult {
  githubReviewId: number;
  inlinePosted: boolean;
}

export async function submitReview(
  token: string,
  input: SubmitReviewInput,
): Promise<SubmitReviewResult> {
  const path = `/repos/${input.owner}/${input.repo}/pulls/${input.prNumber}/reviews`;
  const payload = {
    commit_id: input.commitId,
    event: input.event,
    body: input.body,
    comments: input.comments,
  };

  const withInline = await ghRequest<{ id: number }>(path, token, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  if (withInline.ok) {
    return { githubReviewId: withInline.data.id, inlinePosted: true };
  }

  if (withInline.status !== 422) {
    throw new Error(`submit review failed: ${withInline.status}`);
  }

  const summaryOnly = await ghRequest<{ id: number }>(path, token, {
    method: "POST",
    body: JSON.stringify({
      commit_id: input.commitId,
      event: input.event,
      body: input.body,
    }),
  });
  if (!summaryOnly.ok) {
    throw new Error(`submit review (summary fallback) failed: ${summaryOnly.status}`);
  }
  return { githubReviewId: summaryOnly.data.id, inlinePosted: false };
}
