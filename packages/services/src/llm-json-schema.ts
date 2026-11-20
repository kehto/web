/**
 * Structural check of a JSON Schema against the draft 2020-12 meta-schema, for
 * NAP-LLM `Tool.parameters` (napplet/naps PR #134 at
 * 5e93bdfce0e84c0de728234cb7b3feed498f8635, Schemas, Tool):
 *
 *   "`parameters` uses JSON Schema draft 2020-12. Malformed schemas MUST
 *    produce `invalid-request`."
 *
 * "Malformed" is read as "does not validate against the 2020-12 meta-schema"
 * (https://json-schema.org/draft/2020-12/schema and its seven vocabulary
 * meta-schemas, plus the deprecated keywords that document still describes).
 * {@link SCHEMA_KEYWORDS} transcribes those keyword rules by hand so the check
 * ships with no dependency and no code generation: a general validator
 * compiles schemas with `new Function`, which a strict CSP refuses.
 * `llm-tool-schema.test.ts` compares this table with Ajv's meta-schema
 * validation, so a transcription slip fails a test.
 *
 * Decisions that follow the meta-schema, recorded here as spec-gap notes:
 * - Keywords the meta-schema does not name pass at any nesting level. NAP-LLM
 *   says JSON Schema keywords are not unknown record fields, and the
 *   meta-schema allows additional keywords.
 * - `format` annotates and does not assert in the 2020-12 meta-schema, so
 *   `pattern` and `patternProperties` keys are checked as text only. Nothing
 *   here compiles or runs a napplet-supplied regular expression.
 * - `$ref`, `$dynamicRef` and `$id` are checked as text. References are never
 *   resolved or fetched, so a dangling reference is well-formed here.
 * - Whether a well-formed schema can be sent to a given provider is a separate
 *   per-connection `unsupported` decision and is not made here.
 *
 * Callers bound the value first (see `isJsonValue`): this walk assumes plain,
 * acyclic JSON data of bounded size and adds only a schema nesting bound.
 */

