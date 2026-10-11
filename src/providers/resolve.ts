import { harnessError, type HarnessError } from "../domain/errors.js";
import { err, ok, type Result } from "../domain/result.js";
import { createAnthropicProvider } from "./anthropic.js";
import { createOpenAiCompatProvider } from "./openaiCompat.js";
import { PROVIDER_KINDS, PROVIDER_PRESETS } from "./presets.js";
import type { LlmProvider, ProviderConfig, ProviderKind } from "./types.js";

const firstEnv = (
  env: NodeJS.ProcessEnv,
  keys: readonly string[],
): string | undefined => {
  for (const key of keys) {
    const value = env[key];
    if (value && value.trim() !== "") return value;
  }
  return undefined;
};

const parseKind = (value: string | undefined): ProviderKind | undefined => {
  if (!value) return undefined;
  const normalized = value.trim().toLowerCase().replace(/-/g, "_");
  if ((PROVIDER_KINDS as string[]).includes(normalized)) {
    return normalized as ProviderKind;
  }
  if (normalized === "claude") return "anthropic";
  if (normalized === "gpt" || normalized === "chatgpt") return "openai";
  return undefined;
};

const detectKind = (env: NodeJS.ProcessEnv): ProviderKind => {
  const explicit = parseKind(
    env.REAHARNESS_PROVIDER ?? env.PROVIDER ?? env.LLM_PROVIDER,
  );
  if (explicit) return explicit;

  if (firstEnv(env, ["ANTHROPIC_API_KEY"])) return "anthropic";
  if (firstEnv(env, ["OPENROUTER_API_KEY"])) return "openrouter";
  if (firstEnv(env, ["GROQ_API_KEY"])) return "groq";
  if (firstEnv(env, ["XAI_API_KEY"])) return "xai";
  if (firstEnv(env, ["DEEPSEEK_API_KEY"])) return "deepseek";
  if (firstEnv(env, ["TOGETHER_API_KEY"])) return "together";
  if (firstEnv(env, ["FIREWORKS_API_KEY"])) return "fireworks";
  if (firstEnv(env, ["GOOGLE_API_KEY", "GEMINI_API_KEY"])) return "gemini";
  if (firstEnv(env, ["OPENAI_API_KEY"])) return "openai";
  if (env.OLLAMA_HOST || env.OLLAMA_API_BASE) return "ollama";
  return "openai";
};

export const resolveProviderConfig = (
  env: NodeJS.ProcessEnv = process.env,
  overrides: Partial<ProviderConfig> = {},
): Result<ProviderConfig, HarnessError> => {
  const kind = overrides.kind ?? detectKind(env);
  const preset = PROVIDER_PRESETS[kind];
  const apiKey =
    overrides.apiKey ?? firstEnv(env, [...preset.apiKeyEnvs, "API_KEY"]);
  const baseUrl =
    overrides.baseUrl ??
    env.REAHARNESS_BASE_URL ??
    env.OPENAI_BASE_URL ??
    env.ANTHROPIC_BASE_URL ??
    preset.baseUrl;
  const model =
    overrides.model ??
    env.REAHARNESS_MODEL ??
    env.MODEL ??
    env.LLM_MODEL ??
    preset.defaultModel;

  if (preset.protocol === "anthropic" && !apiKey) {
    return err(
      harnessError(
        "INVALID_INPUT",
        "Anthropic requires ANTHROPIC_API_KEY (or REAHARNESS_API_KEY)",
      ),
    );
  }

  if (kind !== "ollama" && preset.protocol === "openai_compat" && !apiKey) {
    return err(
      harnessError(
        "INVALID_INPUT",
        `${preset.label} requires one of: ${preset.apiKeyEnvs.join(", ")}`,
      ),
    );
  }

  if (kind === "openai_compat" && !baseUrl) {
    return err(
      harnessError(
        "INVALID_INPUT",
        "openai_compat requires --base-url or OPENAI_BASE_URL",
      ),
    );
  }

  return ok({
    kind,
    model,
    ...(apiKey !== undefined ? { apiKey } : {}),
    ...(baseUrl !== undefined ? { baseUrl } : {}),
  });
};

export const createProvider = (
  config: ProviderConfig,
): Result<LlmProvider, HarnessError> => {
  const preset = PROVIDER_PRESETS[config.kind];
  if (preset.protocol === "anthropic") {
    if (!config.apiKey) {
      return err(harnessError("INVALID_INPUT", "Missing Anthropic API key"));
    }
    return ok(
      createAnthropicProvider({
        apiKey: config.apiKey,
        ...(config.baseUrl !== undefined ? { baseUrl: config.baseUrl } : {}),
      }),
    );
  }

  const baseUrl = config.baseUrl ?? preset.baseUrl;
  if (!baseUrl) {
    return err(
      harnessError("INVALID_INPUT", "Missing OpenAI-compatible base URL"),
    );
  }

  return ok(
    createOpenAiCompatProvider({
      id: config.kind,
      baseUrl,
      ...(config.apiKey !== undefined ? { apiKey: config.apiKey } : {}),
    }),
  );
};

export const listProviders = () =>
  PROVIDER_KINDS.map((kind) => {
    const preset = PROVIDER_PRESETS[kind];
    return {
      kind,
      label: preset.label,
      protocol: preset.protocol,
      defaultModel: preset.defaultModel,
      baseUrl: preset.baseUrl,
      apiKeyEnvs: preset.apiKeyEnvs,
    };
  });
