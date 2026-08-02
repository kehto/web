import type {
  ConfigSchemaErrorCode,
  ConfigValues,
  NappletConfigSchema,
} from '@napplet/nap/config/types';

/** Result of validating a NAP-CONFIG Core Subset schema. */
export type ConfigSchemaValidation =
  | { ok: true }
  | { ok: false; code: ConfigSchemaErrorCode; error: string };

/**
 * NAP-CONFIG's bounded JSON Schema vocabulary. Unknown standard keywords are
 * rejected because accepting a constraint that is not enforced would allow
 * invalid values to cross the host boundary. Unknown `x-napplet-*`
 * annotations remain opaque metadata as required by the draft.
 */
const CONFIG_TYPES = new Set(['string', 'number', 'integer', 'boolean', 'array', 'object']);
const CONFIG_SCHEMA_KEYS = new Set([
  '$schema', '$version', 'type', 'properties', 'required', 'items',
  'additionalProperties', 'default', 'title', 'description', 'enum',
  'enumDescriptions', 'minimum', 'maximum', 'minLength', 'maxLength',
  'minItems', 'maxItems', 'format', 'deprecationMessage',
  'markdownDescription',
]);
const FORBIDDEN_SCHEMA_KEYS = new Set([
  '$ref', '$defs', 'definitions', 'pattern', 'patternProperties', 'propertyNames',
  'dependencies', 'dependentSchemas', 'unevaluatedProperties', 'oneOf', 'anyOf',
  'allOf', 'not', 'if', 'then', 'else',
]);

/** Validate the complete bounded NAP-CONFIG Core Subset recursively. */
export function validateConfigSchema(schema: unknown): ConfigSchemaValidation {
  if (!isRecord(schema)) {
    return { ok: false, code: 'invalid-schema', error: 'schema root must be an object' };
  }
  if (schema.type !== 'object') {
    return { ok: false, code: 'invalid-schema', error: 'schema root must have type: "object"' };
  }
  if (schema.$schema !== undefined) {
    if (typeof schema.$schema !== 'string' || !isSupportedSchemaDraft(schema.$schema)) {
      return { ok: false, code: 'unsupported-draft', error: 'schema draft is not supported' };
    }
  }
  if (schema.$version !== undefined && (!Number.isSafeInteger(schema.$version) || Number(schema.$version) < 0)) {
    return { ok: false, code: 'invalid-schema', error: '$version must be a non-negative integer' };
  }
  return validateSchemaNode(schema, 0, '$');
}

function validateSchemaNode(schema: Record<string, unknown>, depth: number, path: string): ConfigSchemaValidation {
  if (schema.type === 'object' && depth > 4) {
    return { ok: false, code: 'schema-too-deep', error: `${path} exceeds the four-level object depth limit` };
  }
  for (const key of Object.keys(schema)) {
    if (FORBIDDEN_SCHEMA_KEYS.has(key)) {
      const code: ConfigSchemaErrorCode = key === '$ref' || key === '$defs' || key === 'definitions'
        ? 'ref-not-allowed'
        : key === 'pattern'
          ? 'pattern-not-allowed'
          : 'invalid-schema';
      return { ok: false, code, error: `${key} is not permitted in the Core Subset at ${path}` };
    }
    if (!CONFIG_SCHEMA_KEYS.has(key) && !key.startsWith('x-napplet-')) {
      return { ok: false, code: 'invalid-schema', error: `${key} is outside the NAP-CONFIG Core Subset at ${path}` };
    }
    if (path !== '$' && (key === '$schema' || key === '$version')) {
      return { ok: false, code: 'invalid-schema', error: `${key} is only valid at the schema root` };
    }
  }
  if (typeof schema.type !== 'string' || !CONFIG_TYPES.has(schema.type)) {
    return { ok: false, code: 'invalid-schema', error: `${path} has an unsupported or missing type` };
  }
  if (schema['x-napplet-secret'] === true && Object.hasOwn(schema, 'default')) {
    return { ok: false, code: 'secret-with-default', error: `${path} combines x-napplet-secret with default` };
  }
  const annotations = validateAnnotations(schema, path);
  if (!annotations.ok) return annotations;
  if (schema.type === 'object') return validateObjectSchema(schema, depth, path);
  if (schema.type === 'array') {
    if (!isRecord(schema.items)) {
      return { ok: false, code: 'invalid-schema', error: `${path}.items must be one homogeneous schema` };
    }
    const itemType = schema.items.type;
    if (itemType === 'object' || itemType === 'array') {
      return { ok: false, code: 'invalid-schema', error: `${path} arrays may contain primitives only` };
    }
    const constraints = validateScalarConstraints(schema, path);
    if (!constraints.ok) return constraints;
    const itemValidation = validateSchemaNode(schema.items, depth, `${path}[]`);
    if (!itemValidation.ok) return itemValidation;
    return validateDefault(schema, path);
  }
  const constraints = validateScalarConstraints(schema, path);
  if (!constraints.ok) return constraints;
  return validateDefault(schema, path);
}

