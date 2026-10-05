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

const GH_ERROR_DETAIL_MAX = 300;

interface GhErrorBody {
  message?: unknown;
  errors?: unknown;
}

/**
 * Pulls GitHub's own explanation out of an error response ("Validation Failed:
 * …"), so a rejected review says why instead of only "422". GitHub's error
 * bodies carry no secrets; the detail is still capped because it is stored and
 * shown on the dashboard.
 */
export function ghErrorDetail(body: string): string {
  let parsed: GhErrorBody;
  try {
    parsed = JSON.parse(body) as GhErrorBody;
  } catch {
    return "";
  }
  const parts: string[] = [];
  if (typeof parsed.message === "string") parts.push(parsed.message);
  if (Array.isArray(parsed.errors)) {
    for (const e of parsed.errors) {
      if (typeof e === "string") parts.push(e);
      else if (e && typeof e === "object" && "message" in e && typeof e.message === "string") {
        parts.push(e.message);
      }
    }
  }
  const detail = parts.join(": ").replace(/\s+/g, " ").trim();
  return detail.length > GH_ERROR_DETAIL_MAX
    ? `${detail.slice(0, GH_ERROR_DETAIL_MAX - 1)}…`
    : detail;
}

function ghFailure(label: string, status: number, body: string): string {
  const detail = ghErrorDetail(body);
  return detail ? `${label}: ${status} — ${detail}` : `${label}: ${status}`;
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
    throw new Error(ghFailure("submit review failed", withInline.status, withInline.body));
  }
  const inlineFailure = ghFailure("inline", withInline.status, withInline.body);

  const summaryOnly = await ghRequest<{ id: number }>(path, token, {
    method: "POST",
    body: JSON.stringify({
      commit_id: input.commitId,
      event: input.event,
      body: input.body,
    }),
  });
  if (!summaryOnly.ok) {
    // Both attempts are named: when the fallback fails for a different reason
    // than the inline attempt, the first reason is the one worth fixing.
    throw new Error(
      `${ghFailure("submit review (summary fallback) failed", summaryOnly.status, summaryOnly.body)} (${inlineFailure})`,
    );
  }
  return { githubReviewId: summaryOnly.data.id, inlinePosted: false };
}

/** Posts a plain conversation comment on the PR (the issues API), as the token's user. */
export async function postIssueComment(
  token: string,
  owner: string,
  repo: string,
  prNumber: number,
  body: string,
): Promise<{ id: number }> {
  const result = await ghRequest<{ id: number }>(
    `/repos/${owner}/${repo}/issues/${prNumber}/comments`,
    token,
    { method: "POST", body: JSON.stringify({ body }) },
  );
  if (!result.ok) {
    throw new Error(`post issue comment failed: ${result.status}`);
  }
  return { id: result.data.id };
}

/** Deletes a PR conversation comment. A comment that is already gone counts as deleted. */
export async function deleteIssueComment(
  token: string,
  owner: string,
  repo: string,
  commentId: number,
): Promise<void> {
  const result = await ghRequest<undefined>(
    `/repos/${owner}/${repo}/issues/comments/${commentId}`,
    token,
    { method: "DELETE" },
  );
  if (!result.ok && result.status !== 404) {
    throw new Error(`delete issue comment failed: ${result.status}`);
  }
}
