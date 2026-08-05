import OpenAI from "openai";
import type { AIProviderName } from "@/lib/db/types";
import {
  stripJsonFences,
  type AIProvider,
  type AICompletion,
  type AICompletionParams,
} from "@/lib/ai/provider";

const LARGE_OUTPUT_CAP = 16_384;
const RATE_LIMIT_BACKOFF_MS = 2_000;

interface OpenAICompatibleOptions {
  name: AIProviderName;
  apiKey: string;
  baseURL?: string;
  vendorParams?: Record<string, unknown>;
}

export function createOpenAICompatibleProvider(
  options: OpenAICompatibleOptions,
): AIProvider {
  // maxRetries 0: the SDK's default (2) silently multiplies a timed-out call's
  // latency by 3x. Retry policy is owned by the pipeline, not the transport.
  const client = new OpenAI({
    apiKey: options.apiKey,
    baseURL: options.baseURL,
    maxRetries: 0,
  });

  const callOnce = async (
    params: AICompletionParams,
  ): Promise<AICompletion> => {
    const response = await client.chat.completions.create(
      {
        model: params.model,
        messages: params.messages,
        max_tokens: params.maxTokens,
        temperature: 0,
        top_p: 1,
        response_format: { type: "json_object" },
        // Vendor extensions go at the top level: the Node SDK forwards unknown
        // keys verbatim and has no `extra_body` wrapper (that is Python-only).
        ...(params.thinking ? { thinking: { type: params.thinking } } : {}),
        ...(params.reasoningEffort
          ? { reasoning_effort: params.reasoningEffort }
          : {}),
        ...(options.vendorParams ?? {}),
      } as OpenAI.Chat.ChatCompletionCreateParamsNonStreaming,
      params.timeoutMs ? { timeout: params.timeoutMs } : undefined,
    );

    const choice = response.choices[0];
    const content = choice?.message?.content;
    if (!content) {
      const reason = choice?.finish_reason ?? "unknown";
      // Reasoning models spend max_tokens on hidden thinking before emitting
      // content; surfacing the count is what tells these two failures apart.
      const reasoning =
        response.usage?.completion_tokens_details?.reasoning_tokens ?? 0;
      throw new Error(
        `${options.name}: empty completion (finish_reason=${reason}, reasoning_tokens=${reasoning})`,
      );
    }

    return {
      text: stripJsonFences(content),
      usage: {
        promptTokens: response.usage?.prompt_tokens ?? 0,
        completionTokens: response.usage?.completion_tokens ?? 0,
      },
    };
  };

  return {
    name: options.name,
    async complete(params: AICompletionParams): Promise<AICompletion> {
      const mayRetry = (): boolean =>
        params.retryDeadlineAt === undefined ||
        Date.now() < params.retryDeadlineAt;

      try {
        return await callOnce(params);
      } catch (error) {
        const msg = error instanceof Error ? error.message : "";
        if (!mayRetry()) throw error;

        // 429 is the provider refusing a concurrency slot, not a bad request.
        // Measured: firing 8 parallel calls at a Coding Plan tier rejects ~2 of
        // them outright, which would silently become dropped chunks.
        if (error instanceof OpenAI.APIError && error.status === 429) {
          await new Promise((resolve) => setTimeout(resolve, RATE_LIMIT_BACKOFF_MS));
          return callOnce(params);
        }

        if (msg.includes("finish_reason=length")) {
          // Below the ceiling the output genuinely needed more room, so double.
          // At or above it, doubling mostly funds a longer reasoning loop and
          // risks the wall-clock budget; shallow reasoning still returns JSON.
          return params.maxTokens < LARGE_OUTPUT_CAP
            ? callOnce({ ...params, maxTokens: params.maxTokens * 2 })
            : callOnce({ ...params, reasoningEffort: "low" });
        }
        if (msg.includes("empty completion")) {
          return callOnce(params);
        }
        // GLM latency is high and bursty; a timed-out call often succeeds on a
        // second attempt. One retry only — the SDK's own retries are disabled.
        if (msg.includes("Request timed out")) {
          return callOnce(params);
        }
        throw error;
      }
    },
  };
}
