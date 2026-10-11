import {
  FsListInput,
  FsReadInput,
  FsWriteInput,
  GitCommitInput,
  GitDiffInput,
  GitStatusInput,
  SessionNoteInput,
  SessionRecallInput,
  ShellRunInput,
  type ToolName,
} from "../contracts/tools.js";
import { harnessError } from "../domain/errors.js";
import { toolFail, type ToolResult } from "../domain/toolResult.js";
import { fsList, fsRead, fsWrite } from "../tools/filesystem.js";
import { gitCommit, gitDiff, gitStatus } from "../tools/git.js";
import { sessionNote, sessionRecall } from "../tools/session.js";
import { shellRun } from "../tools/shell.js";

export type HarnessSession = {
  readonly workspaceRoot: string;
};

export const createSession = (workspaceRoot: string): HarnessSession => ({
  workspaceRoot,
});

export const dispatchTool = async (
  session: HarnessSession,
  name: ToolName,
  rawInput: unknown,
): Promise<ToolResult<unknown>> => {
  switch (name) {
    case "fs_read": {
      const parsed = FsReadInput.safeParse(rawInput);
      if (!parsed.success) {
        return toolFail(
          harnessError("INVALID_INPUT", parsed.error.message),
        );
      }
      return fsRead(session.workspaceRoot, parsed.data);
    }
    case "fs_write": {
      const parsed = FsWriteInput.safeParse(rawInput);
      if (!parsed.success) {
        return toolFail(
          harnessError("INVALID_INPUT", parsed.error.message),
        );
      }
      return fsWrite(session.workspaceRoot, parsed.data);
    }
    case "fs_list": {
      const parsed = FsListInput.safeParse(rawInput);
      if (!parsed.success) {
        return toolFail(
          harnessError("INVALID_INPUT", parsed.error.message),
        );
      }
      return fsList(session.workspaceRoot, parsed.data);
    }
    case "shell_run": {
      const parsed = ShellRunInput.safeParse(rawInput);
      if (!parsed.success) {
        return toolFail(
          harnessError("INVALID_INPUT", parsed.error.message),
        );
      }
      return shellRun(session.workspaceRoot, parsed.data);
    }
    case "git_status": {
      const parsed = GitStatusInput.safeParse(rawInput ?? {});
      if (!parsed.success) {
        return toolFail(
          harnessError("INVALID_INPUT", parsed.error.message),
        );
      }
      return gitStatus(session.workspaceRoot, parsed.data);
    }
    case "git_diff": {
      const parsed = GitDiffInput.safeParse(rawInput ?? {});
      if (!parsed.success) {
        return toolFail(
          harnessError("INVALID_INPUT", parsed.error.message),
        );
      }
      return gitDiff(session.workspaceRoot, parsed.data);
    }
    case "git_commit": {
      const parsed = GitCommitInput.safeParse(rawInput);
      if (!parsed.success) {
        return toolFail(
          harnessError("INVALID_INPUT", parsed.error.message),
        );
      }
      return gitCommit(session.workspaceRoot, parsed.data);
    }
    case "session_note": {
      const parsed = SessionNoteInput.safeParse(rawInput);
      if (!parsed.success) {
        return toolFail(
          harnessError("INVALID_INPUT", parsed.error.message),
        );
      }
      return sessionNote(session.workspaceRoot, parsed.data);
    }
    case "session_recall": {
      const parsed = SessionRecallInput.safeParse(rawInput);
      if (!parsed.success) {
        return toolFail(
          harnessError("INVALID_INPUT", parsed.error.message),
        );
      }
      return sessionRecall(session.workspaceRoot, parsed.data);
    }
    default: {
      const _exhaustive: never = name;
      return toolFail(
        harnessError("INVALID_INPUT", `Unknown tool: ${String(_exhaustive)}`),
      );
    }
  }
};
