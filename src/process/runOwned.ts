import { spawn } from "node:child_process";

import { harnessError, type HarnessError } from "../domain/errors.js";
import { err, ok, type Result } from "../domain/result.js";

export type OwnedProcessResult = {
  readonly exitCode: number | null;
  readonly signal: NodeJS.Signals | null;
  readonly stdout: string;
  readonly stderr: string;
  readonly timedOut: boolean;
  readonly truncated: boolean;
};

export type RunOwnedOptions = {
  readonly cwd: string;
  readonly timeoutMs: number;
  readonly maxOutputBytes: number;
  readonly env?: NodeJS.ProcessEnv;
};

const decodeBudget = (
  chunks: Buffer[],
  maxBytes: number,
): { text: string; truncated: boolean } => {
  const total = Buffer.concat(chunks);
  if (total.length <= maxBytes) {
    return { text: total.toString("utf8"), truncated: false };
  }
  return {
    text: total.subarray(0, maxBytes).toString("utf8"),
    truncated: true,
  };
};

/**
 * Run a command in an owned child process with deadline and output budgets.
 * Does not use a shell — argv is passed directly to spawn.
 */
export const runOwned = (
  file: string,
  args: readonly string[],
  options: RunOwnedOptions,
): Promise<Result<OwnedProcessResult, HarnessError>> =>
  new Promise((resolve) => {
    let settled = false;
    let timedOut = false;
    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];
    let stdoutBytes = 0;
    let stderrBytes = 0;

    const child = spawn(file, [...args], {
      cwd: options.cwd,
      env: options.env ?? process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });

    const finish = (result: Result<OwnedProcessResult, HarnessError>) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(result);
    };

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, options.timeoutMs);

    child.stdout?.on("data", (chunk: Buffer) => {
      if (stdoutBytes >= options.maxOutputBytes) return;
      const remaining = options.maxOutputBytes - stdoutBytes;
      const slice = chunk.subarray(0, remaining);
      stdoutChunks.push(slice);
      stdoutBytes += slice.length;
    });

    child.stderr?.on("data", (chunk: Buffer) => {
      if (stderrBytes >= options.maxOutputBytes) return;
      const remaining = options.maxOutputBytes - stderrBytes;
      const slice = chunk.subarray(0, remaining);
      stderrChunks.push(slice);
      stderrBytes += slice.length;
    });

    child.on("error", (error) => {
      finish(
        err(
          harnessError("PROCESS_FAILED", `Failed to spawn ${file}`, {
            reason: error.message,
          }),
        ),
      );
    });

    child.on("close", (exitCode, signal) => {
      const stdout = decodeBudget(stdoutChunks, options.maxOutputBytes);
      const stderr = decodeBudget(stderrChunks, options.maxOutputBytes);
      finish(
        ok({
          exitCode,
          signal,
          stdout: stdout.text,
          stderr: stderr.text,
          timedOut,
          truncated: stdout.truncated || stderr.truncated,
        }),
      );
    });
  });

/** Split a simple command string into argv without shell expansion. */
export const splitCommand = (
  command: string,
): Result<readonly string[], HarnessError> => {
  const parts = command.trim().match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g);
  if (!parts || parts.length === 0) {
    return err(harnessError("INVALID_INPUT", "Command is empty"));
  }
  const argv = parts.map((part) => {
    if (
      (part.startsWith('"') && part.endsWith('"')) ||
      (part.startsWith("'") && part.endsWith("'"))
    ) {
      return part.slice(1, -1);
    }
    return part;
  });
  return ok(argv);
};
