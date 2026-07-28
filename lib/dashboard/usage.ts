import { aiCallsCollection, reposCollection } from "@/lib/db/collections";
import type { UsageQuery } from "@/lib/schemas";

export interface UsageRow {
  group: string;
  calls: number;
  promptTokens: number;
  completionTokens: number;
  costUsd: number;
  avgLatencyMs: number;
  errorRate: number;
}

export interface UsageSummary {
  totalCost: number;
  totalPromptTokens: number;
  totalCompletionTokens: number;
  totalCalls: number;
  rows: UsageRow[];
}

function groupExpr(groupBy: UsageQuery["groupBy"]): unknown {
  if (groupBy === "day") {
    return { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } };
  }
  if (groupBy === "model") return "$model";
  return "$repoId";
}

export async function getUsage(query: UsageQuery): Promise<UsageSummary> {
  const aiCalls = await aiCallsCollection();
  const since = new Date(Date.now() - query.days * 24 * 60 * 60 * 1000);

  const agg = await aiCalls
    .aggregate<{
      _id: unknown;
      calls: number;
      promptTokens: number;
      completionTokens: number;
      costUsd: number;
      latencySum: number;
      errors: number;
    }>([
      { $match: { createdAt: { $gte: since } } },
      {
        $group: {
          _id: groupExpr(query.groupBy),
          calls: { $sum: 1 },
          promptTokens: { $sum: "$promptTokens" },
          completionTokens: { $sum: "$completionTokens" },
          costUsd: { $sum: "$costUsd" },
          latencySum: { $sum: "$latencyMs" },
          errors: {
            $sum: { $cond: [{ $eq: ["$status", "error"] }, 1, 0] },
          },
        },
      },
      { $sort: { costUsd: -1 } },
    ])
    .toArray();

  let repoName = new Map<string, string>();
  if (query.groupBy === "repo") {
    const repos = await reposCollection();
    const all = await repos.find({}).project({ fullName: 1 }).toArray();
    repoName = new Map(all.map((r) => [r._id.toHexString(), r.fullName]));
  }

  const rows: UsageRow[] = agg.map((r) => {
    let group = String(r._id);
    if (query.groupBy === "repo") {
      group = repoName.get(String(r._id)) ?? "unknown";
    }
    return {
      group,
      calls: r.calls,
      promptTokens: r.promptTokens,
      completionTokens: r.completionTokens,
      costUsd: r.costUsd,
      avgLatencyMs: r.calls > 0 ? Math.round(r.latencySum / r.calls) : 0,
      errorRate: r.calls > 0 ? r.errors / r.calls : 0,
    };
  });

  return {
    totalCost: rows.reduce((s, r) => s + r.costUsd, 0),
    totalPromptTokens: rows.reduce((s, r) => s + r.promptTokens, 0),
    totalCompletionTokens: rows.reduce((s, r) => s + r.completionTokens, 0),
    totalCalls: rows.reduce((s, r) => s + r.calls, 0),
    rows,
  };
}

export function usageToCsv(summary: UsageSummary): string {
  const header =
    "group,calls,prompt_tokens,completion_tokens,cost_usd,avg_latency_ms,error_rate";
  const lines = summary.rows.map((r) =>
    [
      `"${r.group.replace(/"/g, '""')}"`,
      r.calls,
      r.promptTokens,
      r.completionTokens,
      r.costUsd.toFixed(6),
      r.avgLatencyMs,
      r.errorRate.toFixed(4),
    ].join(","),
  );
  return [header, ...lines].join("\n");
}
