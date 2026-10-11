export type EvidenceKind = "observation" | "derivation" | "inference";

export type Evidence = {
  readonly kind: EvidenceKind;
  readonly source: string;
  readonly summary: string;
  readonly location?: string;
  readonly confidence?: "high" | "medium" | "low";
};

export type Unknown = {
  readonly code: string;
  readonly message: string;
  readonly related?: string;
};

export const observation = (
  source: string,
  summary: string,
  location?: string,
): Evidence => ({
  kind: "observation",
  source,
  summary,
  ...(location !== undefined ? { location } : {}),
  confidence: "high",
});

export const derivation = (
  source: string,
  summary: string,
  location?: string,
): Evidence => ({
  kind: "derivation",
  source,
  summary,
  ...(location !== undefined ? { location } : {}),
  confidence: "medium",
});

export const unknown = (
  code: string,
  message: string,
  related?: string,
): Unknown => ({
  code,
  message,
  ...(related !== undefined ? { related } : {}),
});
