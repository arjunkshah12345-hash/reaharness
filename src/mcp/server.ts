import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

import {
  createSession,
  dispatchTool,
  type HarnessSession,
} from "../application/dispatch.js";
import { buildToolCatalog } from "../composition/catalog.js";
import { TOOL_NAMES, type ToolName } from "../contracts/tools.js";
import type { ToolResult } from "../domain/toolResult.js";

const isToolName = (name: string): name is ToolName =>
  (TOOL_NAMES as readonly string[]).includes(name);

const formatToolResult = (result: ToolResult<unknown>) => ({
  content: [
    {
      type: "text" as const,
      text: JSON.stringify(result, null, 2),
    },
  ],
  isError: !result.ok,
});

export const createMcpServer = (session: HarnessSession): Server => {
  const catalog = buildToolCatalog();
  const server = new Server(
    {
      name: "reaharness",
      version: "0.1.0",
    },
    {
      capabilities: {
        tools: {},
      },
    },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: catalog.map((entry) => ({
      name: entry.name,
      description: entry.description,
      inputSchema: entry.inputSchema,
    })),
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const name = request.params.name;
    if (!isToolName(name)) {
      return formatToolResult({
        ok: false,
        error: {
          code: "INVALID_INPUT",
          message: `Unknown tool: ${name}`,
        },
        evidence: [],
        unknowns: [],
        limits: {},
      });
    }
    const result = await dispatchTool(
      session,
      name,
      request.params.arguments ?? {},
    );
    return formatToolResult(result);
  });

  return server;
};

export const startMcpStdio = async (
  workspaceRoot: string = process.cwd(),
): Promise<void> => {
  const session = createSession(workspaceRoot);
  const server = createMcpServer(session);
  const transport = new StdioServerTransport();
  await server.connect(transport);
};
