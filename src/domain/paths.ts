import path from "node:path";

import { err, ok, type Result } from "./result.js";
import { harnessError, type HarnessError } from "./errors.js";

export type AdmittedPath = {
  readonly absolute: string;
  readonly relative: string;
};

/**
 * Admit a caller path only when it resolves inside the workspace root.
 * Symlink targets are not followed here; callers that open files should
 * re-check after realpath if they need extra hardening.
 */
export const admitPath = (
  workspaceRoot: string,
  requested: string,
): Result<AdmittedPath, HarnessError> => {
  if (!requested || requested.trim() === "") {
    return err(harnessError("INVALID_INPUT", "Path is required"));
  }

  const root = path.resolve(workspaceRoot);
  const absolute = path.isAbsolute(requested)
    ? path.resolve(requested)
    : path.resolve(root, requested);

  const relative = path.relative(root, absolute);
  if (
    relative === ".." ||
    relative.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relative)
  ) {
    return err(
      harnessError("PATH_REJECTED", "Path escapes workspace root", {
        requested,
        workspaceRoot: root,
      }),
    );
  }

  return ok({ absolute, relative: relative === "" ? "." : relative });
};
