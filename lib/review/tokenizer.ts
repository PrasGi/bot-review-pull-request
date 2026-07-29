import { Tiktoken } from "js-tiktoken/lite";
import cl100k_base from "js-tiktoken/ranks/cl100k_base";
import type { AIProviderName } from "@/lib/db/types";

let encoder: Tiktoken | null = null;

function getEncoder(): Tiktoken {
  encoder ??= new Tiktoken(cl100k_base);
  return encoder;
}

const HEURISTIC_CHAR_DIVISOR = 3;
const HEURISTIC_MAX_LEN = 500;

// js-tiktoken's pure-JS BPE is O(n^2)-ish on long low-entropy strings (e.g.
// minified/generated files with long repetitive runs) — encoding 18k such chars
// takes ~18s. Above this length we fall back to the char heuristic to protect
// the review latency budget; the heuristic over-estimates, which is safe.
const HEURISTIC_FALLBACK_LEN = 12_000;

function heuristicTokens(text: string): number {
  return Math.ceil(text.length / HEURISTIC_CHAR_DIVISOR);
}

export function countTokens(text: string): number {
  if (text.length === 0) return 0;
  if (text.length < HEURISTIC_MAX_LEN || text.length > HEURISTIC_FALLBACK_LEN) {
    return heuristicTokens(text);
  }
  return getEncoder().encode(text).length;
}

export const PROVIDER_BUDGET_MULTIPLIER: Record<AIProviderName, number> = {
  openai: 1.0,
  glm: 1.08,
  kimi: 1.12,
  anthropic: 1.25,
};

export function effectiveBudget(
  configuredBudget: number,
  provider: AIProviderName,
): number {
  return Math.floor(configuredBudget / PROVIDER_BUDGET_MULTIPLIER[provider]);
}

export function truncateToTokens(text: string, maxTokens: number): string {
  const enc = getEncoder();
  const tokens = enc.encode(text);
  if (tokens.length <= maxTokens) return text;

  const marker = `\n\n... [truncated ${tokens.length - maxTokens} tokens] ...\n\n`;
  const markerTokens = enc.encode(marker).length;
  const SEAM_MARGIN = 4;
  const budget = Math.max(1, maxTokens - markerTokens - SEAM_MARGIN);
  const head = Math.floor(budget * 0.6);
  const tail = budget - head;

  const headText = enc.decode(tokens.slice(0, head));
  const tailText = tail > 0 ? enc.decode(tokens.slice(tokens.length - tail)) : "";
  return `${headText}${marker}${tailText}`;
}
