import path from "node:path";
import { fileURLToPath } from "node:url";

import { runAgent } from "../agent/loop.js";
import { createSession, dispatchTool } from "../application/dispatch.js";
import { TOOL_NAMES, type ToolName } from "../contracts/tools.js";
import { startMcpStdio } from "../mcp/server.js";
import {
  createProvider,
  listProviders,
  resolveProviderConfig,
  toAnthropicTools,
  toOpenAiTools,
  type ProviderKind,
} from "../providers/index.js";
import { PROVIDER_KINDS } from "../providers/presets.js";
import { applySetupPlan } from "../setup/apply.js";
import {
  buildSetupPlan,
  parseHostIds,
  SETUP_HOST_IDS,
} from "../setup/hosts.js";
import { runDoctor } from "./doctor.js";

const packageRootFromHere = () =>
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

const printHelp = (): void => {
  console.log(`reaharness — clean multi-provider agent harness

Usage:
  reaharness mcp                      Start MCP stdio server
  reaharness setup [--yes] [--clients=default|all|cursor,opencode,...]
  reaharness doctor                   Health checks
  reaharness providers                List LLM providers
  reaharness catalog [--format=json|openai|anthropic]
  reaharness agent "<prompt>" [options]
  reaharness run <tool> --json '<args>'
  reaharness help

Agent options:
  --provider=<kind>   ${PROVIDER_KINDS.join(" | ")}
  --model=<id>        Model id
  --base-url=<url>    OpenAI-compatible base URL
  --max-turns=<n>     Default 20
  --json              Print full run JSON

MCP hosts: ${SETUP_HOST_IDS.join(", ")}
Tools: ${TOOL_NAMES.join(", ")}
`);
};

const isToolName = (name: string): name is ToolName =>
  (TOOL_NAMES as readonly string[]).includes(name);

const flagValue = (
  args: readonly string[],
  name: string,
): string | undefined => {
  const match = args.find((arg) => arg.startsWith(`${name}=`));
  return match?.slice(name.length + 1);
};

const hasFlag = (args: readonly string[], name: string): boolean =>
  args.includes(name);

