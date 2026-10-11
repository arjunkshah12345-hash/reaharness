import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { shellRun } from "../src/tools/shell.js";

describe("shell_run", () => {
  it("runs a command and returns stdout", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "reaharness-sh-"));
    const result = await shellRun(root, {
      command: "node -e console.log('ok')",
      cwd: ".",
      timeoutMs: 10_000,
      maxOutputBytes: 10_000,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.stdout.trim()).toBe("ok");
      expect(result.data.exitCode).toBe(0);
    }
  });

  it("times out long commands", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "reaharness-sh-"));
    const result = await shellRun(root, {
      command: "node -e setTimeout(()=>{},5000)",
      cwd: ".",
      timeoutMs: 200,
      maxOutputBytes: 10_000,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("TIMEOUT");
      expect(result.limits.timedOut).toBe(true);
    }
  });
});
