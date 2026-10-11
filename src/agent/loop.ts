import {
  createSession,
  dispatchTool,
  type HarnessSession,
} from "../application/dispatch.js";
import { TOOL_NAMES, type ToolName } from "../contracts/tools.js";
import type {
  ChatMessage,
  LlmProvider,
  ProviderCompleteResult,
  ToolCall,
} from "../providers/types.js";
import { toProviderTools } from "../providers/toolSchemas.js";
import { DEFAULT_SYSTEM_PROMPT } from "./system.js";

export type AgentTurn = {
  readonly index: number;
  readonly assistant: Extract<ChatMessage, { role: "assistant" }>;
  readonly toolResults: readonly Extract<ChatMessage, { role: "tool" }>[];
  readonly provider: ProviderCompleteResult;
};

export type AgentRunResult = {
  readonly ok: true;
  readonly finalText: string;
  readonly messages: readonly ChatMessage[];
  readonly turns: readonly AgentTurn[];
  readonly stopReason: "completed" | "max_turns";
};

export type AgentRunOptions = {
  readonly workspaceRoot: string;
  readonly provider: LlmProvider;
  readonly model: string;
  readonly prompt: string;
  readonly systemPrompt?: string;
  readonly maxTurns?: number;
  readonly temperature?: number;
  readonly maxTokens?: number;
  readonly onTurn?: (turn: AgentTurn) => void;
};

const isToolName = (name: string): name is ToolName =>
  (TOOL_NAMES as readonly string[]).includes(name);

const executeToolCall = async (
  session: HarnessSession,
  call: ToolCall,
): Promise<Extract<ChatMessage, { role: "tool" }>> => {
  let args: unknown = {};
  try {
    args = JSON.parse(call.arguments || "{}");
  } catch {
    args = { raw: call.arguments };
  }

  if (!isToolName(call.name)) {
    return {
      role: "tool",
      toolCallId: call.id,
      name: call.name,
      content: JSON.stringify({
        ok: false,
        error: {
          code: "INVALID_INPUT",
          message: `Unknown tool: ${call.name}`,
        },
        evidence: [],
        unknowns: [],
        limits: {},
      }),
    };
  }

  const result = await dispatchTool(session, call.name, args);
  return {
    role: "tool",
    toolCallId: call.id,
    name: call.name,
    content: JSON.stringify(result),
  };
};

/**
 * Provider-agnostic tool loop (OpenAI Agents / Goose / OpenCode shape):
 * model → optional tool calls → execute → append → repeat.
 */
export const runAgent = async (
  options: AgentRunOptions,
): Promise<AgentRunResult> => {
  const maxTurns = options.maxTurns ?? 20;
  const session = createSession(options.workspaceRoot);
  const tools = toProviderTools();
  const messages: ChatMessage[] = [
    {
      role: "system",
      content: options.systemPrompt ?? DEFAULT_SYSTEM_PROMPT,
    },
    { role: "user", content: options.prompt },
  ];
  const turns: AgentTurn[] = [];

  for (let index = 0; index < maxTurns; index += 1) {
    const completion = await options.provider.complete({
      model: options.model,
      messages,
      tools,
      ...(options.temperature !== undefined
        ? { temperature: options.temperature }
        : {}),
      ...(options.maxTokens !== undefined
        ? { maxTokens: options.maxTokens }
        : {}),
    });

    messages.push(completion.message);

    const calls = completion.message.toolCalls ?? [];
    if (calls.length === 0) {
      const turn: AgentTurn = {
        index,
        assistant: completion.message,
        toolResults: [],
        provider: completion,
      };
      turns.push(turn);
      options.onTurn?.(turn);
      return {
        ok: true,
        finalText: completion.message.content ?? "",
        messages,
        turns,
        stopReason: "completed",
      };
    }

    const toolResults: Extract<ChatMessage, { role: "tool" }>[] = [];
    for (const call of calls) {
      const result = await executeToolCall(session, call);
      toolResults.push(result);
      messages.push(result);
    }

    const turn: AgentTurn = {
      index,
      assistant: completion.message,
      toolResults,
      provider: completion,
    };
    turns.push(turn);
    options.onTurn?.(turn);
  }

  const lastAssistant = [...messages]
    .reverse()
    .find((message) => message.role === "assistant");

  return {
    ok: true,
    finalText:
      lastAssistant && lastAssistant.role === "assistant"
        ? (lastAssistant.content ?? "")
        : "",
    messages,
    turns,
    stopReason: "max_turns",
  };
};
