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
    reviewProfile: "normal" as const,
    autoVerdict: true,
    confidenceThreshold: 0.6,
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

vi.mock("@/lib/db/collections", () => ({
  installationsCollection: async () => ({
    findOne: async () => installation,
  }),
  reposCollection: async () => ({
    findOne: async () => repo,
    updateOne: async () => ({ modifiedCount: 1 }),
  }),
  userConnectionsCollection: async () => ({
    findOne: async (query: { githubUserId?: number }) =>
      query.githubUserId === REVIEWER_ID ? reviewer : null,
  }),
  reviewRequestsCollection: async () => ({
    findOne: async () => null,
    insertOne: async () => ({ acknowledged: true }),
    updateOne: async () => ({ modifiedCount: 0 }),
    updateMany: async () => ({ modifiedCount: 0 }),
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
  beforeEach(() => vi.clearAllMocks());

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
