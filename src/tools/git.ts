import type {
  GitCommitInput,
  GitDiffInput,
  GitStatusInput,
} from "../contracts/tools.js";
import { observation, unknown } from "../domain/evidence.js";
import { harnessError } from "../domain/errors.js";
import { toolFail, toolOk, type ToolResult } from "../domain/toolResult.js";
import { runOwned } from "../process/runOwned.js";

const runGit = async (
  workspaceRoot: string,
  args: readonly string[],
  maxOutputBytes = 200_000,
) =>
  runOwned("git", args, {
    cwd: workspaceRoot,
    timeoutMs: 30_000,
    maxOutputBytes,
  });

export type GitStatusData = {
  readonly porcelain: string;
  readonly branch: string | null;
};

export type GitDiffData = {
  readonly staged: boolean;
  readonly diff: string;
};

export type GitCommitData = {
  readonly message: string;
  readonly stdout: string;
};

export const gitStatus = async (
  workspaceRoot: string,
  _input: GitStatusInput,
): Promise<ToolResult<GitStatusData>> => {
  const status = await runGit(workspaceRoot, ["status", "--porcelain=v1"]);
  if (!status.ok) return toolFail(status.error);
  if (status.value.exitCode !== 0) {
    return toolFail(
      harnessError("GIT_FAILED", status.value.stderr || "git status failed"),
    );
  }

  const branch = await runGit(workspaceRoot, [
    "rev-parse",
    "--abbrev-ref",
    "HEAD",
  ]);
  const branchName =
    branch.ok && branch.value.exitCode === 0
      ? branch.value.stdout.trim()
      : null;

  return toolOk(
    {
      porcelain: status.value.stdout,
      branch: branchName,
    },
    {
      evidence: [
        observation(
          "git_status",
          `branch=${branchName ?? "unknown"}`,
          workspaceRoot,
        ),
      ],
      unknowns:
        branchName === null
          ? [unknown("BRANCH", "Could not resolve current branch")]
          : [],
      limits: { truncated: status.value.truncated },
    },
  );
};

export const gitDiff = async (
  workspaceRoot: string,
  input: GitDiffInput,
): Promise<ToolResult<GitDiffData>> => {
  const args = input.staged ? (["diff", "--staged"] as const) : (["diff"] as const);
  const result = await runGit(workspaceRoot, args, input.maxBytes);
  if (!result.ok) return toolFail(result.error);
  if (result.value.exitCode !== 0) {
    return toolFail(
      harnessError("GIT_FAILED", result.value.stderr || "git diff failed"),
    );
  }

  return toolOk(
    { staged: input.staged, diff: result.value.stdout },
    {
      evidence: [
        observation(
          "git_diff",
          input.staged ? "Read staged diff" : "Read unstaged diff",
        ),
      ],
      unknowns: result.value.truncated
        ? [unknown("TRUNCATED", `Diff truncated at maxBytes=${input.maxBytes}`)]
        : [],
      limits: { truncated: result.value.truncated, maxBytes: input.maxBytes },
    },
  );
};

export const gitCommit = async (
  workspaceRoot: string,
  input: GitCommitInput,
): Promise<ToolResult<GitCommitData>> => {
  if (input.confirm !== true) {
    return toolFail(
      harnessError(
        "INVALID_INPUT",
        "git_commit requires confirm=true to write a commit",
      ),
    );
  }

  if (input.paths && input.paths.length > 0) {
    const add = await runGit(workspaceRoot, ["add", "--", ...input.paths]);
    if (!add.ok) return toolFail(add.error);
    if (add.value.exitCode !== 0) {
      return toolFail(
        harnessError("GIT_FAILED", add.value.stderr || "git add failed"),
      );
    }
  }

  const commit = await runGit(workspaceRoot, [
    "commit",
    "-m",
    input.message,
  ]);
  if (!commit.ok) return toolFail(commit.error);
  if (commit.value.exitCode !== 0) {
    return toolFail(
      harnessError("GIT_FAILED", commit.value.stderr || "git commit failed"),
    );
  }

  return toolOk(
    { message: input.message, stdout: commit.value.stdout.trim() },
    {
      evidence: [
        observation("git_commit", `Created commit: ${input.message}`),
      ],
    },
  );
};