export const runCli = async (argv: readonly string[]): Promise<number> => {
  const [command = "help", ...rest] = argv;
  const workspaceRoot = process.cwd();
  const packageRoot = packageRootFromHere();

  if (command === "help" || command === "--help" || command === "-h") {
    printHelp();
    return 0;
  }

  if (command === "mcp") {
    await startMcpStdio(workspaceRoot);
    return 0;
  }

  if (command === "providers") {
    console.log(JSON.stringify(listProviders(), null, 2));
    return 0;
  }

  if (command === "catalog") {
    const format = flagValue(rest, "--format") ?? "json";
    if (format === "openai") {
      console.log(JSON.stringify(toOpenAiTools(), null, 2));
      return 0;
    }
    if (format === "anthropic") {
      console.log(JSON.stringify(toAnthropicTools(), null, 2));
      return 0;
    }
    const { buildToolCatalog } = await import("../composition/catalog.js");
    console.log(JSON.stringify(buildToolCatalog(), null, 2));
    return 0;
  }

  if (command === "doctor") {
    const checks = await runDoctor(workspaceRoot, packageRoot);
    for (const check of checks) {
      const mark = check.ok ? "ok" : "FAIL";
      console.log(`[${mark}] ${check.name}: ${check.detail}`);
    }
    return checks.every((check) => check.ok) ? 0 : 1;
  }

  if (command === "setup") {
    const yes = hasFlag(rest, "--yes") || hasFlag(rest, "-y");
    const clients =
      flagValue(rest, "--clients") ?? flagValue(rest, "--hosts") ?? "default";
    const hostIds = parseHostIds(clients);
    if (hostIds.length === 0) {
      console.error(
        `No valid hosts. Use: default | all | ${SETUP_HOST_IDS.join(",")}`,
      );
      return 1;
    }
    const plan = buildSetupPlan(workspaceRoot, packageRoot, hostIds);

    console.log("Setup plan:");
    for (const action of plan.actions) {
      if (action.kind === "write_mcp_config") {
        console.log(
          `- ${action.host.label} (${action.host.format}): ${action.host.configPath} (${action.exists ? "update" : "create"})`,
        );
      } else {
        console.log(
          `- Skill: ${action.path} (${action.exists ? "update" : "create"})`,
        );
      }
    }

    if (!yes) {
      console.log("\nRe-run with --yes to apply.");
      return 0;
    }

    const applied = await applySetupPlan(plan);
    if (!applied.ok) {
      console.error(applied.error.message);
      return 1;
    }
    console.log("Applied:");
    for (const item of applied.value.applied) console.log(`- ${item}`);
    if (applied.value.backups.length > 0) {
      console.log("Backups:");
      for (const item of applied.value.backups) console.log(`- ${item}`);
    }
    console.log("Restart your agent after setup.");
    return 0;
  }

  if (command === "agent" || command === "chat") {
    const promptParts = rest.filter((arg) => !arg.startsWith("--"));
    const prompt = promptParts.join(" ").trim();
    if (!prompt) {
      console.error('Usage: reaharness agent "<prompt>" [--provider=...]');
      return 1;
    }

    const providerKind = flagValue(rest, "--provider") as
      | ProviderKind
      | undefined;
    const model = flagValue(rest, "--model");
    const baseUrl = flagValue(rest, "--base-url");
    const maxTurns = Number(flagValue(rest, "--max-turns") ?? "20");
    const asJson = hasFlag(rest, "--json");

    const config = resolveProviderConfig(process.env, {
      ...(providerKind ? { kind: providerKind } : {}),
      ...(model ? { model } : {}),
      ...(baseUrl ? { baseUrl } : {}),
    });
    if (!config.ok) {
      console.error(config.error.message);
      return 1;
    }

    const provider = createProvider(config.value);
    if (!provider.ok) {
      console.error(provider.error.message);
      return 1;
    }

    if (!asJson) {
      console.error(
        `provider=${config.value.kind} model=${config.value.model}`,
      );
    }

    try {
      const result = await runAgent({
        workspaceRoot,
        provider: provider.value,
        model: config.value.model,
        prompt,
        maxTurns: Number.isFinite(maxTurns) ? maxTurns : 20,
        ...(!asJson
          ? {
              onTurn: (turn: import("../agent/loop.js").AgentTurn) => {
                const calls = turn.assistant.toolCalls ?? [];
                if (calls.length > 0) {
                  console.error(
                    `turn ${turn.index}: tools ${calls.map((call) => call.name).join(", ")}`,
                  );
                } else if (turn.assistant.content) {
                  console.error(`turn ${turn.index}: reply`);
                }
              },
            }
          : {}),
      });

      if (asJson) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.log(result.finalText);
        if (result.stopReason === "max_turns") {
          console.error("(stopped: max turns)");
        }
      }
      return 0;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(message);
      return 1;
    }
  }

  if (command === "run") {
    const tool = rest[0];
    if (!tool || !isToolName(tool)) {
      console.error(
        `Unknown or missing tool. Expected one of: ${TOOL_NAMES.join(", ")}`,
      );
      return 1;
    }
    const jsonFlag = rest.indexOf("--json");
    const raw =
      jsonFlag >= 0 && rest[jsonFlag + 1] ? rest[jsonFlag + 1]! : "{}";
    let args: unknown = {};
    try {
      args = JSON.parse(raw);
    } catch {
      console.error("Invalid JSON after --json");
      return 1;
    }
    const session = createSession(workspaceRoot);
    const result = await dispatchTool(session, tool, args);
    console.log(JSON.stringify(result, null, 2));
    return result.ok ? 0 : 1;
  }

  console.error(`Unknown command: ${command}`);
  printHelp();
  return 1;
};
