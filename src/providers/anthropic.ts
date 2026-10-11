import { harnessError } from "../domain/errors.js";
import type {
  ChatMessage,
  LlmProvider,
  ProviderCompleteRequest,
  ProviderCompleteResult,
  ToolCall,
} from "./types.js";

type AnthropicContent =
  | { type: "text"; text?: string }
  | {
      type: "tool_use";
      id?: string;
      name?: string;
      input?: unknown;
    };

type AnthropicResponse = {
  model?: string;
  stop_reason?: string;
  content?: AnthropicContent[];
  usage?: { input_tokens?: number; output_tokens?: number };
  error?: { message?: string };
};

const splitSystem = (messages: readonly ChatMessage[]) => {
  const systemParts: string[] = [];
  const rest: ChatMessage[] = [];
  for (const message of messages) {
    if (message.role === "system") systemParts.push(message.content);
    else rest.push(message);
  }
  return { system: systemParts.join("\n\n"), messages: rest };
};

const toAnthropicMessages = (messages: readonly ChatMessage[]) => {
  const out: Array<Record<string, unknown>> = [];

  for (const message of messages) {
    if (message.role === "user") {
      out.push({ role: "user", content: message.content });
      continue;
    }
    if (message.role === "assistant") {
      const content: unknown[] = [];
      if (message.content) {
        content.push({ type: "text", text: message.content });
      }
      for (const call of message.toolCalls ?? []) {
        let input: unknown = {};
        try {
          input = JSON.parse(call.arguments);
        } catch {
          input = { raw: call.arguments };
        }
        content.push({
          type: "tool_use",
          id: call.id,
          name: call.name,
          input,
        });
      }
      out.push({ role: "assistant", content });
      continue;
    }
    if (message.role === "tool") {
      const last = out[out.length - 1];
      const block = {
        type: "tool_result",
        tool_use_id: message.toolCallId,
        content: message.content,
      };
      if (last && last.role === "user" && Array.isArray(last.content)) {
        (last.content as unknown[]).push(block);
      } else {
        out.push({ role: "user", content: [block] });
      }
    }
  }

  return out;
};

const mapFinish = (
  reason: string | undefined,
  toolCalls: readonly ToolCall[],
): ProviderCompleteResult["finishReason"] => {
  if (toolCalls.length > 0 || reason === "tool_use") return "tool_calls";
  if (reason === "max_tokens") return "length";
  if (reason === "end_turn" || reason === "stop_sequence") return "stop";
  return "unknown";
};

export const createAnthropicProvider = (options: {
  readonly apiKey: string;
  readonly baseUrl?: string;
}): LlmProvider => {
  const baseUrl = (options.baseUrl ?? "https://api.anthropic.com").replace(
    /\/$/,
    "",
  );

  return {
    id: "anthropic",
    complete: async (request: ProviderCompleteRequest) => {
      const { system, messages } = splitSystem(request.messages);
      const body = {
        model: request.model,
        max_tokens: request.maxTokens ?? 4096,
        system: system || undefined,
        messages: toAnthropicMessages(messages),
        tools: request.tools.map((tool) => ({
          name: tool.name,
          description: tool.description,
          input_schema: tool.parameters,
        })),
        temperature: request.temperature,
      };

      const response = await fetch(`${baseUrl}/v1/messages`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": options.apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify(body),
      });

      const json = (await response.json()) as AnthropicResponse;
      if (!response.ok) {
        const error = harnessError(
          "INTERNAL",
          json.error?.message ??
            `Anthropic request failed (${response.status})`,
          { status: response.status },
        );
        throw new Error(error.message);
      }

      const toolCalls: ToolCall[] = [];
      const textParts: string[] = [];
      for (const block of json.content ?? []) {
        if (block.type === "text" && block.text) textParts.push(block.text);
        if (block.type === "tool_use" && block.name) {
          toolCalls.push({
            id: block.id ?? `tool_${toolCalls.length}`,
            name: block.name,
            arguments: JSON.stringify(block.input ?? {}),
          });
        }
      }

      return {
        message: {
          role: "assistant",
          content: textParts.length > 0 ? textParts.join("\n") : null,
          ...(toolCalls.length > 0 ? { toolCalls } : {}),
        },
        finishReason: mapFinish(json.stop_reason, toolCalls),
        provider: "anthropic",
        model: json.model ?? request.model,
        usage: {
          inputTokens: json.usage?.input_tokens,
          outputTokens: json.usage?.output_tokens,
        },
      };
    },
  };
};
