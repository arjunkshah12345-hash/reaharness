import type { ShellRunInput } from "../contracts/tools.js";
import { observation, unknown } from "../domain/evidence.js";
import { harnessError } from "../domain/errors.js";
import { admitPath } from "../domain/paths.js";
import { toolFail, toolOk, type ToolResult } from "../domain/toolResult.js";
import { runOwned, splitCommand } from "../process/runOwned.js";

export type ShellRunData = {
  readonly command: string;
  readonly cwd: string;
  readonly exitCode: number | null;
  readonly signal: string | null;
  readonly stdout: string;
  readonly stderr: string;
};

export const shellRun = async (
  workspaceRoot: string,
  input: ShellRunInput,
): Promise<ToolResult<ShellRunData>> => {
  const cwd = admitPath(workspaceRoot, input.cwd);
  if (!cwd.ok) return toolFail(cwd.error);

  const argv = splitCommand(input.command);
  if (!argv.ok) return toolFail(argv.error);

  const [file, ...args] = argv.value;
  if (!file) {
    return toolFail(harnessError("INVALID_INPUT", "Command is empty"));
  }

  const result = await runOwned(file, args, {
    cwd: cwd.value.absolute,
    timeoutMs: input.timeoutMs,
    maxOutputBytes: input.maxOutputBytes,
  });

  if (!result.ok) return toolFail(result.error);

  const data: ShellRunData = {
    command: input.command,
    cwd: cwd.value.relative,
    exitCode: result.value.exitCode,
    signal: result.value.signal,
    stdout: result.value.stdout,
    stderr: result.value.stderr,
  };

  if (result.value.timedOut) {
    return toolFail(
      harnessError("TIMEOUT", `Command timed out after ${input.timeoutMs}ms`, {
        command: input.command,
      }),
      {
        evidence: [
          observation("shell_run", `Timed out: ${input.command}`, cwd.value.relative),
        ],
        unknowns: [
          unknown("TIMEOUT", "Process was killed after deadline", input.command),
        ],
        limits: { timedOut: true, truncated: result.value.truncated },
      },
    );
  }

  return toolOk(data, {
    evidence: [
      observation(
        "shell_run",
        `exit=${result.value.exitCode ?? "null"} command=${input.command}`,
        cwd.value.relative,
      ),
    ],
    unknowns: result.value.truncated
      ? [unknown("TRUNCATED", "stdout/stderr hit maxOutputBytes", input.command)]
      : [],
    limits: {
      truncated: result.value.truncated,
      maxBytes: input.maxOutputBytes,
    },
  });
};
