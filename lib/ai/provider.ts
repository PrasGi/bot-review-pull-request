import type { AIProviderName, ModelPricing } from "@/lib/db/types";

export interface AIMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface AIUsage {
  promptTokens: number;
  completionTokens: number;
}

export interface AICompletion {
  text: string;
  usage: AIUsage;
}

export type ThinkingMode = "enabled" | "disabled";
export type ReasoningEffort = "minimal" | "low" | "medium" | "high";

export interface AICompletionParams {
  model: string;
  messages: AIMessage[];
  maxTokens: number;
  timeoutMs?: number;
  thinking?: ThinkingMode;
  reasoningEffort?: ReasoningEffort;
  retryDeadlineAt?: number;
}

export interface AIProvider {
  readonly name: AIProviderName;
  complete(params: AICompletionParams): Promise<AICompletion>;
}

export function stripJsonFences(text: string): string {
  const trimmed = text.trim();
  const fenced = /^```(?:json)?\s*\n?([\s\S]*?)\n?```$/.exec(trimmed);
  return (fenced?.[1] ?? trimmed).trim();
}

export function computeCostUsd(
  usage: AIUsage,
  pricing: ModelPricing | undefined,
): number {
  if (!pricing) return 0;
  return (
    (usage.promptTokens / 1_000_000) * pricing.inputPerM +
    (usage.completionTokens / 1_000_000) * pricing.outputPerM
  );
}
