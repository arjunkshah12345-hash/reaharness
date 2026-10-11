import { harnessError } from "../domain/errors.js";
import type {
  ChatMessage,
  LlmProvider,
  ProviderCompleteRequest,
  ProviderCompleteResult,
  ToolCall,
} from "./types.js";

type OpenAiToolCall = {
  id?: string;
  type?: string;
  function?: { name?: string; arguments?: string };
};

type OpenAiMessage = {
  role?: string;
  content?: string | null;
  tool_calls?: OpenAiToolCall[];
};

type OpenAiResponse = {
  model?: string;
  choices?: Array<{
    finish_reason?: string;
    message?: OpenAiMessage;
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
  };
  error?: { message?: string };
};

const toOpenAiMessages = (messages: readonly ChatMessage[]) =>
  messages.map((message) => {
    if (message.role === "tool") {
      return {
        role: "tool",
        tool_call_id: message.toolCallId,
        name: message.name,
        content: message.content,
      };
    }
    if (message.role === "assistant") {
      return {
        role: "assistant",
        content: message.content,
        ...(message.toolCalls && message.toolCalls.length > 0
          ? {
              tool_calls: message.toolCalls.map((call) => ({
                id: call.id,
                type: "function",
                function: {
                  name: call.name,
                  arguments: call.arguments,
                },
              })),
            }
          : {}),
      };
    }
    return { role: message.role, content: message.content };
  });

const mapFinish = (
  reason: string | undefined,
  toolCalls: readonly ToolCall[],
): ProviderCompleteResult["finishReason"] => {
  if (toolCalls.length > 0 || reason === "tool_calls") return "tool_calls";
  if (reason === "length") return "length";
  if (reason === "stop") return "stop";
  return "unknown";
};

export const createOpenAiCompatProvider = (options: {
  readonly id: string;
  readonly apiKey?: string;
  readonly baseUrl: string;
}): LlmProvider => {
  const baseUrl = options.baseUrl.replace(/\/$/, "");

  return {
    id: options.id,
    complete: async (request: ProviderCompleteRequest) => {
      const headers: Record<string, string> = {
        "content-type": "application/json",
      };
      if (options.apiKey) headers.authorization = `Bearer ${options.apiKey}`;

      const body = {
        model: request.model,
        messages: toOpenAiMessages(request.messages),
        tools: request.tools.map((tool) => ({
          type: "function",
          function: {
            name: tool.name,
            description: tool.description,
            parameters: tool.parameters,
          },
        })),
        tool_choice: request.tools.length > 0 ? "auto" : undefined,
        temperature: request.temperature,
        max_tokens: request.maxTokens,
      };

      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });

      const json = (await response.json()) as OpenAiResponse;
      if (!response.ok) {
        const error = harnessError(
          "INTERNAL",
          json.error?.message ??
            `OpenAI-compatible request failed (${response.status})`,
          { provider: options.id, status: response.status },
        );
        throw new Error(error.message);
      }

      const choice = json.choices?.[0];
      const raw = choice?.message;
      if (!raw) {
        throw new Error("Provider returned no choices");
      }

      const toolCalls: ToolCall[] = (raw.tool_calls ?? [])
        .map((call, index) => ({
          id: call.id ?? `call_${index}`,
          name: call.function?.name ?? "",
          arguments: call.function?.arguments ?? "{}",
        }))
        .filter((call) => call.name.length > 0);

      return {
        message: {
          role: "assistant",
          content: raw.content ?? null,
          ...(toolCalls.length > 0 ? { toolCalls } : {}),
        },
        finishReason: mapFinish(choice?.finish_reason, toolCalls),
        provider: options.id,
        model: json.model ?? request.model,
        usage: {
          inputTokens: json.usage?.prompt_tokens,
          outputTokens: json.usage?.completion_tokens,
        },
      };
    },
  };
};
