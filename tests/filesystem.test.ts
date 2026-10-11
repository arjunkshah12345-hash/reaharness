import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { fsList, fsRead, fsWrite } from "../src/tools/filesystem.js";

describe("filesystem tools", () => {
  it("reads, writes, and lists within the workspace", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "reaharness-fs-"));
    await writeFile(path.join(root, "hello.txt"), "hi", "utf8");

    const read = await fsRead(root, { path: "hello.txt", maxBytes: 100 });
    expect(read.ok).toBe(true);
    if (read.ok) expect(read.data.content).toBe("hi");

    const write = await fsWrite(root, {
      path: "nested/a.txt",
      content: "abc",
      createParents: true,
    });
    expect(write.ok).toBe(true);

    const list = await fsList(root, { path: ".", maxEntries: 50 });
    expect(list.ok).toBe(true);
    if (list.ok) {
      const names = list.data.entries.map((entry) => entry.name);
      expect(names).toContain("hello.txt");
      expect(names).toContain("nested");
    }
  });

  it("rejects escape on write", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "reaharness-fs-"));
    const write = await fsWrite(root, {
      path: "../escape.txt",
      content: "nope",
      createParents: true,
    });
    expect(write.ok).toBe(false);
    if (!write.ok) expect(write.error.code).toBe("PATH_REJECTED");
  });
});
