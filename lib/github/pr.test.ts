import { describe, it, expect, vi } from "vitest";

const ghRequest = vi.fn();
vi.mock("@/lib/github/http", () => ({ ghRequest: (...args: unknown[]) => ghRequest(...args) }));

const { postIssueComment } = await import("./pr");

describe("postIssueComment", () => {
  it("posts to the PR's issue comments endpoint with the body", async () => {
    ghRequest.mockResolvedValueOnce({ ok: true, status: 201, data: { id: 1 } });

    await postIssueComment("tok", "octo", "repo", 7, "hello");

    expect(ghRequest).toHaveBeenCalledWith("/repos/octo/repo/issues/7/comments", "tok", {
      method: "POST",
      body: JSON.stringify({ body: "hello" }),
    });
  });

  it("throws with the status when GitHub rejects the comment", async () => {
    ghRequest.mockResolvedValueOnce({ ok: false, status: 403, body: "" });

    await expect(postIssueComment("tok", "octo", "repo", 7, "hello")).rejects.toThrow("403");
  });
});

const { submitReview, ghErrorDetail } = await import("./pr");

const reviewInput = {
  owner: "octo",
  repo: "repo",
  prNumber: 7,
  commitId: "abc123",
  event: "APPROVE" as const,
  body: "Looks good.",
  comments: [{ path: "a.ts", line: 3, body: "nit" }],
};

const validationFailed = (...errors: string[]) =>
  JSON.stringify({ message: "Validation Failed", errors, documentation_url: "https://docs.github.com" });

describe("ghErrorDetail", () => {
  it("joins GitHub's message with each listed error", () => {
    expect(ghErrorDetail(validationFailed("Can not approve your own pull request"))).toBe(
      "Validation Failed: Can not approve your own pull request",
    );
  });

  it("reads errors given as objects", () => {
    const body = JSON.stringify({
      message: "Unprocessable Entity",
      errors: [{ resource: "PullRequestReview", code: "custom", message: "User can only have one pending review per pull request" }],
    });
    expect(ghErrorDetail(body)).toBe(
      "Unprocessable Entity: User can only have one pending review per pull request",
    );
  });

  it("returns nothing for a body that is not JSON", () => {
    expect(ghErrorDetail("<html>bad gateway</html>")).toBe("");
  });

  it("caps a very long explanation", () => {
    const detail = ghErrorDetail(validationFailed("x".repeat(1000)));
    expect(detail.length).toBe(300);
    expect(detail.endsWith("…")).toBe(true);
  });
});

describe("submitReview", () => {
  it("names GitHub's reason for both attempts when the fallback is rejected too", async () => {
    ghRequest
      .mockResolvedValueOnce({ ok: false, status: 422, body: validationFailed("Line could not be resolved") })
      .mockResolvedValueOnce({ ok: false, status: 422, body: validationFailed("Can not approve your own pull request") });

    await expect(submitReview("tok", reviewInput)).rejects.toThrow(
      "submit review (summary fallback) failed: 422 — Validation Failed: Can not approve your own pull request (inline: 422 — Validation Failed: Line could not be resolved)",
    );
  });

  it("keeps the bare status when GitHub gives no readable reason", async () => {
    ghRequest.mockResolvedValueOnce({ ok: false, status: 502, body: "" });

    await expect(submitReview("tok", reviewInput)).rejects.toThrow(/^submit review failed: 502$/);
  });

  it("falls back to a summary-only review when the inline comments are rejected", async () => {
    ghRequest
      .mockResolvedValueOnce({ ok: false, status: 422, body: validationFailed("Line could not be resolved") })
      .mockResolvedValueOnce({ ok: true, data: { id: 42 } });

    await expect(submitReview("tok", reviewInput)).resolves.toEqual({
      githubReviewId: 42,
      inlinePosted: false,
    });
  });
});
