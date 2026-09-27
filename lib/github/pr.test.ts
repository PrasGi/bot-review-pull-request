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
