import { z } from "zod";

export const FsReadInput = z.object({
  path: z.string().min(1),
  maxBytes: z.number().int().positive().max(2_000_000).optional().default(200_000),
});

export const FsWriteInput = z.object({
  path: z.string().min(1),
  content: z.string(),
  createParents: z.boolean().optional().default(true),
});

export const FsListInput = z.object({
  path: z.string().min(1).optional().default("."),
  maxEntries: z.number().int().positive().max(10_000).optional().default(500),
});

export const ShellRunInput = z.object({
  command: z.string().min(1),
  cwd: z.string().optional().default("."),
  timeoutMs: z.number().int().positive().max(600_000).optional().default(30_000),
  maxOutputBytes: z
    .number()
    .int()
    .positive()
    .max(2_000_000)
    .optional()
    .default(200_000),
});

export const GitStatusInput = z.object({}).strict();

export const GitDiffInput = z.object({
  staged: z.boolean().optional().default(false),
  maxBytes: z.number().int().positive().max(2_000_000).optional().default(200_000),
});

export const GitCommitInput = z.object({
  message: z.string().min(1),
  paths: z.array(z.string().min(1)).optional(),
  confirm: z.literal(true),
});

export const SessionNoteInput = z.object({
  text: z.string().min(1).max(20_000),
  tags: z.array(z.string().min(1).max(64)).max(20).optional().default([]),
});

export const SessionRecallInput = z.object({
  query: z.string().min(1).max(500),
  limit: z.number().int().positive().max(100).optional().default(10),
});

export type FsReadInput = z.infer<typeof FsReadInput>;
export type FsWriteInput = z.infer<typeof FsWriteInput>;
export type FsListInput = z.infer<typeof FsListInput>;
export type ShellRunInput = z.infer<typeof ShellRunInput>;
export type GitStatusInput = z.infer<typeof GitStatusInput>;
export type GitDiffInput = z.infer<typeof GitDiffInput>;
export type GitCommitInput = z.infer<typeof GitCommitInput>;
export type SessionNoteInput = z.infer<typeof SessionNoteInput>;
export type SessionRecallInput = z.infer<typeof SessionRecallInput>;

export const TOOL_NAMES = [
  "fs_read",
  "fs_write",
  "fs_list",
  "shell_run",
  "git_status",
  "git_diff",
  "git_commit",
  "session_note",
  "session_recall",
] as const;

export type ToolName = (typeof TOOL_NAMES)[number];
