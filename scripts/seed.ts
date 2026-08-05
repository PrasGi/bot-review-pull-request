import { hash } from "@node-rs/argon2";
import { ensureIndexes } from "@/lib/db/indexes";
import { settingsCollection } from "@/lib/db/collections";
import { getDefaultPromptTemplates } from "@/lib/prompts/defaults";
import { encrypt } from "@/lib/crypto";
import type { ModelPricing, SettingsDoc } from "@/lib/db/types";

const DEFAULT_PRICING: ModelPricing[] = [
  { provider: "glm", model: "glm-4.6", inputPerM: 0.6, outputPerM: 2.2, updatedAt: new Date() },
  { provider: "glm", model: "glm-4.7", inputPerM: 0.6, outputPerM: 2.2, updatedAt: new Date() },
  { provider: "glm", model: "glm-4.5-air", inputPerM: 0.2, outputPerM: 1.1, updatedAt: new Date() },
  { provider: "glm", model: "glm-5.2", inputPerM: 1.4, outputPerM: 4.4, updatedAt: new Date() },
  { provider: "kimi", model: "kimi-k2.5", inputPerM: 0.6, outputPerM: 3.0, updatedAt: new Date() },
  { provider: "kimi", model: "kimi-k2.7-code", inputPerM: 0.95, outputPerM: 4.0, updatedAt: new Date() },
];

async function main(): Promise<void> {
  const adminEmail = process.env.SEED_ADMIN_EMAIL;
  const adminPassword = process.env.SEED_ADMIN_PASSWORD;
  if (!adminEmail || !adminPassword) {
    throw new Error(
      "Set SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD before running the seed.",
    );
  }

  await ensureIndexes();

  const settings = await settingsCollection();
  const existing = await settings.findOne({ _id: "global" });

  const adminPasswordHash = await hash(adminPassword);
  const providerKeys: SettingsDoc["providerKeys"] = {};
  if (process.env.GLM_API_KEY) {
    providerKeys.glm = encrypt(process.env.GLM_API_KEY);
  }

  const doc: SettingsDoc = {
    _id: "global",
    adminEmail,
    adminPasswordHash,
    defaultProvider: "glm",
    defaultModel: "glm-5.2",
    defaultReviewProfile: existing?.defaultReviewProfile ?? "chill",
    providerKeys: existing?.providerKeys ?? providerKeys,
    modelPricing: existing?.modelPricing ?? DEFAULT_PRICING,
    promptTemplates: existing?.promptTemplates ?? getDefaultPromptTemplates(),
    dailyCostAlertUsd: existing?.dailyCostAlertUsd,
    updatedAt: new Date(),
  };

  await settings.replaceOne({ _id: "global" }, doc, { upsert: true });

  process.stdout.write(
    `Seed complete. Admin: ${adminEmail}. Default model: ${doc.defaultModel}.\n`,
  );
  process.exit(0);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`Seed failed: ${message}\n`);
  process.exit(1);
});