function validateObjectSchema(schema: Record<string, unknown>, depth: number, path: string): ConfigSchemaValidation {
  const constraints = validateScalarConstraints(schema, path);
  if (!constraints.ok) return constraints;
  if (schema.properties !== undefined && !isRecord(schema.properties)) {
    return { ok: false, code: 'invalid-schema', error: `${path}.properties must be an object` };
  }
  if (schema.required !== undefined && (
    !Array.isArray(schema.required)
      || schema.required.some((key) => typeof key !== 'string')
      || new Set(schema.required).size !== schema.required.length
  )) {
    return { ok: false, code: 'invalid-schema', error: `${path}.required must contain unique strings` };
  }
  if (schema.additionalProperties !== undefined && typeof schema.additionalProperties !== 'boolean') {
    return { ok: false, code: 'invalid-schema', error: `${path}.additionalProperties must be boolean` };
  }
  const properties = schema.properties ?? {};
  if (Array.isArray(schema.required) && schema.required.some((key) => !Object.hasOwn(properties, key))) {
    return { ok: false, code: 'invalid-schema', error: `${path}.required references an undeclared property` };
  }
  for (const [key, child] of Object.entries(properties)) {
    if (!isRecord(child)) {
      return { ok: false, code: 'invalid-schema', error: `${path}.${key} must be an object schema` };
    }
    const validation = validateSchemaNode(child, child.type === 'object' ? depth + 1 : depth, `${path}.${key}`);
    if (!validation.ok) return validation;
  }
  return validateDefault(schema, path);
}

function validateScalarConstraints(schema: Record<string, unknown>, path: string): ConfigSchemaValidation {
  const numericKeys = schema.type === 'number' || schema.type === 'integer' ? ['minimum', 'maximum'] : [];
  const countKeys = schema.type === 'string'
    ? ['minLength', 'maxLength']
    : schema.type === 'array'
      ? ['minItems', 'maxItems']
      : [];
  for (const key of ['minimum', 'maximum', 'minLength', 'maxLength', 'minItems', 'maxItems']) {
    if (schema[key] !== undefined && !numericKeys.includes(key) && !countKeys.includes(key)) {
      return { ok: false, code: 'invalid-schema', error: `${path}.${key} does not apply to ${String(schema.type)}` };
    }
  }
  for (const key of numericKeys) {
    if (schema[key] !== undefined && (typeof schema[key] !== 'number' || !Number.isFinite(schema[key]))) {
      return { ok: false, code: 'invalid-schema', error: `${path}.${key} must be a finite number` };
    }
  }
  for (const key of countKeys) {
    if (schema[key] !== undefined && (!Number.isSafeInteger(schema[key]) || Number(schema[key]) < 0)) {
      return { ok: false, code: 'invalid-schema', error: `${path}.${key} must be a non-negative integer` };
    }
  }
  if (typeof schema.minimum === 'number' && typeof schema.maximum === 'number' && schema.minimum > schema.maximum) {
    return { ok: false, code: 'invalid-schema', error: `${path}.minimum cannot exceed maximum` };
  }
  if (typeof schema.minLength === 'number' && typeof schema.maxLength === 'number' && schema.minLength > schema.maxLength) {
    return { ok: false, code: 'invalid-schema', error: `${path}.minLength cannot exceed maxLength` };
  }
  if (typeof schema.minItems === 'number' && typeof schema.maxItems === 'number' && schema.minItems > schema.maxItems) {
    return { ok: false, code: 'invalid-schema', error: `${path}.minItems cannot exceed maxItems` };
  }
  if (schema.enum !== undefined) {
    if (!Array.isArray(schema.enum) || schema.enum.length === 0) {
      return { ok: false, code: 'invalid-schema', error: `${path}.enum must be a non-empty array` };
    }
    if (schema.enum.some((value) => !isPrimitiveForType(value, String(schema.type)))) {
      return { ok: false, code: 'invalid-schema', error: `${path}.enum contains a value outside its declared type` };
    }
    if (new Set(schema.enum.map((value) => JSON.stringify(value))).size !== schema.enum.length) {
      return { ok: false, code: 'invalid-schema', error: `${path}.enum values must be unique` };
    }
  }
  return { ok: true };
}

