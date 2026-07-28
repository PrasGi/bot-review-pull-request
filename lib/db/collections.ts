import type { Collection } from "mongodb";
import { getDb } from "@/lib/db/client";
import type {
  InstallationDoc,
  UserConnectionDoc,
  RepoDoc,
  ReviewRequestDoc,
  ReviewDoc,
  AICallDoc,
  UsageDailyDoc,
  ProcessedWebhookDoc,
  SettingsDoc,
  SessionDoc,
} from "@/lib/db/types";

export const COLLECTIONS = {
  installations: "installations",
  userConnections: "user_connections",
  repos: "repos",
  reviewRequests: "review_requests",
  reviews: "reviews",
  aiCalls: "ai_calls",
  usageDaily: "usage_daily",
  processedWebhooks: "processed_webhooks",
  settings: "settings",
  sessions: "sessions",
} as const;

export async function installationsCollection(): Promise<
  Collection<InstallationDoc>
> {
  return (await getDb()).collection<InstallationDoc>(COLLECTIONS.installations);
}

export async function userConnectionsCollection(): Promise<
  Collection<UserConnectionDoc>
> {
  return (await getDb()).collection<UserConnectionDoc>(
    COLLECTIONS.userConnections,
  );
}

export async function reposCollection(): Promise<Collection<RepoDoc>> {
  return (await getDb()).collection<RepoDoc>(COLLECTIONS.repos);
}

export async function reviewRequestsCollection(): Promise<
  Collection<ReviewRequestDoc>
> {
  return (await getDb()).collection<ReviewRequestDoc>(
    COLLECTIONS.reviewRequests,
  );
}

export async function reviewsCollection(): Promise<Collection<ReviewDoc>> {
  return (await getDb()).collection<ReviewDoc>(COLLECTIONS.reviews);
}

export async function aiCallsCollection(): Promise<Collection<AICallDoc>> {
  return (await getDb()).collection<AICallDoc>(COLLECTIONS.aiCalls);
}

export async function usageDailyCollection(): Promise<
  Collection<UsageDailyDoc>
> {
  return (await getDb()).collection<UsageDailyDoc>(COLLECTIONS.usageDaily);
}

export async function processedWebhooksCollection(): Promise<
  Collection<ProcessedWebhookDoc>
> {
  return (await getDb()).collection<ProcessedWebhookDoc>(
    COLLECTIONS.processedWebhooks,
  );
}

export async function settingsCollection(): Promise<Collection<SettingsDoc>> {
  return (await getDb()).collection<SettingsDoc>(COLLECTIONS.settings);
}

export async function sessionsCollection(): Promise<Collection<SessionDoc>> {
  return (await getDb()).collection<SessionDoc>(COLLECTIONS.sessions);
}
