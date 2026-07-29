import { gunzipSync } from "node:zlib";
import { ObjectId, type Filter } from "mongodb";
import {
  reviewRequestsCollection,
  reviewsCollection,
  aiCallsCollection,
  reposCollection,
} from "@/lib/db/collections";
import type {
  ReviewRequestDoc,
  ReviewDoc,
  AICallDoc,
} from "@/lib/db/types";
import type { RequestsQuery } from "@/lib/schemas";

export interface RequestListItem {
  id: string;
  prNumber: number;
  prTitle: string;
  prAuthor: string;
  prUrl: string;
  repoFullName: string;
  status: string;
  kind: string;
  trigger: string;
  createdAt: string;
  startedAt?: string;
  finishedAt?: string;
  durationMs?: number;
  verdict?: string;
  costUsd: number;
}

export interface RequestListResult {
  items: RequestListItem[];
  total: number;
  page: number;
  pageSize: number;
}

export async function listRequests(
  query: RequestsQuery,
): Promise<RequestListResult> {
  const requests = await reviewRequestsCollection();
  const filter: Filter<ReviewRequestDoc> = {};
  if (query.status) filter.status = query.status;
  if (query.repoId && ObjectId.isValid(query.repoId)) {
    filter.repoId = new ObjectId(query.repoId);
  }
  if (query.search) {
    const rx = new RegExp(query.search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    const asNum = Number.parseInt(query.search, 10);
    filter.$or = [
      { prTitle: rx },
      { prAuthor: rx },
      ...(Number.isNaN(asNum) ? [] : [{ prNumber: asNum }]),
    ];
  }

  const total = await requests.countDocuments(filter);
  const docs = await requests
    .find(filter)
    .sort({ createdAt: -1 })
    .skip((query.page - 1) * query.pageSize)
    .limit(query.pageSize)
    .toArray();

  const repoIds = [...new Set(docs.map((d) => d.repoId.toHexString()))];
  const repos = await reposCollection();
  const repoDocs = await repos
    .find({ _id: { $in: repoIds.map((id) => new ObjectId(id)) } })
    .toArray();
  const repoName = new Map(
    repoDocs.map((r) => [r._id.toHexString(), r.fullName]),
  );

  const reviews = await reviewsCollection();
  const aiCalls = await aiCallsCollection();
  const requestIds = docs.map((d) => d._id);
  const verdicts = await reviews
    .find({ requestId: { $in: requestIds } })
    .project({ requestId: 1, verdict: 1 })
    .toArray();
  const verdictByReq = new Map(
    verdicts.map((v) => [v.requestId.toHexString(), v.verdict as string]),
  );
  const costAgg = await aiCalls
    .aggregate<{ _id: ObjectId; total: number }>([
      { $match: { requestId: { $in: requestIds } } },
      { $group: { _id: "$requestId", total: { $sum: "$costUsd" } } },
    ])
    .toArray();
  const costByReq = new Map(
    costAgg.map((c) => [c._id.toHexString(), c.total]),
  );

  const items: RequestListItem[] = docs.map((d) => ({
    id: d._id.toHexString(),
    prNumber: d.prNumber,
    prTitle: d.prTitle,
    prAuthor: d.prAuthor,
    prUrl: d.prUrl,
    repoFullName: repoName.get(d.repoId.toHexString()) ?? "unknown",
    status: d.status,
    kind: d.kind,
    trigger: d.trigger,
    createdAt: d.createdAt.toISOString(),
    ...(d.startedAt ? { startedAt: d.startedAt.toISOString() } : {}),
    ...(d.finishedAt ? { finishedAt: d.finishedAt.toISOString() } : {}),
    ...(d.finishedAt
      ? { durationMs: d.finishedAt.getTime() - d.createdAt.getTime() }
      : {}),
    ...(verdictByReq.has(d._id.toHexString())
      ? { verdict: verdictByReq.get(d._id.toHexString()) }
      : {}),
    costUsd: costByReq.get(d._id.toHexString()) ?? 0,
  }));

  return { items, total, page: query.page, pageSize: query.pageSize };
}

function safeGunzip(bin: unknown): string {
  try {
    if (bin && typeof bin === "object" && "buffer" in bin) {
      return gunzipSync((bin as { buffer: Buffer }).buffer).toString("utf8");
    }
    return "";
  } catch {
    return "";
  }
}

export interface RequestDetail {
  request: ReviewRequestDoc;
  review: ReviewDoc | null;
  aiCalls: (Omit<AICallDoc, "promptGz" | "responseGz"> & {
    prompt: string;
    response: string;
  })[];
  repoFullName: string;
}

export async function getRequestDetail(
  id: string,
): Promise<RequestDetail | null> {
  if (!ObjectId.isValid(id)) return null;
  const requests = await reviewRequestsCollection();
  const request = await requests.findOne({ _id: new ObjectId(id) });
  if (!request) return null;

  const reviews = await reviewsCollection();
  const review = await reviews.findOne(
    { requestId: request._id },
    { sort: { submittedAt: -1 } },
  );

  const aiCalls = await aiCallsCollection();
  const calls = await aiCalls
    .find({ requestId: request._id })
    .sort({ createdAt: 1 })
    .toArray();

  const repos = await reposCollection();
  const repo = await repos.findOne({ _id: request.repoId });

  return {
    request,
    review,
    aiCalls: calls.map((c) => {
      const { promptGz, responseGz, ...rest } = c;
      return {
        ...rest,
        prompt: safeGunzip(promptGz),
        response: safeGunzip(responseGz),
      };
    }),
    repoFullName: repo?.fullName ?? "unknown",
  };
}
