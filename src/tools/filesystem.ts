import { mkdir, readFile, readdir, writeFile, stat } from "node:fs/promises";
import path from "node:path";

import type { FsListInput, FsReadInput, FsWriteInput } from "../contracts/tools.js";
import { observation, unknown } from "../domain/evidence.js";
import { harnessError } from "../domain/errors.js";
import { admitPath } from "../domain/paths.js";
import { toolFail, toolOk, type ToolResult } from "../domain/toolResult.js";

export type FsReadData = {
  readonly path: string;
  readonly content: string;
  readonly bytes: number;
};

export type FsWriteData = {
  readonly path: string;
  readonly bytesWritten: number;
};

export type FsListEntry = {
  readonly name: string;
  readonly path: string;
  readonly kind: "file" | "directory" | "other";
};

export type FsListData = {
  readonly path: string;
  readonly entries: readonly FsListEntry[];
};

export const fsRead = async (
  workspaceRoot: string,
  input: FsReadInput,
): Promise<ToolResult<FsReadData>> => {
  const admitted = admitPath(workspaceRoot, input.path);
  if (!admitted.ok) return toolFail(admitted.error);

  try {
    const buffer = await readFile(admitted.value.absolute);
    const truncated = buffer.length > input.maxBytes;
    const content = buffer.subarray(0, input.maxBytes).toString("utf8");
    return toolOk(
      {
        path: admitted.value.relative,
        content,
        bytes: content.length,
      },
      {
        evidence: [
          observation(
            "fs_read",
            truncated
              ? `Read first ${input.maxBytes} bytes of ${admitted.value.relative}`
              : `Read ${buffer.length} bytes from ${admitted.value.relative}`,
            admitted.value.relative,
          ),
        ],
        unknowns: truncated
          ? [
              unknown(
                "TRUNCATED",
                `File larger than maxBytes=${input.maxBytes}`,
                admitted.value.relative,
              ),
            ]
          : [],
        limits: { truncated, maxBytes: input.maxBytes },
      },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("ENOENT")) {
      return toolFail(
        harnessError("NOT_FOUND", `File not found: ${admitted.value.relative}`),
      );
    }
    if (message.includes("EACCES") || message.includes("EPERM")) {
      return toolFail(
        harnessError("PERMISSION", `Cannot read: ${admitted.value.relative}`),
      );
    }
    return toolFail(harnessError("INTERNAL", message));
  }
};

export const fsWrite = async (
  workspaceRoot: string,
  input: FsWriteInput,
): Promise<ToolResult<FsWriteData>> => {
  const admitted = admitPath(workspaceRoot, input.path);
  if (!admitted.ok) return toolFail(admitted.error);

  try {
    if (input.createParents) {
      await mkdir(path.dirname(admitted.value.absolute), { recursive: true });
    }
    const data = Buffer.from(input.content, "utf8");
    await writeFile(admitted.value.absolute, data);
    return toolOk(
      {
        path: admitted.value.relative,
        bytesWritten: data.length,
      },
      {
        evidence: [
          observation(
            "fs_write",
            `Wrote ${data.length} bytes to ${admitted.value.relative}`,
            admitted.value.relative,
          ),
        ],
      },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return toolFail(harnessError("INTERNAL", message));
  }
};

export const fsList = async (
  workspaceRoot: string,
  input: FsListInput,
): Promise<ToolResult<FsListData>> => {
  const admitted = admitPath(workspaceRoot, input.path);
  if (!admitted.ok) return toolFail(admitted.error);

  try {
    const names = await readdir(admitted.value.absolute);
    const sliced = names.slice(0, input.maxEntries);
    const entries: FsListEntry[] = [];

    for (const name of sliced) {
      const absolute = path.join(admitted.value.absolute, name);
      const relative = path.join(admitted.value.relative, name);
      let kind: FsListEntry["kind"] = "other";
      try {
        const info = await stat(absolute);
        kind = info.isDirectory() ? "directory" : info.isFile() ? "file" : "other";
      } catch {
        kind = "other";
      }
      entries.push({ name, path: relative, kind });
    }

    const truncated = names.length > input.maxEntries;
    return toolOk(
      { path: admitted.value.relative, entries },
      {
        evidence: [
          observation(
            "fs_list",
            `Listed ${entries.length} entries in ${admitted.value.relative}`,
            admitted.value.relative,
          ),
        ],
        unknowns: truncated
          ? [
              unknown(
                "TRUNCATED",
                `Directory has more than maxEntries=${input.maxEntries}`,
                admitted.value.relative,
              ),
            ]
          : [],
        limits: { truncated },
      },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("ENOENT")) {
      return toolFail(
        harnessError("NOT_FOUND", `Directory not found: ${admitted.value.relative}`),
      );
    }
    return toolFail(harnessError("INTERNAL", message));
  }
};