function validateAnnotations(schema: Record<string, unknown>, path: string): ConfigSchemaValidation {
  for (const key of ['title', 'description', 'format', 'x-napplet-section', 'deprecationMessage', 'markdownDescription']) {
    if (schema[key] !== undefined && typeof schema[key] !== 'string') {
      return { ok: false, code: 'invalid-schema', error: `${path}.${key} must be a string` };
    }
  }
  if (schema['x-napplet-secret'] !== undefined && typeof schema['x-napplet-secret'] !== 'boolean') {
    return { ok: false, code: 'invalid-schema', error: `${path}.x-napplet-secret must be boolean` };
  }
  if (schema['x-napplet-secret'] === true && schema.type !== 'string') {
    return { ok: false, code: 'invalid-schema', error: `${path}.x-napplet-secret applies only to strings` };
  }
  if (schema['x-napplet-order'] !== undefined && (
    typeof schema['x-napplet-order'] !== 'number'
      || !Number.isFinite(schema['x-napplet-order'])
      || schema['x-napplet-order'] < 0
  )) {
    return { ok: false, code: 'invalid-schema', error: `${path}.x-napplet-order must be a non-negative number` };
  }
  if (schema.enumDescriptions !== undefined && (
    !Array.isArray(schema.enumDescriptions)
      || schema.enumDescriptions.some((value) => typeof value !== 'string')
      || !Array.isArray(schema.enum)
      || schema.enumDescriptions.length !== schema.enum.length
  )) {
    return { ok: false, code: 'invalid-schema', error: `${path}.enumDescriptions must parallel enum` };
  }
  return { ok: true };
}

function validateDefault(schema: Record<string, unknown>, path: string): ConfigSchemaValidation {
  if (!Object.hasOwn(schema, 'default')) return { ok: true };
  if (!configValuesConform(schema, schema.default)) {
    return { ok: false, code: 'invalid-schema', error: `${path}.default does not validate against its schema` };
  }
  return { ok: true };
}

export function configValuesConform(schema: Record<string, unknown>, value: unknown): boolean {
  if (Array.isArray(schema.enum) && !schema.enum.some((item) => Object.is(item, value))) return false;
  if (schema.type === 'string') {
    return typeof value === 'string' && withinLength(value.length, schema.minLength, schema.maxLength);
  }
  if (schema.type === 'number') {
    return typeof value === 'number' && Number.isFinite(value) && withinLength(value, schema.minimum, schema.maximum);
  }
  if (schema.type === 'integer') {
    return Number.isSafeInteger(value) && withinLength(value as number, schema.minimum, schema.maximum);
  }
  if (schema.type === 'boolean') return typeof value === 'boolean';
  if (schema.type === 'array') {
    return Array.isArray(value)
      && isRecord(schema.items)
      && withinLength(value.length, schema.minItems, schema.maxItems)
      && value.every((item) => configValuesConform(schema.items as Record<string, unknown>, item));
  }
  if (schema.type === 'object') {
    if (!isRecord(value)) return false;
    const properties = isRecord(schema.properties) ? schema.properties : {};
    if (Object.keys(value).some((key) => !Object.hasOwn(properties, key))) return false;
    if (Array.isArray(schema.required) && schema.required.some((key) => typeof key === 'string' && !Object.hasOwn(value, key))) {
      return false;
    }
    return Object.entries(value).every(([key, child]) => {
      const childSchema = properties[key];
      return isRecord(childSchema) && configValuesConform(childSchema, child);
    });
  }
  return false;
}

