import { NextResponse, type NextRequest } from "next/server";
import { withGuard } from "@/lib/auth/guard";
import { settingsCollection } from "@/lib/db/collections";
import { settingsUpdateSchema } from "@/lib/schemas";
import { encrypt } from "@/lib/crypto";
import type { AIProviderName } from "@/lib/db/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PROVIDERS: AIProviderName[] = ["anthropic", "openai", "glm", "kimi"];

export const GET = withGuard(async () => {
  const settings = await (await settingsCollection()).findOne({ _id: "global" });
  if (!settings) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Settings missing" } },
      { status: 404 },
    );
  }

  const providerKeysSet: Record<string, boolean> = {};
  for (const p of PROVIDERS) {
    providerKeysSet[p] = Boolean(settings.providerKeys[p]);
  }

  return NextResponse.json({
    defaultProvider: settings.defaultProvider,
    defaultModel: settings.defaultModel,
    defaultReviewProfile: settings.defaultReviewProfile,
    dailyCostAlertUsd: settings.dailyCostAlertUsd ?? null,
    providerKeysSet,
    modelPricing: settings.modelPricing,
    reviewProfiles: Object.keys(settings.promptTemplates),
  });
});

export const PATCH = withGuard(async (request: NextRequest) => {
  const parsed = settingsUpdateSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "Invalid body" } },
      { status: 422 },
    );
  }

  const set: Record<string, unknown> = { updatedAt: new Date() };
  const { data } = parsed;
  if (data.defaultProvider) set.defaultProvider = data.defaultProvider;
  if (data.defaultModel) set.defaultModel = data.defaultModel;
  if (data.defaultReviewProfile) {
    set.defaultReviewProfile = data.defaultReviewProfile;
  }
  if (data.dailyCostAlertUsd !== undefined) {
    set.dailyCostAlertUsd = data.dailyCostAlertUsd;
  }
  if (data.modelPricing) {
    set.modelPricing = data.modelPricing.map((p) => ({
      ...p,
      updatedAt: new Date(),
    }));
  }
  if (data.providerKeys) {
    for (const [provider, key] of Object.entries(data.providerKeys)) {
      set[`providerKeys.${provider}`] = encrypt(key);
    }
  }

  const settings = await settingsCollection();
  await settings.updateOne({ _id: "global" }, { $set: set });
  return NextResponse.json({ ok: true });
});
