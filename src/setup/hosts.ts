import { existsSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";

export type HostFormat =
  | "mcp_json"
  | "vscode_mcp"
  | "codex_toml"
  | "opencode_json"
  | "goose_yaml"
  | "gemini_json"
  | "grok_toml"
  | "continue_json";

export type SetupHostId =
  | "cursor"
  | "claude"
  | "claude_desktop"
  | "codex"
  | "windsurf"
  | "vscode"
  | "cline"
  | "continue"
  | "gemini"
  | "opencode"
  | "goose"
  | "grok"
  | "copilot";

export type SetupHost = {
  readonly id: SetupHostId;
  readonly label: string;
  readonly format: HostFormat;
  readonly configPath: string;
};

const home = () => homedir();

const vscodeUserDir = () => {
  if (process.platform === "darwin") {
    return path.join(home(), "Library", "Application Support", "Code", "User");
  }
  if (process.platform === "win32") {
    return path.join(
      process.env.APPDATA ?? path.join(home(), "AppData", "Roaming"),
      "Code",
      "User",
    );
  }
  return path.join(
    process.env.XDG_CONFIG_HOME ?? path.join(home(), ".config"),
    "Code",
    "User",
  );
};

const claudeDesktopDir = () => {
  if (process.platform === "darwin") {
    return path.join(home(), "Library", "Application Support", "Claude");
  }
  if (process.platform === "win32") {
    return path.join(
      process.env.APPDATA ?? path.join(home(), "AppData", "Roaming"),
      "Claude",
    );
  }
  return path.join(
    process.env.XDG_CONFIG_HOME ?? path.join(home(), ".config"),
    "Claude",
  );
};

export const SETUP_HOSTS: Record<SetupHostId, Omit<SetupHost, "configPath"> & {
  readonly resolvePath: () => string;
}> = {
  cursor: {
    id: "cursor",
    label: "Cursor",
    format: "mcp_json",
    resolvePath: () => path.join(home(), ".cursor", "mcp.json"),
  },
  claude: {
    id: "claude",
    label: "Claude Code",
    format: "mcp_json",
    resolvePath: () =>
      process.env.CLAUDE_CONFIG_DIR
        ? path.join(process.env.CLAUDE_CONFIG_DIR, ".claude.json")
        : path.join(home(), ".claude.json"),
  },
  claude_desktop: {
    id: "claude_desktop",
    label: "Claude Desktop",
    format: "mcp_json",
    resolvePath: () => path.join(claudeDesktopDir(), "claude_desktop_config.json"),
  },
  codex: {
    id: "codex",
    label: "Codex",
    format: "codex_toml",
    resolvePath: () =>
      path.join(process.env.CODEX_HOME ?? path.join(home(), ".codex"), "config.toml"),
  },
  windsurf: {
    id: "windsurf",
    label: "Windsurf",
    format: "mcp_json",
    resolvePath: () => path.join(home(), ".codeium", "windsurf", "mcp_config.json"),
  },
  vscode: {
    id: "vscode",
    label: "VS Code",
    format: "vscode_mcp",
    resolvePath: () => path.join(vscodeUserDir(), "mcp.json"),
  },
  cline: {
    id: "cline",
    label: "Cline",
    format: "mcp_json",
    resolvePath: () =>
      path.join(home(), ".cline", "mcp_settings.json"),
  },
  continue: {
    id: "continue",
    label: "Continue",
    format: "continue_json",
    resolvePath: () => path.join(home(), ".continue", "config.json"),
  },
  gemini: {
    id: "gemini",
    label: "Gemini CLI",
    format: "gemini_json",
    resolvePath: () => path.join(home(), ".gemini", "settings.json"),
  },
  opencode: {
    id: "opencode",
    label: "OpenCode",
    format: "opencode_json",
    resolvePath: () =>
      path.join(
        process.env.OPENCODE_CONFIG_DIR ||
          path.join(
            process.env.XDG_CONFIG_HOME ?? path.join(home(), ".config"),
            "opencode",
          ),
        "opencode.json",
      ),
  },
  goose: {
    id: "goose",
    label: "Goose",
    format: "goose_yaml",
    resolvePath: () => path.join(home(), ".config", "goose", "config.yaml"),
  },
  grok: {
    id: "grok",
    label: "Grok",
    format: "grok_toml",
    resolvePath: () =>
      path.join(process.env.GROK_HOME ?? path.join(home(), ".grok"), "config.toml"),
  },
  copilot: {
    id: "copilot",
    label: "GitHub Copilot CLI",
    format: "mcp_json",
    resolvePath: () =>
      path.join(
        process.env.COPILOT_HOME ?? path.join(home(), ".copilot"),
        "mcp-config.json",
      ),
  },
};

export const SETUP_HOST_IDS = Object.keys(SETUP_HOSTS) as SetupHostId[];

export const resolveHost = (id: SetupHostId): SetupHost => {
  const def = SETUP_HOSTS[id];
  return {
    id: def.id,
    label: def.label,
    format: def.format,
    configPath: def.resolvePath(),
  };
};

export const parseHostIds = (value: string | undefined): SetupHostId[] => {
  if (!value || value === "all") return [...SETUP_HOST_IDS];
  if (value === "default") {
    return ["cursor", "claude", "codex", "opencode", "vscode"];
  }
  return value
    .split(",")
    .map((part) => part.trim())
    .filter((part): part is SetupHostId =>
      (SETUP_HOST_IDS as string[]).includes(part),
    );
};

export type SetupAction =
  | {
      readonly kind: "write_mcp_config";
      readonly host: SetupHost;
      readonly exists: boolean;
    }
  | {
      readonly kind: "install_skill";
      readonly path: string;
      readonly exists: boolean;
    };

export type SetupPlan = {
  readonly workspaceRoot: string;
  readonly packageRoot: string;
  readonly actions: readonly SetupAction[];
};

export const buildSetupPlan = (
  workspaceRoot: string,
  packageRoot: string,
  hostIds: readonly SetupHostId[],
): SetupPlan => {
  const actions: SetupAction[] = hostIds.map((id) => {
    const host = resolveHost(id);
    return {
      kind: "write_mcp_config" as const,
      host,
      exists: existsSync(host.configPath),
    };
  });

  const skillPath = path.join(
    workspaceRoot,
    ".agents",
    "skills",
    "agent-harness",
    "SKILL.md",
  );
  actions.push({
    kind: "install_skill",
    path: skillPath,
    exists: existsSync(skillPath),
  });

  return { workspaceRoot, packageRoot, actions };
};
