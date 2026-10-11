import type { ZodTypeAny } from "zod";
import {
  ZodArray,
  ZodBoolean,
  ZodDefault,
  ZodEffects,
  ZodEnum,
  ZodLiteral,
  ZodNumber,
  ZodObject,
  ZodOptional,
  ZodString,
} from "zod";

/**
 * Minimal Zod → JSON Schema converter for MCP tool advertising.
 * Covers the schemas used by this package without a heavy dependency.
 */
export const zodToJsonSchema = (schema: ZodTypeAny): Record<string, unknown> => {
  let current: ZodTypeAny = schema;
  let defaultValue: unknown;

  while (current instanceof ZodEffects) {
    current = current._def.schema;
  }
  if (current instanceof ZodDefault) {
    defaultValue = current._def.defaultValue();
    current = current._def.innerType;
  }
  if (current instanceof ZodOptional) {
    current = current._def.innerType;
  }

  let result: Record<string, unknown>;

  if (current instanceof ZodObject) {
    const shape = current.shape as Record<string, ZodTypeAny>;
    const properties: Record<string, unknown> = {};
    const required: string[] = [];
    for (const [key, value] of Object.entries(shape)) {
      properties[key] = zodToJsonSchema(value);
      const optional =
        value instanceof ZodOptional ||
        value instanceof ZodDefault ||
        (value instanceof ZodEffects &&
          (value._def.schema instanceof ZodOptional ||
            value._def.schema instanceof ZodDefault));
      if (!optional) required.push(key);
    }
    result = {
      type: "object",
      properties,
      additionalProperties: current._def.unknownKeys === "passthrough",
      ...(required.length > 0 ? { required } : {}),
    };
  } else if (current instanceof ZodString) {
    result = { type: "string" };
  } else if (current instanceof ZodNumber) {
    result = { type: "number" };
  } else if (current instanceof ZodBoolean) {
    result = { type: "boolean" };
  } else if (current instanceof ZodArray) {
    result = {
      type: "array",
      items: zodToJsonSchema(current._def.type),
    };
  } else if (current instanceof ZodLiteral) {
    result = { const: current._def.value };
  } else if (current instanceof ZodEnum) {
    result = { enum: [...current._def.values] };
  } else {
    result = {};
  }

  if (defaultValue !== undefined) {
    result.default = defaultValue;
  }
  return result;
};
