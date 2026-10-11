import type { ZodTypeAny } from "zod";
import { zodToJsonSchema as convert } from "../contracts/zodJsonSchema.js";

export const zodToJsonSchema = (schema: ZodTypeAny): Record<string, unknown> =>
  convert(schema);