function isPrimitiveForType(value: unknown, type: string): boolean {
  if (type === 'string') return typeof value === 'string';
  if (type === 'number') return typeof value === 'number' && Number.isFinite(value);
  if (type === 'integer') return Number.isSafeInteger(value);
  if (type === 'boolean') return typeof value === 'boolean';
  return false;
}

function isSupportedSchemaDraft(value: string): boolean {
  return /^https?:\/\/json-schema\.org\/(?:draft-0?7\/schema#?|draft\/2019-09\/schema#?|draft\/2020-12\/schema#?)$/u.test(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Apply schema defaults and drop values that do not validate. */
export function resolveConfigValues(schema: NappletConfigSchema, values: ConfigValues): ConfigValues {
  return resolveObjectValues(schema as Record<string, unknown>, isRecord(values) ? values : {}, {}) as ConfigValues;
}

function resolveObjectValues(
  schema: Record<string, unknown>,
  input: Record<string, unknown>,
  inheritedDefault: Record<string, unknown>,
): Record<string, unknown> {
  const output: Record<string, unknown> = {};
  const ownDefault = isRecord(schema.default) ? schema.default : {};
  const defaults = { ...inheritedDefault, ...ownDefault };
  for (const [key, childValue] of Object.entries(schema.properties ?? {})) {
    if (!isRecord(childValue)) continue;
    const candidate = Object.hasOwn(input, key) ? input[key] : defaults[key];
    const resolved = resolveConfigValue(childValue, candidate);
    if (resolved !== undefined) output[key] = resolved;
  }
  return output;
}

function resolveConfigValue(schema: Record<string, unknown>, candidate: unknown): unknown {
  const value = candidate === undefined ? schema.default : candidate;
  if (value === undefined) return undefined;
  const resolved = resolveTypedConfigValue(schema, value);
  if (resolved !== undefined) return resolved;
  return candidate !== undefined && schema.default !== undefined
    ? resolveTypedConfigValue(schema, schema.default)
    : undefined;
}

function resolveTypedConfigValue(schema: Record<string, unknown>, value: unknown): unknown {
  if (schema.enum && Array.isArray(schema.enum) && !schema.enum.some((item) => Object.is(item, value))) return undefined;
  switch (schema.type) {
    case 'object': {
      if (!isRecord(value)) return undefined;
      const resolved = resolveObjectValues(schema, value, {});
      return Array.isArray(schema.required)
        && schema.required.some((key) => typeof key === 'string' && !Object.hasOwn(resolved, key))
        ? undefined
        : resolved;
    }
    case 'array': {
      if (!Array.isArray(value) || !isRecord(schema.items) || !withinLength(value.length, schema.minItems, schema.maxItems)) {
        return undefined;
      }
      const resolved = value.map((item) => resolveConfigValue(schema.items as Record<string, unknown>, item));
      if (resolved.some((item) => item === undefined)) return undefined;
      return resolved;
    }
    case 'string': return typeof value === 'string' && withinLength(value.length, schema.minLength, schema.maxLength) ? value : undefined;
    case 'number': return typeof value === 'number' && Number.isFinite(value) && withinLength(value, schema.minimum, schema.maximum) ? value : undefined;
    case 'integer': return Number.isSafeInteger(value) && withinLength(value as number, schema.minimum, schema.maximum) ? value : undefined;
    case 'boolean': return typeof value === 'boolean' ? value : undefined;
    default: return undefined;
  }
}

function withinLength(value: number, minimum: unknown, maximum: unknown): boolean {
  return (typeof minimum !== 'number' || value >= minimum) && (typeof maximum !== 'number' || value <= maximum);
}


