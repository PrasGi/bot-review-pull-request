import { describe, it, expect, vi, beforeEach } from "vitest";
import { ObjectId } from "mongodb";
import type { ReviewRequestDoc, ReviewTrigger } from "@/lib/db/types";

// In-memory state behind the mocked collections.
const state: {
  request: ReviewRequestDoc | null;
  reviewForRequest: boolean;
  notified: boolean;
} = { request: null, reviewForRequest: false, notified: false };

vi.mock("@/lib/db/collections", () => ({
  reviewRequestsCollection: async () => ({
    findOne: async () => state.request,
    updateOne: async (filter: { failureNotifiedAt?: unknown }) => {
      if (filter.failureNotifiedAt && state.notified) return { modifiedCount: 0 };
      state.notified = true;
      return { modifiedCount: 1 };
    },
  }),
  reviewsCollection: async () => ({
    findOne: async () => (state.reviewForRequest ? { _id: new ObjectId() } : null),
  }),
  reposCollection: async () => ({ findOne: async () => null }),
}));

const createRetryRequest = vi.fn();
vi.mock("@/lib/dashboard/retry", () => ({
  createRetryRequest: (...args: unknown[]) => createRetryRequest(...args),
}));
vi.mock("@/lib/github/tokens", () => ({ getValidAccessToken: vi.fn() }));
vi.mock("@/lib/github/pr", () => ({ postIssueComment: vi.fn() }));

const { handleRequestFailure, AUTO_RETRY_DELAY_MS } = await import("./failure");

function makeRequest(trigger: ReviewTrigger): ReviewRequestDoc {
  return {
    _id: new ObjectId(),
    deliveryId: "d-1",
    userConnectionId: new ObjectId(),
    installationId: 1,
    repoId: new ObjectId(),
    prNumber: 42,
    prTitle: "Add pagination",
    prAuthor: "octo",
    prUrl: "https://github.com/o/r/pull/42",
    headSha: "abcdef1234567890",
    baseSha: "1234567",
    kind: "initial",
    trigger,
    status: "failed",
    error: { stage: "pipeline", message: "chunk 1: provider said sk-secret-value" },
    createdAt: new Date(),
  };
}

function makeDeps() {
  return {
    sleep: vi.fn(async () => {}),
    run: vi.fn(async () => {}),
    postComment: vi.fn(async () => {}),
    deleteStatus: vi.fn(async () => {}),
  };
}

beforeEach(() => {
  state.request = null;
  state.reviewForRequest = false;
  state.notified = false;
  createRetryRequest.mockReset();
});

describe("handleRequestFailure", () => {
  it("retries a first failure once, after the delay, without commenting", async () => {
    state.request = makeRequest("review_requested");
    const retryId = new ObjectId();
    createRetryRequest.mockResolvedValue({ ok: true, requestId: retryId.toHexString() });
    const deps = makeDeps();

    const outcome = await handleRequestFailure(state.request._id, deps);

    expect(outcome).toBe("retried");
    expect(deps.sleep).toHaveBeenCalledWith(AUTO_RETRY_DELAY_MS);
    expect(createRetryRequest).toHaveBeenCalledWith(state.request, "auto_retry");
    expect(deps.run).toHaveBeenCalledWith(retryId);
    expect(deps.postComment).not.toHaveBeenCalled();
    // The failed run's status comment goes before the retry posts its own.
    expect(deps.deleteStatus).toHaveBeenCalledWith(state.request._id);
    expect(deps.deleteStatus.mock.invocationCallOrder[0]).toBeLessThan(deps.run.mock.invocationCallOrder[0]!);
  });

  it("also retries a failed manual retry once before giving up", async () => {
    state.request = makeRequest("manual_retry");
    createRetryRequest.mockResolvedValue({ ok: true, requestId: new ObjectId().toHexString() });

    expect(await handleRequestFailure(state.request._id, makeDeps())).toBe("retried");
  });

  it("comments on the PR once when the automatic retry fails too", async () => {
    state.request = makeRequest("auto_retry");
    const deps = makeDeps();

    const outcome = await handleRequestFailure(state.request._id, deps);

    expect(outcome).toBe("commented");
    expect(deps.deleteStatus).toHaveBeenCalledWith(state.request._id);
    expect(createRetryRequest).not.toHaveBeenCalled();
    expect(deps.postComment).toHaveBeenCalledTimes(1);
    const [, body] = deps.postComment.mock.calls[0] as unknown as [ReviewRequestDoc, string];
    expect(body).toContain("Automated review could not be completed");
    expect(body).toContain("`abcdef1`");
    expect(body).not.toContain("sk-secret-value");
  });

  it("does not comment twice when the runner and the reaper both report the failure", async () => {
    state.request = makeRequest("auto_retry");
    const deps = makeDeps();

    await handleRequestFailure(state.request._id, deps);
    const second = await handleRequestFailure(state.request._id, deps);

    expect(second).toBe("already_notified");
    expect(deps.postComment).toHaveBeenCalledTimes(1);
  });

  it("does nothing when a review was already posted for the request", async () => {
    state.request = makeRequest("review_requested");
    state.reviewForRequest = true;
    const deps = makeDeps();

    expect(await handleRequestFailure(state.request._id, deps)).toBe("review_already_posted");
    expect(createRetryRequest).not.toHaveBeenCalled();
    expect(deps.postComment).not.toHaveBeenCalled();
  });

  it("skips the retry and the comment when another run for the PR is already active", async () => {
    state.request = makeRequest("review_requested");
    createRetryRequest.mockResolvedValue({ ok: false, reason: "already_active" });
    const deps = makeDeps();

    expect(await handleRequestFailure(state.request._id, deps)).toBe("retry_skipped_active");
    expect(deps.run).not.toHaveBeenCalled();
    expect(deps.postComment).not.toHaveBeenCalled();
  });

  it("contains a failed comment post instead of throwing", async () => {
    state.request = makeRequest("auto_retry");
    const deps = makeDeps();
    deps.postComment.mockRejectedValueOnce(new Error("reconnect required"));

    await expect(handleRequestFailure(state.request._id, deps)).resolves.toBe("comment_failed");
  });

  it("returns not_found for an unknown request", async () => {
    expect(await handleRequestFailure(new ObjectId(), makeDeps())).toBe("not_found");
  });
});
