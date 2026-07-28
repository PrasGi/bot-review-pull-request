import { gzipSync } from "node:zlib";
import { Binary, ObjectId } from "mongodb";
import { aiCallsCollection } from "@/lib/db/collections";
import type { AICallPurpose, AIProviderName } from "@/lib/db/types";
import type { AIUsage } from "@/lib/ai/provider";

const RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

export async function recordAiCall(params: {
  requestId: ObjectId;
  repoId: ObjectId;
  userConnectionId: ObjectId;
  provider: AIProviderName;
  model: string;
  purpose: AICallPurpose;
  templateVersion: number;
  prompt: string;
  response: string;
  usage: AIUsage;
  costUsd: number;
  latencyMs: number;
  status: "ok" | "error";
  errorMessage?: string;
}): Promise<void> {
  const collection = await aiCallsCollection();
  const now = new Date();
  await collection.insertOne({
    _id: new ObjectId(),
    requestId: params.requestId,
    repoId: params.repoId,
    userConnectionId: params.userConnectionId,
    provider: params.provider,
    model: params.model,
    purpose: params.purpose,
    templateVersion: params.templateVersion,
    promptTokens: params.usage.promptTokens,
    completionTokens: params.usage.completionTokens,
    costUsd: params.costUsd,
    latencyMs: params.latencyMs,
    promptGz: new Binary(gzipSync(params.prompt)),
    responseGz: new Binary(gzipSync(params.response)),
    status: params.status,
    ...(params.errorMessage ? { errorMessage: params.errorMessage } : {}),
    createdAt: now,
    expiresAt: new Date(now.getTime() + RETENTION_MS),
  });
}
