import { ghRequest } from "@/lib/github/http";

export interface ReviewComment {
  id: number;
  in_reply_to_id?: number;
  pull_request_review_id?: number;
  path: string;
  line: number | null;
  body: string;
  user: { login: string };
  created_at: string;
}

export async function fetchReviewInlineComments(
  token: string,
  owner: string,
  repo: string,
  prNumber: number,
  reviewId: number,
): Promise<ReviewComment[]> {
  const result = await ghRequest<ReviewComment[]>(
    `/repos/${owner}/${repo}/pulls/${prNumber}/reviews/${reviewId}/comments?per_page=100`,
    token,
  );
  if (!result.ok) {
    throw new Error(`fetch review comments failed: ${result.status}`);
  }
  return result.data;
}

export async function fetchAllPrComments(
  token: string,
  owner: string,
  repo: string,
  prNumber: number,
): Promise<ReviewComment[]> {
  const comments: ReviewComment[] = [];
  const MAX_PAGES = 5;
  let page = 1;
  for (;;) {
    const result = await ghRequest<ReviewComment[]>(
      `/repos/${owner}/${repo}/pulls/${prNumber}/comments?per_page=100&page=${page}`,
      token,
    );
    if (!result.ok) {
      throw new Error(`fetch PR comments failed: ${result.status}`);
    }
    comments.push(...result.data);
    if (result.data.length < 100 || page >= MAX_PAGES) break;
    page += 1;
  }
  return comments;
}

export async function postReviewCommentReply(
  token: string,
  owner: string,
  repo: string,
  prNumber: number,
  commentId: number,
  body: string,
): Promise<void> {
  const result = await ghRequest<{ id: number }>(
    `/repos/${owner}/${repo}/pulls/${prNumber}/comments/${commentId}/replies`,
    token,
    { method: "POST", body: JSON.stringify({ body }) },
  );
  if (!result.ok) {
    throw new Error(`post reply failed: ${result.status}`);
  }
}
