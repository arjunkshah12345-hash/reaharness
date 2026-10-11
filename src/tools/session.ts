import { appendFile, mkdir, readFile } from "node:fs/promises";
import path from "node:path";

import type { SessionNoteInput, SessionRecallInput } from "../contracts/tools.js";
import { observation } from "../domain/evidence.js";
import { harnessError } from "../domain/errors.js";
import { toolFail, toolOk, type ToolResult } from "../domain/toolResult.js";

export type SessionNote = {
  readonly id: string;
  readonly at: string;
  readonly text: string;
  readonly tags: readonly string[];
};

export type SessionNoteData = {
  readonly note: SessionNote;
};

export type SessionRecallData = {
  readonly matches: readonly SessionNote[];
};

const memoryDir = (workspaceRoot: string) =>
  path.join(workspaceRoot, ".reaharness");

const memoryFile = (workspaceRoot: string) =>
  path.join(memoryDir(workspaceRoot), "session.jsonl");

export const sessionNote = async (
  workspaceRoot: string,
  input: SessionNoteInput,
): Promise<ToolResult<SessionNoteData>> => {
  const note: SessionNote = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    at: new Date().toISOString(),
    text: input.text,
    tags: input.tags,
  };

  try {
    await mkdir(memoryDir(workspaceRoot), { recursive: true });
    await appendFile(memoryFile(workspaceRoot), `${JSON.stringify(note)}\n`, "utf8");
    return toolOk(
      { note },
      {
        evidence: [
          observation("session_note", `Stored note ${note.id}`, ".reaharness/session.jsonl"),
        ],
      },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return toolFail(harnessError("INTERNAL", message));
  }
};

export const sessionRecall = async (
  workspaceRoot: string,
  input: SessionRecallInput,
): Promise<ToolResult<SessionRecallData>> => {
  try {
    const raw = await readFile(memoryFile(workspaceRoot), "utf8");
    const notes: SessionNote[] = [];
    for (const line of raw.split("\n")) {
      if (!line.trim()) continue;
      try {
        notes.push(JSON.parse(line) as SessionNote);
      } catch {
        // skip malformed lines
      }
    }

    const query = input.query.toLowerCase();
    const matches = notes
      .filter(
        (note) =>
          note.text.toLowerCase().includes(query) ||
          note.tags.some((tag) => tag.toLowerCase().includes(query)),
      )
      .slice(-input.limit)
      .reverse();

    return toolOk(
      { matches },
      {
        evidence: [
          observation(
            "session_recall",
            `Found ${matches.length} notes matching "${input.query}"`,
            ".reaharness/session.jsonl",
          ),
        ],
      },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("ENOENT")) {
      return toolOk(
        { matches: [] },
        {
          evidence: [
            observation(
              "session_recall",
              "No session memory file yet",
              ".reaharness/session.jsonl",
            ),
          ],
        },
      );
    }
    return toolFail(harnessError("INTERNAL", message));
  }
};
