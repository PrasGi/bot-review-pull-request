import { getEnv } from "@/lib/env";
import { decrypt } from "@/lib/crypto";
import type { AIProviderName, SettingsDoc, RepoConfig } from "@/lib/db/types";
import type { AIProvider } from "@/lib/ai/provider";
import { createOpenAICompatibleProvider } from "@/lib/ai/openai-compatible";
import { createAnthropicProvider } from "@/lib/ai/anthropic";

export interface ResolvedModel {
  provider: AIProviderName;
  model: string;
  instance: AIProvider;
}

function resolveApiKey(
  provider: AIProviderName,
  settings: SettingsDoc,
): string {
  const fromSettings = settings.providerKeys[provider];
  if (fromSettings) return decrypt(fromSettings);

  const env = getEnv();
  const envKey: Record<AIProviderName, string | undefined> = {
    glm: env.GLM_API_KEY,
    kimi: env.KIMI_API_KEY,
    anthropic: env.ANTHROPIC_API_KEY,
    openai: env.OPENAI_API_KEY,
  };
  const key = envKey[provider];
  if (!key) throw new Error(`No API key configured for provider "${provider}"`);
  return key;
}

function buildProvider(
  provider: AIProviderName,
  apiKey: string,
): AIProvider {
  const env = getEnv();
  switch (provider) {
    case "glm":
      return createOpenAICompatibleProvider({
        name: "glm",
        apiKey,
        baseURL: env.GLM_BASE_URL,
        vendorParams: { do_sample: false },
      });
    case "kimi":
      return createOpenAICompatibleProvider({
        name: "kimi",
        apiKey,
        baseURL: env.KIMI_BASE_URL,
      });
    case "openai":
      return createOpenAICompatibleProvider({ name: "openai", apiKey });
    case "anthropic":
      return createAnthropicProvider(apiKey);
  }
}

export function resolveModel(
  config: RepoConfig,
  settings: SettingsDoc,
): ResolvedModel {
  const provider = config.provider ?? settings.defaultProvider;
  const model = config.model ?? settings.defaultModel;
  const apiKey = resolveApiKey(provider, settings);
  return { provider, model, instance: buildProvider(provider, apiKey) };
}
