import OpenAI from "openai";
import type { AIProviderName } from "@/lib/db/types";
import {
  stripJsonFences,
  type AIProvider,
  type AICompletion,
  type AICompletionParams,
} from "@/lib/ai/provider";

interface OpenAICompatibleOptions {
  name: AIProviderName;
  apiKey: string;
  baseURL?: string;
  deterministicExtraBody?: Record<string, unknown>;
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
        ...(options.deterministicExtraBody
          ? { extra_body: options.deterministicExtraBody }
          : {}),
      } as OpenAI.Chat.ChatCompletionCreateParamsNonStreaming,
      params.timeoutMs ? { timeout: params.timeoutMs } : undefined,
    );

    const choice = response.choices[0];
    const content = choice?.message?.content;
    if (!content) {
      const reason = choice?.finish_reason ?? "unknown";
      throw new Error(
        `${options.name}: empty completion (finish_reason=${reason})`,
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
      try {
        return await callOnce(params);
      } catch (error) {
        const msg = error instanceof Error ? error.message : "";
        // finish_reason=length means the response was truncated at the output
        // cap; retrying with the same budget fails identically, so double it.
        if (msg.includes("finish_reason=length")) {
          return callOnce({ ...params, maxTokens: params.maxTokens * 2 });
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
