import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { harnessError, type HarnessError } from "../domain/errors.js";
import { err, ok, type Result } from "../domain/result.js";
import type { SetupAction, SetupHost, SetupPlan } from "./hosts.js";

export type ApplyResult = {
  readonly applied: readonly string[];
  readonly backups: readonly string[];
};

const backupIfExists = async (filePath: string): Promise<string | null> => {
  try {
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const backupPath = `${filePath}.reaharness-backup-${stamp}`;
    await copyFile(filePath, backupPath);
    return backupPath;
  } catch {
    return null;
  }
};

const readJson = async (filePath: string): Promise<Record<string, unknown>> => {
  try {
    return JSON.parse(await readFile(filePath, "utf8")) as Record<
      string,
      unknown
    >;
  } catch {
    return {};
  }
};

const writeJson = async (
  filePath: string,
  value: Record<string, unknown>,
): Promise<void> => {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
};

const stdioServer = (command: string, args: string[]) => ({
  command,
  args,
});

const mergeMcpJson = async (
  filePath: string,
  command: string,
  args: string[],
  key: "mcpServers" | "servers" = "mcpServers",
): Promise<void> => {
  const existing = await readJson(filePath);
  const servers =
    typeof existing[key] === "object" && existing[key] !== null
      ? ({ ...(existing[key] as Record<string, unknown>) } as Record<
          string,
          unknown
        >)
      : {};
  servers.reaharness = stdioServer(command, args);
  await writeJson(filePath, { ...existing, [key]: servers });
};

const mergeCodexToml = async (
  filePath: string,
  command: string,
  args: string[],
): Promise<void> => {
  let existing = "";
  try {
    existing = await readFile(filePath, "utf8");
  } catch {
    existing = "";
  }
  const block = [
    "",
    "[mcp_servers.reaharness]",
    `command = ${JSON.stringify(command)}`,
    `args = ${JSON.stringify(args)}`,
    "",
  ].join("\n");
  const stripped = existing.replace(
    /\n?\[mcp_servers\.reaharness\][\s\S]*?(?=\n\[|$)/,
    "",
  );
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${stripped.trimEnd()}\n${block}`, "utf8");
};

const mergeGrokToml = mergeCodexToml;

const mergeOpenCode = async (
  filePath: string,
  command: string,
  args: string[],
): Promise<void> => {
  const existing = await readJson(filePath);
  const mcp =
    typeof existing.mcp === "object" && existing.mcp !== null
      ? ({ ...(existing.mcp as Record<string, unknown>) } as Record<
          string,
          unknown
        >)
      : {};
  mcp.reaharness = {
    type: "local",
    command: [command, ...args],
    enabled: true,
  };
  await writeJson(filePath, { ...existing, mcp });
};

const mergeGooseYaml = async (
  filePath: string,
  command: string,
  args: string[],
): Promise<void> => {
  let existing = "";
  try {
    existing = await readFile(filePath, "utf8");
  } catch {
    existing = "";
  }

  const block = [
    "",
    "extensions:",
    "  reaharness:",
    "    enabled: true",
    "    type: stdio",
    "    name: reaharness",
    `    cmd: ${command}`,
    "    args:",
    ...args.map((arg) => `      - ${JSON.stringify(arg)}`),
    "",
  ].join("\n");

  const stripped = existing.replace(
    /\nextensions:\n(?:[ \t]+.*\n)*/m,
    "\n",
  );
  // If file already has extensions, append/replace reaharness entry simply by rewriting a dedicated fragment.
  const withoutRea = stripped.replace(
    /\n[ \t]*reaharness:\n(?:[ \t]+.*\n)*/m,
    "\n",
  );

  let next = withoutRea.trimEnd();
  if (!/\nextensions:\s*$/m.test(next) && !/\nextensions:\n/m.test(next)) {
    next = `${next}${block}`;
  } else {
    const insert = [
      "  reaharness:",
      "    enabled: true",
      "    type: stdio",
      "    name: reaharness",
      `    cmd: ${command}`,
      "    args:",
      ...args.map((arg) => `      - ${JSON.stringify(arg)}`),
    ].join("\n");
    next = next.replace(/\nextensions:\n/, `\nextensions:\n${insert}\n`);
  }

  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${next.trimEnd()}\n`, "utf8");
};

