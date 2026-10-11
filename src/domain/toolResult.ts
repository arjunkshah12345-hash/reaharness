import type { Evidence, Unknown } from "./evidence.js";
import type { HarnessError } from "./errors.js";

export type ToolLimits = {
  readonly truncated?: boolean;
  readonly maxBytes?: number;
  readonly timedOut?: boolean;
};

export type ToolSuccess<T> = {
  readonly ok: true;
  readonly data: T;
  readonly evidence: readonly Evidence[];
  readonly unknowns: readonly Unknown[];
  readonly limits: ToolLimits;
};

export type ToolFailure = {
  readonly ok: false;
  readonly error: HarnessError;
  readonly evidence: readonly Evidence[];
  readonly unknowns: readonly Unknown[];
  readonly limits: ToolLimits;
};

export type ToolResult<T> = ToolSuccess<T> | ToolFailure;

export const toolOk = <T>(
  data: T,
  options: {
    evidence?: readonly Evidence[];
    unknowns?: readonly Unknown[];
    limits?: ToolLimits;
  } = {},
): ToolSuccess<T> => ({
  ok: true,
  data,
  evidence: options.evidence ?? [],
  unknowns: options.unknowns ?? [],
  limits: options.limits ?? {},
});

export const toolFail = (
  error: HarnessError,
  options: {
    evidence?: readonly Evidence[];
    unknowns?: readonly Unknown[];
    limits?: ToolLimits;
  } = {},
): ToolFailure => ({
  ok: false,
  error,
  evidence: options.evidence ?? [],
  unknowns: options.unknowns ?? [],
  limits: options.limits ?? {},
});
