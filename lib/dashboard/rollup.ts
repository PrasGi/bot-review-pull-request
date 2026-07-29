import { ObjectId } from "mongodb";
import { aiCallsCollection, usageDailyCollection } from "@/lib/db/collections";
import type { UsageDailyDoc } from "@/lib/db/types";

const ROLLUP_WINDOW_MS = 3 * 24 * 60 * 60 * 1000;

interface RollupGroup {
  _id: {
    date: string;
    repoId: ObjectId;
    userConnectionId: ObjectId;
    provider: string;
    model: string;
  };
  calls: number;
  promptTokens: number;
  completionTokens: number;
  costUsd: number;
  errorCount: number;
}

export async function rollupUsageDaily(): Promise<number> {
  const aiCalls = await aiCallsCollection();
  const usageDaily = await usageDailyCollection();
  const since = new Date(Date.now() - ROLLUP_WINDOW_MS);

  const groups = await aiCalls
    .aggregate<RollupGroup>([
      { $match: { createdAt: { $gte: since } } },
      {
        $group: {
          _id: {
            date: {
              $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
            },
            repoId: "$repoId",
            userConnectionId: "$userConnectionId",
            provider: "$provider",
            model: "$model",
          },
          calls: { $sum: 1 },
          promptTokens: { $sum: "$promptTokens" },
          completionTokens: { $sum: "$completionTokens" },
          costUsd: { $sum: "$costUsd" },
          errorCount: {
            $sum: { $cond: [{ $eq: ["$status", "error"] }, 1, 0] },
          },
        },
      },
    ])
    .toArray();

  if (groups.length === 0) return 0;

  const ops = groups.map((g) => {
    const id = `${g._id.date}|${g._id.repoId.toHexString()}|${g._id.provider}|${g._id.model}`;
    const doc: UsageDailyDoc = {
      _id: id,
      date: g._id.date,
      repoId: g._id.repoId,
      userConnectionId: g._id.userConnectionId,
      provider: g._id.provider as UsageDailyDoc["provider"],
      model: g._id.model,
      calls: g.calls,
      promptTokens: g.promptTokens,
      completionTokens: g.completionTokens,
      costUsd: g.costUsd,
      errorCount: g.errorCount,
    };
    return {
      replaceOne: {
        filter: { _id: id },
        replacement: doc,
        upsert: true,
      },
    };
  });

  await usageDaily.bulkWrite(ops, { ordered: false });
  return ops.length;
}
