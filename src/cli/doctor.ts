import { access } from "node:fs/promises";
import path from "node:path";

import { createSession, dispatchTool } from "../application/dispatch.js";
import { buildToolCatalog } from "../composition/catalog.js";

export type DoctorCheck = {
  readonly name: string;
  readonly ok: boolean;
  readonly detail: string;
};

export const runDoctor = async (
  workspaceRoot: string,
  packageRoot: string,
): Promise<readonly DoctorCheck[]> => {
  const checks: DoctorCheck[] = [];
  const major = Number(process.versions.node.split(".")[0] ?? 0);
  checks.push({
    name: "node_version",
    ok: major >= 22,
    detail: `Node ${process.version} (need >=22)`,
  });

  const entry = path.join(packageRoot, "bin", "reaharness.mjs");
  try {
    await access(entry);
    checks.push({ name: "bin_entry", ok: true, detail: entry });
  } catch {
    checks.push({ name: "bin_entry", ok: false, detail: `Missing ${entry}` });
  }

  const skill = path.join(packageRoot, "skills", "agent-harness", "SKILL.md");
  try {
    await access(skill);
    checks.push({ name: "skill_packaged", ok: true, detail: skill });
  } catch {
    checks.push({ name: "skill_packaged", ok: false, detail: `Missing ${skill}` });
  }

  const catalog = buildToolCatalog();
  checks.push({
    name: "tool_catalog",
    ok: catalog.length >= 9,
    detail: `${catalog.length} tools advertised`,
  });

  const session = createSession(workspaceRoot);
  const list = await dispatchTool(session, "fs_list", { path: ".", maxEntries: 5 });
  const entryCount =
    list.ok &&
    typeof list.data === "object" &&
    list.data !== null &&
    "entries" in list.data &&
    Array.isArray((list.data as { entries: unknown }).entries)
      ? (list.data as { entries: unknown[] }).entries.length
      : null;
  checks.push({
    name: "fs_list_smoke",
    ok: list.ok && entryCount !== null,
    detail: list.ok
      ? `Listed ${entryCount ?? 0} entries`
      : list.error.message,
  });

  return checks;
};