/** Schema nesting bound; deeper schemas are treated as malformed. */
const MAX_SCHEMA_DEPTH = 32;
const SIMPLE_TYPES = new Set(['array', 'boolean', 'integer', 'null', 'number', 'object', 'string']);
const ANCHOR = /^[A-Za-z_][-A-Za-z0-9._]*$/;
/** `$id`: a URI reference with no non-empty fragment. */
const NO_FRAGMENT = /^[^#]*#?$/;

type Subschema = (value: unknown) => boolean;
/** One keyword rule: the keyword's value, and a checker for the subschemas it holds. */
type KeywordRule = (value: unknown, sub: Subschema) => boolean;

/**
 * True for a plain object: not an array, and with `Object.prototype` or `null`
 * as its prototype.
 *
 * @param value - Any value.
 * @returns Whether the value is a plain object.
 * @example
 * ```ts
 * isPlainObject({ a: 1 }); // true
 * isPlainObject(new Date()); // false
 * ```
 */
export function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const prototype: unknown = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

const anything: KeywordRule = () => true;
const textValue: KeywordRule = (value) => typeof value === 'string';
const booleanValue: KeywordRule = (value) => typeof value === 'boolean';
const numberValue: KeywordRule = (value) => typeof value === 'number';
const listValue: KeywordRule = (value) => Array.isArray(value);
const nonNegativeInteger: KeywordRule = (value) => typeof value === 'number' && Number.isInteger(value) && value >= 0;
const anchorText: KeywordRule = (value) => typeof value === 'string' && ANCHOR.test(value);
const subschema: KeywordRule = (value, sub) => sub(value);
const subschemaMap: KeywordRule = (value, sub) => isPlainObject(value) && Object.values(value).every(sub);
const subschemaList: KeywordRule = (value, sub) => Array.isArray(value) && value.length > 0 && value.every(sub);
const isUnique = (values: readonly unknown[]): boolean => new Set(values).size === values.length;
/** The meta-schema's `stringArray`: a list of distinct strings. */
const uniqueTexts: KeywordRule = (value) => Array.isArray(value) && value.every((entry) => typeof entry === 'string') && isUnique(value);
const typeValue: KeywordRule = (value) => {
  if (typeof value === 'string') return SIMPLE_TYPES.has(value);
  return Array.isArray(value) && value.length > 0 && value.every((entry) => typeof entry === 'string' && SIMPLE_TYPES.has(entry)) && isUnique(value);
};
const mapOf = (entry: KeywordRule): KeywordRule => (value, sub) => isPlainObject(value) && Object.values(value).every((item) => entry(item, sub));

/**
 * Keyword rules of the 2020-12 meta-schema, grouped by vocabulary. A `Map`, so
 * keyword lookup never reaches `Object.prototype`.
 */
const SCHEMA_KEYWORDS: ReadonlyMap<string, KeywordRule> = new Map<string, KeywordRule>([
  // core
  ['$id', (value) => typeof value === 'string' && NO_FRAGMENT.test(value)],
  ['$schema', textValue], ['$ref', textValue], ['$dynamicRef', textValue], ['$comment', textValue],
  ['$anchor', anchorText], ['$dynamicAnchor', anchorText],
  ['$vocabulary', mapOf(booleanValue)],
  ['$defs', subschemaMap],
  // applicator
  ['prefixItems', subschemaList], ['allOf', subschemaList], ['anyOf', subschemaList], ['oneOf', subschemaList],
  ['items', subschema], ['contains', subschema], ['additionalProperties', subschema], ['propertyNames', subschema],
  ['if', subschema], ['then', subschema], ['else', subschema], ['not', subschema],
  ['properties', subschemaMap], ['patternProperties', subschemaMap], ['dependentSchemas', subschemaMap],
  // unevaluated
  ['unevaluatedItems', subschema], ['unevaluatedProperties', subschema],
  // validation
  ['type', typeValue], ['const', anything], ['enum', listValue],
  ['multipleOf', (value) => typeof value === 'number' && value > 0],
  ['maximum', numberValue], ['exclusiveMaximum', numberValue], ['minimum', numberValue], ['exclusiveMinimum', numberValue],
  ['maxLength', nonNegativeInteger], ['minLength', nonNegativeInteger], ['maxItems', nonNegativeInteger], ['minItems', nonNegativeInteger],
  ['maxContains', nonNegativeInteger], ['minContains', nonNegativeInteger], ['maxProperties', nonNegativeInteger], ['minProperties', nonNegativeInteger],
  ['pattern', textValue], ['uniqueItems', booleanValue],
  ['required', uniqueTexts], ['dependentRequired', mapOf(uniqueTexts)],
  // meta-data
  ['title', textValue], ['description', textValue], ['default', anything], ['examples', listValue],
  ['deprecated', booleanValue], ['readOnly', booleanValue], ['writeOnly', booleanValue],
  // format-annotation and content
  ['format', textValue], ['contentEncoding', textValue], ['contentMediaType', textValue], ['contentSchema', subschema],
  // deprecated keywords the 2020-12 meta-schema still describes
  ['definitions', subschemaMap],
  ['dependencies', mapOf((value, sub) => (Array.isArray(value) ? uniqueTexts(value, sub) : sub(value)))],
  ['$recursiveAnchor', anchorText], ['$recursiveRef', textValue],
]);

function isSchemaAt(value: unknown, depth: number): boolean {
  if (typeof value === 'boolean') return true;
  if (depth > MAX_SCHEMA_DEPTH || !isPlainObject(value)) return false;
  const sub: Subschema = (entry) => isSchemaAt(entry, depth + 1);
  return Object.entries(value).every(([keyword, entry]) => SCHEMA_KEYWORDS.get(keyword)?.(entry, sub) ?? true);
}

/**
 * True when `value` is a well-formed JSON Schema under the draft 2020-12
 * meta-schema: a boolean, or an object whose known keywords carry values of the
 * shape the meta-schema requires, recursively. Unknown keywords pass.
 *
 * @param value - Plain, acyclic JSON data that the caller has already bounded.
 * @returns Whether the value is structurally a 2020-12 schema.
 * @example
 * ```ts
 * isJsonSchema({ type: 'object', properties: { city: { type: 'string' } }, required: ['city'] }); // true
 * isJsonSchema({ type: 'object', properties: 5 }); // false
 * ```
 */
export function isJsonSchema(value: unknown): boolean {
  return isSchemaAt(value, 0);
}
