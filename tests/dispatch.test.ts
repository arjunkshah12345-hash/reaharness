import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { createSession, dispatchTool } from "../src/application/dispatch.js";
import { buildToolCatalog } from "../src/composition/catalog.js";

describe("dispatch + catalog", () => {
  it("advertises the full tool catalog", () => {
    const catalog = buildToolCatalog();
    expect(catalog.map((entry) => entry.name)).toEqual([
      "fs_read",
      "fs_write",
      "fs_list",
      "shell_run",
      "git_status",
      "git_diff",
      "git_commit",
      "session_note",
      "session_recall",
    ]);
    for (const entry of catalog) {
      expect(entry.inputSchema).toMatchObject({ type: "object" });
      expect(entry.description.length).toBeGreaterThan(10);
    }
  });

  it("round-trips session notes", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "reaharness-sess-"));
    const session = createSession(root);
    const note = await dispatchTool(session, "session_note", {
      text: "remember the workspace root",
      tags: ["meta"],
    });
    expect(note.ok).toBe(true);

    const recall = await dispatchTool(session, "session_recall", {
      query: "workspace",
      limit: 5,
    });
    expect(recall.ok).toBe(true);
    if (recall.ok) {
      const data = recall.data as {
        matches: Array<{ text: string }>;
      };
      expect(data.matches.length).toBe(1);
      expect(data.matches[0]?.text).toContain("workspace root");
    }
  });
});
