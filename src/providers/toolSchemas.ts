import { buildToolCatalog } from "../composition/catalog.js";
import type { ProviderTool } from "./types.js";

/** Provider-neutral tool defs used by both OpenAI-compat and Anthropic adapters. */
export const toProviderTools = (): readonly ProviderTool[] =>
  buildToolCatalog().map((entry) => ({
    name: entry.name,
    description: entry.description,
    parameters: entry.inputSchema,
  }));

/** OpenAI Chat Completions / Agents SDK style tools. */
export const toOpenAiTools = () =>
  toProviderTools().map((tool) => ({
    type: "function" as const,
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    },
  }));

/** Anthropic Messages API tools. */
export const toAnthropicTools = () =>
  toProviderTools().map((tool) => ({
    name: tool.name,
    description: tool.description,
    input_schema: tool.parameters,
  }));
