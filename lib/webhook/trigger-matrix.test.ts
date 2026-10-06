import { describe, it, expect, vi, beforeEach } from "vitest";
import { ObjectId } from "mongodb";
import type { PullRequestEvent } from "@/lib/webhook/payloads";

const INSTALLATION_ID = 500;
const REVIEWER_ID = 96962006;
const REPO_FULL = "PrasGi/demo";

const installation = {
  _id: new ObjectId(),
  installationId: INSTALLATION_ID,
  accountType: "User" as const,
  accountLogin: "PrasGi",
  accountId: REVIEWER_ID,
  repositorySelection: "selected" as const,
  createdAt: new Date(),
  updatedAt: new Date(),
};
const repo = {
  _id: new ObjectId(),
  installationRef: installation._id,
  installationId: INSTALLATION_ID,
  fullName: REPO_FULL,
  repoGithubId: 1,
  enabled: true,
  config: {
    provider: null,
    model: null,
    reviewProfile: "chill" as const,
    autoVerdict: true,
    customGuidelines: "",
    ignorePatterns: [],
    contextFiles: [],
    maxChunks: 3,
  },
  createdAt: new Date(),
  updatedAt: new Date(),
};
const reviewer = {
  _id: new ObjectId(),
  githubUserId: REVIEWER_ID,
  githubLogin: "PrasGi",
  displayName: "PrasGi",
  userTokenEncrypted: "enc",
  tokenExpiresAt: new Date(Date.now() + 3_600_000),
  refreshTokenEncrypted: "enc",
  refreshTokenExpiresAt: new Date(Date.now() + 3_600_000),
  installationIds: [INSTALLATION_ID],
  createdAt: new Date(),
  updatedAt: new Date(),
};

// Draft-skipped requests the ready_for_review lookup returns, newest first.
let skippedDrafts: { userConnectionId: ObjectId }[] = [];
const insertRequest = vi.fn<(doc: unknown) => Promise<{ acknowledged: boolean }>>(
  async () => ({ acknowledged: true }),
);
const updateRequests = vi.fn<(filter: unknown, update: unknown) => Promise<{ modifiedCount: number }>>(
  async () => ({ modifiedCount: 0 }),
);

vi.mock("@/lib/db/collections", () => ({
  installationsCollection: async () => ({
    findOne: async () => installation,
  }),
  reposCollection: async () => ({
    findOne: async () => repo,
    updateOne: async () => ({ modifiedCount: 1 }),
  }),
  userConnectionsCollection: async () => ({
    findOne: async (query: { githubUserId?: number; _id?: ObjectId }) =>
      query.githubUserId === REVIEWER_ID || query._id?.equals(reviewer._id)
        ? reviewer
        : null,
  }),
  reviewRequestsCollection: async () => ({
    findOne: async () => null,
    find: () => ({
      sort: () => ({ toArray: async () => skippedDrafts }),
    }),
    insertOne: insertRequest,
    updateOne: async () => ({ modifiedCount: 0 }),
    updateMany: updateRequests,
  }),
  reviewsCollection: async () => ({
    findOne: async () => null,
  }),
}));

function makeEvent(overrides: Partial<PullRequestEvent> = {}): PullRequestEvent {
  return {
    action: "review_requested",
    installation: { id: INSTALLATION_ID },
    repository: {
      id: 1,
      full_name: REPO_FULL,
      name: "demo",
      owner: { login: "PrasGi" },
    },
    requested_reviewer: { id: REVIEWER_ID, login: "PrasGi" },
    pull_request: {
      number: 1,
      title: "feat: add thing",
      body: "desc",
      html_url: "https://github.com/PrasGi/demo/pull/1",
      draft: false,
      user: { id: 42, login: "contributor" },
      head: { sha: "head1", ref: "feature" },
      base: { sha: "base1", ref: "main" },
    },
    ...overrides,
  };
}

