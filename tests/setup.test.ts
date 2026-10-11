import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { applySetupPlan } from "../src/setup/apply.js";
import { buildSetupPlan, parseHostIds } from "../src/setup/hosts.js";

const packageRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

describe("setup hosts", () => {
  it("parses default and all host lists", () => {
    expect(parseHostIds("default")).toContain("cursor");
    expect(parseHostIds("default")).toContain("opencode");
    expect(parseHostIds("all").length).toBeGreaterThanOrEqual(10);
  });

  it("builds a plan with mcp + skill actions", () => {
    const plan = buildSetupPlan("/tmp/ws", packageRoot, ["cursor", "opencode"]);
    expect(
      plan.actions.filter((action) => action.kind === "write_mcp_config"),
    ).toHaveLength(2);
    expect(plan.actions.some((action) => action.kind === "install_skill")).toBe(
      true,
    );
  });

  it("writes opencode and skill configs into a temp workspace host path", async () => {
    const workspace = await mkdtemp(path.join(tmpdir(), "reaharness-setup-"));
    const opencodePath = path.join(workspace, "opencode.json");
    const plan = {
      workspaceRoot: workspace,
      packageRoot,
      actions: [
        {
          kind: "write_mcp_config" as const,
          host: {
            id: "opencode" as const,
            label: "OpenCode",
            format: "opencode_json" as const,
            configPath: opencodePath,
          },
          exists: false,
        },
        {
          kind: "install_skill" as const,
          path: path.join(
            workspace,
            ".agents",
            "skills",
            "agent-harness",
            "SKILL.md",
          ),
          exists: false,
        },
      ],
    };
    const result = await applySetupPlan(plan);
    expect(result.ok).toBe(true);
    const opencode = JSON.parse(await readFile(opencodePath, "utf8")) as {
      mcp: { reaharness: { type: string; enabled: boolean } };
    };
    expect(opencode.mcp.reaharness.type).toBe("local");
    expect(opencode.mcp.reaharness.enabled).toBe(true);
    const skillAction = plan.actions[1];
    if (!skillAction || skillAction.kind !== "install_skill") {
      throw new Error("expected skill action");
    }
    const skill = await readFile(skillAction.path, "utf8");
    expect(skill).toContain("agent-harness");
  });
});
