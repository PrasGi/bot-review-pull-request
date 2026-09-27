import type { AIProviderName } from "@/lib/db/types";

// Client-safe: dashboard selects and filters import this.

export const AI_PROVIDERS: AIProviderName[] = ["anthropic", "openai", "glm", "kimi"];

export const PROVIDER_LABEL: Record<AIProviderName, string> = {
  anthropic: "Anthropic",
  openai: "OpenAI",
  glm: "GLM",
  kimi: "Kimi",
};
