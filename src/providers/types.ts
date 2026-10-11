export type Role = "system" | "user" | "assistant" | "tool";

export type TextContent = {
  readonly type: "text";
  readonly text: string;
};

export type ToolCall = {
  readonly id: string;
  readonly name: string;
  readonly arguments: string;
};

export type ChatMessage =
  | {
      readonly role: "system" | "user";
      readonly content: string;
    }
  | {
      readonly role: "assistant";
      readonly content: string | null;
      readonly toolCalls?: readonly ToolCall[];
    }
  | {
      readonly role: "tool";
      readonly toolCallId: string;
      readonly name: string;
      readonly content: string;
    };

export type ProviderTool = {
  readonly name: string;
  readonly description: string;
  readonly parameters: Record<string, unknown>;
};

export type ProviderCompleteRequest = {
  readonly model: string;
  readonly messages: readonly ChatMessage[];
  readonly tools: readonly ProviderTool[];
  readonly temperature?: number;
  readonly maxTokens?: number;
};

export type ProviderCompleteResult = {
  readonly message: Extract<ChatMessage, { role: "assistant" }>;
  readonly finishReason: "stop" | "tool_calls" | "length" | "unknown";
  readonly provider: string;
  readonly model: string;
  readonly usage?: {
    readonly inputTokens: number | undefined;
    readonly outputTokens: number | undefined;
  };
};

export type LlmProvider = {
  readonly id: string;
  readonly complete: (
    request: ProviderCompleteRequest,
  ) => Promise<ProviderCompleteResult>;
};

export type ProviderKind =
  | "openai"
  | "openrouter"
  | "groq"
  | "ollama"
  | "together"
  | "deepseek"
  | "fireworks"
  | "gemini"
  | "xai"
  | "anthropic"
  | "openai_compat";

export type ProviderConfig = {
  readonly kind: ProviderKind;
  readonly model: string;
  readonly apiKey?: string;
  readonly baseUrl?: string;
};
