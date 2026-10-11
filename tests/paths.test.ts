import path from "node:path";
import { describe, expect, it } from "vitest";

import { admitPath } from "../src/domain/paths.js";

describe("admitPath", () => {
  const root = path.resolve("/tmp/reaharness-workspace");

  it("admits relative paths inside the root", () => {
    const result = admitPath(root, "src/index.ts");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.relative).toBe(path.join("src", "index.ts"));
      expect(result.value.absolute).toBe(path.join(root, "src", "index.ts"));
    }
  });

  it("rejects path escape via ..", () => {
    const result = admitPath(root, "../outside.txt");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("PATH_REJECTED");
    }
  });

  it("rejects absolute paths outside the root", () => {
    const result = admitPath(root, "/etc/passwd");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("PATH_REJECTED");
    }
  });
});
