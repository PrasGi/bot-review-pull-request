import {
  installationsCollection,
  pendingInstallationsCollection,
  userConnectionsCollection,
  reposCollection,
  reviewRequestsCollection,
  reviewsCollection,
  aiCallsCollection,
  usageDailyCollection,
  processedWebhooksCollection,
  sessionsCollection,
} from "@/lib/db/collections";

export async function ensureIndexes(): Promise<void> {
  const installations = await installationsCollection();
  await installations.createIndexes([
    { key: { installationId: 1 }, unique: true, name: "installationId_unique" },
    { key: { accountId: 1 }, name: "accountId" },
  ]);

  const pendingInstallations = await pendingInstallationsCollection();
  await pendingInstallations.createIndexes([
    { key: { requesterId: 1 }, name: "requesterId" },
  ]);

  const userConnections = await userConnectionsCollection();
  await userConnections.createIndexes([
    { key: { githubUserId: 1 }, unique: true, name: "githubUserId_unique" },
    { key: { githubLogin: 1 }, name: "githubLogin" },
    { key: { installationIds: 1 }, name: "installationIds" },
  ]);

  const repos = await reposCollection();
  const repoIndexes = await repos.indexes();
  if (repoIndexes.some((idx) => idx.name === "fullName_unique")) {
    await repos.dropIndex("fullName_unique");
  }
  await repos.createIndexes([
    {
      key: { installationId: 1, fullName: 1 },
      unique: true,
      name: "installation_fullName_unique",
    },
    { key: { fullName: 1 }, name: "fullName" },
    { key: { installationRef: 1 }, name: "installationRef" },
    { key: { installationId: 1 }, name: "installationId" },
  ]);

  const reviewRequests = await reviewRequestsCollection();
  await reviewRequests.createIndexes([
    { key: { repoId: 1, prNumber: 1, createdAt: -1 }, name: "repo_pr_recent" },
    { key: { status: 1 }, name: "status" },
    { key: { createdAt: -1 }, name: "recent" },
    {
      key: { repoId: 1, prNumber: 1 },
      unique: true,
      name: "one_active_run_per_pr",
      partialFilterExpression: {
        status: { $in: ["queued", "processing"] },
      },
    },
  ]);

  const reviews = await reviewsCollection();
  await reviews.createIndexes([
    { key: { repoId: 1, prNumber: 1, submittedAt: -1 }, name: "repo_pr_recent" },
    { key: { previousReviewId: 1 }, name: "review_chain" },
  ]);

  const aiCalls = await aiCallsCollection();
  await aiCalls.createIndexes([
    { key: { createdAt: -1 }, name: "recent" },
    { key: { repoId: 1, createdAt: -1 }, name: "repo_recent" },
    { key: { provider: 1, model: 1 }, name: "provider_model" },
    { key: { expiresAt: 1 }, expireAfterSeconds: 0, name: "ttl_prompt_purge" },
  ]);

  const usageDaily = await usageDailyCollection();
  await usageDaily.createIndexes([
    { key: { date: 1 }, name: "date" },
    { key: { repoId: 1, date: 1 }, name: "repo_date" },
  ]);

  const processedWebhooks = await processedWebhooksCollection();
  await processedWebhooks.createIndexes([
    { key: { expiresAt: 1 }, expireAfterSeconds: 0, name: "ttl_dedupe" },
  ]);

  const sessions = await sessionsCollection();
  await sessions.createIndexes([
    { key: { expiresAt: 1 }, expireAfterSeconds: 0, name: "ttl_session" },
  ]);
}
