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
  const client = new OpenAI({
    apiKey: options.apiKey,
    baseURL: options.baseURL,
  });

  return {
    name: options.name,
    async complete(params: AICompletionParams): Promise<AICompletion> {
      const response = await client.chat.completions.create({
        model: params.model,
        messages: params.messages,
        max_tokens: params.maxTokens,
        temperature: 0,
        top_p: 1,
        response_format: { type: "json_object" },
        ...(options.deterministicExtraBody
          ? { extra_body: options.deterministicExtraBody }
          : {}),
      } as OpenAI.Chat.ChatCompletionCreateParamsNonStreaming);

      const choice = response.choices[0];
      const content = choice?.message?.content;
      if (!content) throw new Error(`${options.name}: empty completion`);

      return {
        text: stripJsonFences(content),
        usage: {
          promptTokens: response.usage?.prompt_tokens ?? 0,
          completionTokens: response.usage?.completion_tokens ?? 0,
        },
      };
    },
  };
}