const mergeGemini = async (
  filePath: string,
  command: string,
  args: string[],
): Promise<void> => {
  const existing = await readJson(filePath);
  const mcpServers =
    typeof existing.mcpServers === "object" && existing.mcpServers !== null
      ? ({ ...(existing.mcpServers as Record<string, unknown>) } as Record<
          string,
          unknown
        >)
      : {};
  mcpServers.reaharness = {
    command,
    args,
  };
  await writeJson(filePath, { ...existing, mcpServers });
};

const mergeContinue = async (
  filePath: string,
  command: string,
  args: string[],
): Promise<void> => {
  const existing = await readJson(filePath);
  const experimental =
    typeof existing.experimental === "object" && existing.experimental !== null
      ? ({ ...(existing.experimental as Record<string, unknown>) } as Record<
          string,
          unknown
        >)
      : {};
  const modelContextProtocolServers = Array.isArray(
    experimental.modelContextProtocolServers,
  )
    ? [...(experimental.modelContextProtocolServers as unknown[])]
    : [];

  const filtered = modelContextProtocolServers.filter((entry) => {
    if (!entry || typeof entry !== "object") return true;
    const transport = (entry as { transport?: { args?: unknown } }).transport;
    const transportArgs = transport?.args;
    if (!Array.isArray(transportArgs)) return true;
    return !transportArgs.some(
      (arg) => typeof arg === "string" && arg.includes("reaharness"),
    );
  });

  filtered.push({
    transport: {
      type: "stdio",
      command,
      args,
    },
  });

  experimental.modelContextProtocolServers = filtered;
  await writeJson(filePath, { ...existing, experimental });
};

const writeHostConfig = async (
  host: SetupHost,
  command: string,
  args: string[],
): Promise<void> => {
  switch (host.format) {
    case "mcp_json":
      await mergeMcpJson(host.configPath, command, args, "mcpServers");
      return;
    case "vscode_mcp":
      await mergeMcpJson(host.configPath, command, args, "servers");
      return;
    case "codex_toml":
      await mergeCodexToml(host.configPath, command, args);
      return;
    case "grok_toml":
      await mergeGrokToml(host.configPath, command, args);
      return;
    case "opencode_json":
      await mergeOpenCode(host.configPath, command, args);
      return;
    case "goose_yaml":
      await mergeGooseYaml(host.configPath, command, args);
      return;
    case "gemini_json":
      await mergeGemini(host.configPath, command, args);
      return;
    case "continue_json":
      await mergeContinue(host.configPath, command, args);
      return;
    default: {
      const _exhaustive: never = host.format;
      throw new Error(`Unsupported host format: ${String(_exhaustive)}`);
    }
  }
};

const applyMcpConfig = async (
  action: Extract<SetupAction, { kind: "write_mcp_config" }>,
  packageRoot: string,
): Promise<string | null> => {
  const command = "node";
  const entry = path.join(packageRoot, "bin", "reaharness.mjs");
  const args = [entry, "mcp"];
  const backup = action.exists ? await backupIfExists(action.host.configPath) : null;
  await writeHostConfig(action.host, command, args);
  return backup;
};

const applySkill = async (
  action: Extract<SetupAction, { kind: "install_skill" }>,
  packageRoot: string,
): Promise<string | null> => {
  const source = path.join(packageRoot, "skills", "agent-harness", "SKILL.md");
  const backup = action.exists ? await backupIfExists(action.path) : null;
  await mkdir(path.dirname(action.path), { recursive: true });
  const content = await readFile(source, "utf8");
  await writeFile(action.path, content, "utf8");
  return backup;
};

export const applySetupPlan = async (
  plan: SetupPlan,
): Promise<Result<ApplyResult, HarnessError>> => {
  const applied: string[] = [];
  const backups: string[] = [];

  try {
    for (const action of plan.actions) {
      if (action.kind === "write_mcp_config") {
        const backup = await applyMcpConfig(action, plan.packageRoot);
        if (backup) backups.push(backup);
        applied.push(`mcp:${action.host.id}:${action.host.configPath}`);
      } else {
        const backup = await applySkill(action, plan.packageRoot);
        if (backup) backups.push(backup);
        applied.push(`skill:${action.path}`);
      }
    }
    return ok({ applied, backups });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return err(harnessError("INTERNAL", message));
  }
};
