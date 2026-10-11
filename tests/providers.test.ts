import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

import { runAgent } from "../src/agent/loop.js";
import { createOpenAiCompatProvider } from "../src/providers/openaiCompat.js";
import { listProviders, resolveProviderConfig } from "../src/providers/resolve.js";
import { toAnthropicTools, toOpenAiTools } from "../src/providers/toolSchemas.js";
import type { LlmProvider } from "../src/providers/types.js";

describe("providers", () => {
  it("lists first-class provider presets", () => {
    const kinds = listProviders().map((provider) => provider.kind);
    expect(kinds).toContain("openai");
    expect(kinds).toContain("anthropic");
    expect(kinds).toContain("openrouter");
    expect(kinds).toContain("ollama");
    expect(kinds).toContain("gemini");
  });

  it("resolves anthropic from env", () => {
    const config = resolveProviderConfig({
      ANTHROPIC_API_KEY: "sk-test",
    });
    expect(config.ok).toBe(true);
    if (config.ok) {
      expect(config.value.kind).toBe("anthropic");
      expect(config.value.apiKey).toBe("sk-test");
    }
  });

  it("exports openai and anthropic tool catalogs", () => {
    const openai = toOpenAiTools();
    const anthropic = toAnthropicTools();
    expect(openai[0]?.type).toBe("function");
    expect(anthropic[0]?.input_schema).toBeTruthy();
    expect(openai.length).toBe(anthropic.length);
  });

  it("parses openai-compatible tool calls", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          model: "mock",
          choices: [
            {
              finish_reason: "tool_calls",
              message: {
                role: "assistant",
                content: null,
                tool_calls: [
                  {
                    id: "1",
                    type: "function",
                    function: {
                      name: "fs_list",
                      arguments: JSON.stringify({ path: ".", maxEntries: 3 }),
                    },
                  },
                ],
              },
            },
          ],
        }),
        { status: 200 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const provider = createOpenAiCompatProvider({
      id: "openai",
      apiKey: "test",
      baseUrl: "https://example.test/v1",
    });
    const result = await provider.complete({
      model: "mock",
      messages: [{ role: "user", content: "list files" }],
      tools: [
        {
          name: "fs_list",
          description: "list",
          parameters: { type: "object" },
        },
      ],
    });
    expect(result.finishReason).toBe("tool_calls");
    expect(result.message.toolCalls?.[0]?.name).toBe("fs_list");
    vi.unstubAllGlobals();
  });
});

describe("agent loop", () => {
  it("executes tools then returns final text", async () => {
    let turn = 0;
    const provider: LlmProvider = {
      id: "mock",
      complete: async () => {
        turn += 1;
        if (turn === 1) {
          return {
            message: {
              role: "assistant",
              content: null,
              toolCalls: [
                {
                  id: "c1",
                  name: "session_note",
                  arguments: JSON.stringify({
                    text: "loop works",
                    tags: ["test"],
                  }),
                },
              ],
            },
            finishReason: "tool_calls",
            provider: "mock",
            model: "mock",
          };
        }
        return {
          message: {
            role: "assistant",
            content: "noted",
          },
          finishReason: "stop",
          provider: "mock",
          model: "mock",
        };
      },
    };

    const root = await mkdtemp(path.join(tmpdir(), "reaharness-agent-"));

    const result = await runAgent({
      workspaceRoot: root,
      provider,
      model: "mock",
      prompt: "remember that the loop works",
      maxTurns: 5,
    });

    expect(result.stopReason).toBe("completed");
    expect(result.finalText).toBe("noted");
    expect(result.turns[0]?.toolResults[0]?.name).toBe("session_note");
  });
});
