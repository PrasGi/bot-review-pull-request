import {
  reviewRequestsCollection,
  reviewsCollection,
  aiCallsCollection,
  userConnectionsCollection,
} from "@/lib/db/collections";

export interface DashboardStats {
  reviewsToday: number;
  reviewsThisWeek: number;
  costThisMonth: number;
  avgReviewSeconds: number;
  reviewsPerDay: { date: string; completed: number; failed: number }[];
  verdictDistribution: { verdict: string; count: number }[];
  attention: {
    reconnectAccounts: string[];
    failedLast24h: number;
  };
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
  const failedLast24h = await requests.countDocuments({
    status: "failed",
    finishedAt: { $gte: dayStart },
  });

  return {
    reviewsToday,
    reviewsThisWeek,
    costThisMonth,
    avgReviewSeconds,
    reviewsPerDay,
    verdictDistribution,
    attention: {
      reconnectAccounts: reconnectDocs.map((d) => d.githubLogin),
      failedLast24h,
    },
  };
}
