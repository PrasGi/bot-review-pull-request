import Anthropic from "@anthropic-ai/sdk";
import {
  stripJsonFences,
  type AIProvider,
  type AICompletion,
  type AICompletionParams,
} from "@/lib/ai/provider";

export function createAnthropicProvider(apiKey: string): AIProvider {
  const client = new Anthropic({ apiKey, maxRetries: 0 });

  return {
    name: "anthropic",
    async complete(params: AICompletionParams): Promise<AICompletion> {
      const system = params.messages
        .filter((m) => m.role === "system")
        .map((m) => m.content)
        .join("\n\n");
      const messages = params.messages
        .filter((m) => m.role !== "system")
        .map((m) => ({
          role: m.role === "assistant" ? ("assistant" as const) : ("user" as const),
          content: m.content,
        }));

      const response = await client.messages.create(
        {
          model: params.model,
          max_tokens: params.maxTokens,
          temperature: 0,
          system,
          messages,
        },
        params.timeoutMs ? { timeout: params.timeoutMs } : undefined,
      );

      const textPart = response.content.find((part) => part.type === "text");
      const text = textPart && "text" in textPart ? textPart.text : "";
      if (!text) throw new Error("anthropic: empty completion");

      return {
        text: stripJsonFences(text),
        usage: {
          promptTokens: response.usage.input_tokens,
          completionTokens: response.usage.output_tokens,
        },
      };
    },
  };
}
