import { TOOL_NAMES, type ToolName } from "../contracts/tools.js";
import { zodToJsonSchema } from "./zodSchema.js";
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
} from "../contracts/tools.js";

export type ToolCatalogEntry = {
  readonly name: ToolName;
  readonly description: string;
  readonly inputSchema: Record<string, unknown>;
};

const schemas = {
  fs_read: FsReadInput,
  fs_write: FsWriteInput,
  fs_list: FsListInput,
  shell_run: ShellRunInput,
  git_status: GitStatusInput,
  git_diff: GitDiffInput,
  git_commit: GitCommitInput,
  session_note: SessionNoteInput,
  session_recall: SessionRecallInput,
} as const;

const descriptions: Record<ToolName, string> = {
  fs_read: "Read a UTF-8 file inside the workspace root with a byte budget.",
  fs_write: "Write a UTF-8 file inside the workspace root.",
  fs_list: "List directory entries inside the workspace root.",
  shell_run:
    "Run a command without a shell, with cwd admission, timeout, and output budgets.",
  git_status: "Show porcelain git status and current branch.",
  git_diff: "Show staged or unstaged git diff with a byte budget.",
  git_commit: "Create a git commit. Requires confirm=true.",
  session_note: "Append a note to local session memory under .reaharness/.",
  session_recall: "Search local session memory by substring.",
};

export const buildToolCatalog = (): readonly ToolCatalogEntry[] =>
  TOOL_NAMES.map((name) => ({
    name,
    description: descriptions[name],
    inputSchema: zodToJsonSchema(schemas[name]),
  }));
