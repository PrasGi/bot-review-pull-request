import { describe, it, expect, vi, beforeEach } from "vitest";
import { ObjectId } from "mongodb";
import type { ReviewRequestDoc } from "@/lib/db/types";

const updateOne = vi.fn();
const findOneAndUpdate = vi.fn();
const createIndex = vi.fn();
const postIssueComment = vi.fn();
const deleteIssueComment = vi.fn();

vi.mock("@/lib/db/collections", () => ({
  reviewRequestsCollection: async () => ({ updateOne, findOneAndUpdate, createIndex }),
  reposCollection: async () => ({ findOne: async () => ({ fullName: "o/r" }) }),
}));
vi.mock("@/lib/env", () => ({ getEnv: () => ({ APP_URL: "https://bot-review.example" }) }));
vi.mock("@/lib/github/tokens", () => ({ getValidAccessToken: async () => "user-token" }));
vi.mock("@/lib/github/pr", () => ({ postIssueComment, deleteIssueComment }));
vi.mock("@/lib/logger", () => ({ log: { warn: vi.fn() }, errorFields: () => ({}) }));

const { postStatusComment, deleteStatusComment } = await import("@/lib/review/status-comment");
const { hashUrlToken } = await import("@/lib/util/token");

const request = { _id: new ObjectId(), repoId: new ObjectId(), userConnectionId: new ObjectId(), prNumber: 3 } as ReviewRequestDoc;

describe("postStatusComment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    postIssueComment.mockResolvedValue({ id: 99 });
  });

  it("posts one comment with a live link whose token only exists as a hash", async () => {
    await postStatusComment(request);

    expect(postIssueComment).toHaveBeenCalledTimes(1);
    const [token, owner, repo, pr, body] = postIssueComment.mock.calls[0] as [string, string, string, number, string];
    expect([token, owner, repo, pr]).toEqual(["user-token", "o", "r", 3]);
    const link = /https:\/\/bot-review\.example\/live\/([A-Za-z0-9_-]{43})/.exec(body);
    expect(link).not.toBeNull();

    const hashSet = updateOne.mock.calls[0]?.[1] as { $set: { liveTokenHash: string } };
    expect(hashSet.$set.liveTokenHash).toBe(hashUrlToken(link![1]!));
    expect(JSON.stringify(updateOne.mock.calls)).not.toContain(link![1]);

    const idSet = updateOne.mock.calls[1]?.[1] as { $set: { statusComment: { id: number } } };
    expect(idSet.$set.statusComment.id).toBe(99);
  });

  it("never throws when GitHub rejects the comment", async () => {
    postIssueComment.mockRejectedValue(new Error("403"));
    await expect(postStatusComment(request)).resolves.toBeUndefined();
  });
});

describe("deleteStatusComment", () => {
  beforeEach(() => vi.clearAllMocks());

  it("deletes the claimed comment once", async () => {
    findOneAndUpdate.mockResolvedValueOnce({ ...request, statusComment: { id: 99, postedAt: new Date() } });
    findOneAndUpdate.mockResolvedValueOnce(null);

    await deleteStatusComment(request._id);
    await deleteStatusComment(request._id);

    expect(deleteIssueComment).toHaveBeenCalledTimes(1);
    expect(deleteIssueComment).toHaveBeenCalledWith("user-token", "o", "r", 99);
    const [filter] = findOneAndUpdate.mock.calls[0] as [Record<string, unknown>];
    expect(filter).toMatchObject({ "statusComment.deletedAt": { $exists: false } });
  });

  it("never throws when the delete fails", async () => {
    findOneAndUpdate.mockResolvedValue({ ...request, statusComment: { id: 99, postedAt: new Date() } });
    deleteIssueComment.mockRejectedValue(new Error("500"));
    await expect(deleteStatusComment(request._id)).resolves.toBeUndefined();
  });
});
