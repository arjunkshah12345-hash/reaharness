import type { ProviderKind } from "./types.js";

export type ProviderPreset = {
  readonly kind: ProviderKind;
  readonly label: string;
  readonly defaultModel: string;
  readonly baseUrl?: string;
  readonly apiKeyEnvs: readonly string[];
  /** Wire protocol used by createProvider. */
  readonly protocol: "openai_compat" | "anthropic";
};

/**
 * Presets mirror what Goose / OpenCode / Agents SDK treat as first-class:
 * OpenAI-compatible gateways plus Anthropic Messages.
 */
export const PROVIDER_PRESETS: Record<ProviderKind, ProviderPreset> = {
  openai: {
    kind: "openai",
    label: "OpenAI",
    defaultModel: "gpt-4.1",
    baseUrl: "https://api.openai.com/v1",
    apiKeyEnvs: ["OPENAI_API_KEY", "REAHARNESS_API_KEY"],
    protocol: "openai_compat",
  },
  openrouter: {
    kind: "openrouter",
    label: "OpenRouter",
    defaultModel: "anthropic/claude-sonnet-4",
    baseUrl: "https://openrouter.ai/api/v1",
    apiKeyEnvs: ["OPENROUTER_API_KEY", "REAHARNESS_API_KEY"],
    protocol: "openai_compat",
  },
  groq: {
    kind: "groq",
    label: "Groq",
    defaultModel: "llama-3.3-70b-versatile",
    baseUrl: "https://api.groq.com/openai/v1",
    apiKeyEnvs: ["GROQ_API_KEY", "REAHARNESS_API_KEY"],
    protocol: "openai_compat",
  },
  ollama: {
    kind: "ollama",
    label: "Ollama",
    defaultModel: "llama3.2",
    baseUrl: "http://127.0.0.1:11434/v1",
    apiKeyEnvs: ["OLLAMA_API_KEY", "REAHARNESS_API_KEY"],
    protocol: "openai_compat",
  },
  together: {
    kind: "together",
    label: "Together AI",
    defaultModel: "meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo",
    baseUrl: "https://api.together.xyz/v1",
    apiKeyEnvs: ["TOGETHER_API_KEY", "REAHARNESS_API_KEY"],
    protocol: "openai_compat",
  },
  deepseek: {
    kind: "deepseek",
    label: "DeepSeek",
    defaultModel: "deepseek-chat",
    baseUrl: "https://api.deepseek.com/v1",
    apiKeyEnvs: ["DEEPSEEK_API_KEY", "REAHARNESS_API_KEY"],
    protocol: "openai_compat",
  },
  fireworks: {
    kind: "fireworks",
    label: "Fireworks",
    defaultModel: "accounts/fireworks/models/llama-v3p3-70b-instruct",
    baseUrl: "https://api.fireworks.ai/inference/v1",
    apiKeyEnvs: ["FIREWORKS_API_KEY", "REAHARNESS_API_KEY"],
    protocol: "openai_compat",
  },
  gemini: {
    kind: "gemini",
    label: "Google Gemini (OpenAI compat)",
    defaultModel: "gemini-2.5-flash",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    apiKeyEnvs: ["GOOGLE_API_KEY", "GEMINI_API_KEY", "REAHARNESS_API_KEY"],
    protocol: "openai_compat",
  },
  xai: {
    kind: "xai",
    label: "xAI",
    defaultModel: "grok-3",
    baseUrl: "https://api.x.ai/v1",
    apiKeyEnvs: ["XAI_API_KEY", "REAHARNESS_API_KEY"],
    protocol: "openai_compat",
  },
  anthropic: {
    kind: "anthropic",
    label: "Anthropic",
    defaultModel: "claude-sonnet-4-20250514",
    baseUrl: "https://api.anthropic.com",
    apiKeyEnvs: ["ANTHROPIC_API_KEY", "REAHARNESS_API_KEY"],
    protocol: "anthropic",
  },
  openai_compat: {
    kind: "openai_compat",
    label: "OpenAI-compatible",
    defaultModel: "gpt-4.1",
    apiKeyEnvs: ["OPENAI_API_KEY", "REAHARNESS_API_KEY"],
    protocol: "openai_compat",
  },
};

export const PROVIDER_KINDS = Object.keys(PROVIDER_PRESETS) as ProviderKind[];