describe("evaluatePullRequestEvent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    skippedDrafts = [];
  });

  it("queues a review when the reviewer matches and PR is ready", async () => {
    const { evaluatePullRequestEvent } = await import(
      "@/lib/webhook/trigger-matrix"
    );
    const outcome = await evaluatePullRequestEvent(makeEvent(), "d1");
    expect(outcome.status).toBe("queued");
  });

  it("skips a draft PR instead of queuing", async () => {
    const { evaluatePullRequestEvent } = await import(
      "@/lib/webhook/trigger-matrix"
    );
    const event = makeEvent({
      pull_request: { ...makeEvent().pull_request, draft: true },
    });
    const outcome = await evaluatePullRequestEvent(event, "d2");
    expect(outcome.status).toBe("skipped_draft");
  });

  it("ignores when the requested reviewer is not a connected user", async () => {
    const { evaluatePullRequestEvent } = await import(
      "@/lib/webhook/trigger-matrix"
    );
    const event = makeEvent({
      requested_reviewer: { id: 111111, login: "someone-else" },
    });
    const outcome = await evaluatePullRequestEvent(event, "d3");
    expect(outcome.status).toBe("ignored");
    if (outcome.status === "ignored") {
      expect(outcome.reason).toBe("reviewer_not_connected");
    }
  });

  it("ignores an unhandled action", async () => {
    const { evaluatePullRequestEvent } = await import(
      "@/lib/webhook/trigger-matrix"
    );
    const outcome = await evaluatePullRequestEvent(
      makeEvent({ action: "labeled" }),
      "d4",
    );
    expect(outcome.status).toBe("ignored");
  });
});

describe("evaluatePullRequestEvent — ready_for_review", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    skippedDrafts = [];
  });

  // GitHub's ready_for_review payload carries no requested_reviewer.
  const readyEvent = (requested?: { id: number; login: string }[]) =>
    makeEvent({
      action: "ready_for_review",
      requested_reviewer: undefined,
      pull_request: {
        ...makeEvent().pull_request,
        ...(requested ? { requested_reviewers: requested } : {}),
      },
    });

  it("queues the review that was skipped while the PR was a draft", async () => {
    const { evaluatePullRequestEvent } = await import(
      "@/lib/webhook/trigger-matrix"
    );
    skippedDrafts = [{ userConnectionId: reviewer._id }];

    const outcome = await evaluatePullRequestEvent(
      readyEvent([{ id: REVIEWER_ID, login: "PrasGi" }]),
      "d5",
    );

    expect(outcome.status).toBe("queued");
    expect(insertRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        trigger: "ready_for_review",
        status: "queued",
        userConnectionId: reviewer._id,
      }),
    );
  });

  it("resumes a draft skip only once", async () => {
    const { evaluatePullRequestEvent } = await import(
      "@/lib/webhook/trigger-matrix"
    );
    skippedDrafts = [{ userConnectionId: reviewer._id }];

    await evaluatePullRequestEvent(readyEvent(), "d6");

    expect(updateRequests).toHaveBeenCalledWith(
      expect.objectContaining({ status: "skipped_draft", draftResumedAt: { $exists: false } }),
      { $set: { draftResumedAt: expect.any(Date) } },
    );
  });

  it("ignores a PR that was never skipped as a draft", async () => {
    const { evaluatePullRequestEvent } = await import(
      "@/lib/webhook/trigger-matrix"
    );

    const outcome = await evaluatePullRequestEvent(readyEvent(), "d7");

    expect(outcome).toEqual({ status: "ignored", reason: "no_prior_draft_skip" });
    expect(insertRequest).not.toHaveBeenCalled();
  });

  it("ignores a reviewer whose request was removed before the PR was ready", async () => {
    const { evaluatePullRequestEvent } = await import(
      "@/lib/webhook/trigger-matrix"
    );
    skippedDrafts = [{ userConnectionId: reviewer._id }];

    const outcome = await evaluatePullRequestEvent(
      readyEvent([{ id: 222222, login: "someone-else" }]),
      "d8",
    );

    expect(outcome).toEqual({ status: "ignored", reason: "reviewer_no_longer_requested" });
    expect(insertRequest).not.toHaveBeenCalled();
  });
});
