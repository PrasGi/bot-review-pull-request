import {
  reviewRequestsCollection,
  reviewsCollection,
  aiCallsCollection,
  userConnectionsCollection,
  reposCollection,
  settingsCollection,
} from "@/lib/db/collections";

const REFRESH_EXPIRY_WARN_MS = 14 * 24 * 60 * 60 * 1000;
const REPO_STALE_MS = 7 * 24 * 60 * 60 * 1000;

export interface DashboardStats {
  reviewsToday: number;
  reviewsThisWeek: number;
  costThisMonth: number;
  avgReviewSeconds: number;
  reviewsPerDay: { date: string; completed: number; failed: number }[];
  verdictDistribution: { verdict: string; count: number }[];
  attention: {
    reconnectAccounts: string[];
    refreshExpiringAccounts: { githubLogin: string; expiresAt: string }[];
    staleRepos: string[];
    failedLast24h: number;
  };
  budgetAlert: { thresholdUsd: number; todayUsd: number } | null;
}

function startOfDay(offsetDays = 0): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - offsetDays);
  return d;
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const requests = await reviewRequestsCollection();
  const reviews = await reviewsCollection();
  const aiCalls = await aiCallsCollection();

  const todayStart = startOfDay(0);
  const weekStart = startOfDay(7);
  const monthStart = startOfDay(30);
  const dayStart = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [reviewsToday, reviewsThisWeek] = await Promise.all([
    reviews.countDocuments({ submittedAt: { $gte: todayStart } }),
    reviews.countDocuments({ submittedAt: { $gte: weekStart } }),
  ]);

  const costAgg = await aiCalls
    .aggregate<{ total: number }>([
      { $match: { createdAt: { $gte: monthStart } } },
      { $group: { _id: null, total: { $sum: "$costUsd" } } },
      { $project: { _id: 0, total: 1 } },
    ])
    .toArray();
  const costThisMonth = costAgg[0]?.total ?? 0;

  const durAgg = await requests
    .aggregate<{ avg: number }>([
      {
        $match: {
          status: "completed",
          startedAt: { $exists: true },
          finishedAt: { $exists: true, $gte: weekStart },
        },
      },
      {
        $project: {
          seconds: {
            $divide: [{ $subtract: ["$finishedAt", "$startedAt"] }, 1000],
          },
        },
      },
      { $group: { _id: null, avg: { $avg: "$seconds" } } },
      { $project: { _id: 0, avg: 1 } },
    ])
    .toArray();
  const avgReviewSeconds = Math.round(durAgg[0]?.avg ?? 0);

  const perDayAgg = await requests
    .aggregate<{ _id: string; completed: number; failed: number }>([
      { $match: { createdAt: { $gte: startOfDay(14) } } },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
          },
          completed: {
            $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] },
          },
          failed: { $sum: { $cond: [{ $eq: ["$status", "failed"] }, 1, 0] } },
        },
      },
      { $sort: { _id: 1 } },
    ])
    .toArray();
  const reviewsPerDay = perDayAgg.map((d) => ({
    date: d._id,
    completed: d.completed,
    failed: d.failed,
  }));

  const verdictAgg = await reviews
    .aggregate<{ _id: string; count: number }>([
      { $match: { submittedAt: { $gte: monthStart } } },
      { $group: { _id: "$verdict", count: { $sum: 1 } } },
    ])
    .toArray();
  const verdictDistribution = verdictAgg.map((v) => ({
    verdict: v._id,
    count: v.count,
  }));

  const connections = await userConnectionsCollection();
  const reconnectDocs = await connections
    .find({ reconnectRequired: true }, { projection: { githubLogin: 1 } })
    .toArray();

  const expiryCutoff = new Date(Date.now() + REFRESH_EXPIRY_WARN_MS);
  const expiringDocs = await connections
    .find(
      {
        reconnectRequired: { $ne: true },
        refreshTokenExpiresAt: { $lte: expiryCutoff },
      },
      { projection: { githubLogin: 1, refreshTokenExpiresAt: 1 } },
    )
    .toArray();

  const repos = await reposCollection();
  const staleCutoff = new Date(Date.now() - REPO_STALE_MS);
  const staleDocs = await repos
    .find(
      {
        enabled: true,
        removedFromInstallation: { $ne: true },
        lastEventAt: { $lt: staleCutoff },
      },
      { projection: { fullName: 1 } },
    )
    .toArray();

  const failedLast24h = await requests.countDocuments({
    status: "failed",
    finishedAt: { $gte: dayStart },
  });

  const settings = await settingsCollection();
  const settingsDoc = await settings.findOne(
    { _id: "global" },
    { projection: { dailyCostAlertUsd: 1 } },
  );
  const thresholdUsd = settingsDoc?.dailyCostAlertUsd ?? null;
  let budgetAlert: DashboardStats["budgetAlert"] = null;
  if (thresholdUsd !== null && thresholdUsd > 0) {
    const todayCostAgg = await aiCalls
      .aggregate<{ total: number }>([
        { $match: { createdAt: { $gte: todayStart } } },
        { $group: { _id: null, total: { $sum: "$costUsd" } } },
        { $project: { _id: 0, total: 1 } },
      ])
      .toArray();
    budgetAlert = {
      thresholdUsd,
      todayUsd: todayCostAgg[0]?.total ?? 0,
    };
  }

  return {
    reviewsToday,
    reviewsThisWeek,
    costThisMonth,
    avgReviewSeconds,
    reviewsPerDay,
    verdictDistribution,
    attention: {
      reconnectAccounts: reconnectDocs.map((d) => d.githubLogin),
      refreshExpiringAccounts: expiringDocs.map((d) => ({
        githubLogin: d.githubLogin,
        expiresAt: d.refreshTokenExpiresAt.toISOString(),
      })),
      staleRepos: staleDocs.map((d) => d.fullName),
      failedLast24h,
    },
    budgetAlert,
  };
}
