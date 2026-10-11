export type HarnessErrorCode =
  | "INVALID_INPUT"
  | "PATH_REJECTED"
  | "NOT_FOUND"
  | "PERMISSION"
  | "TIMEOUT"
  | "CAPACITY"
  | "PROCESS_FAILED"
  | "GIT_FAILED"
  | "SETUP_REJECTED"
  | "INTERNAL";

export type HarnessError = {
  readonly code: HarnessErrorCode;
  readonly message: string;
  readonly details?: Record<string, unknown>;
};

export const harnessError = (
  code: HarnessErrorCode,
  message: string,
  details?: Record<string, unknown>,
): HarnessError => ({
  code,
  message,
  ...(details !== undefined ? { details } : {}),
});
