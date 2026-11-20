/**
 * NAP-LLM `Tool.parameters` against the JSON Schema draft 2020-12 meta-schema.
 * Authority: napplet/naps PR #134 at 5e93bdfce0e84c0de728234cb7b3feed498f8635
 * (Schemas, Tool; unchanged on napplet/naps `nap-llm` at 137066c):
 *
 *   "`parameters` uses JSON Schema draft 2020-12. Malformed schemas MUST
 *    produce `invalid-request`."
 *   "JSON Schema keywords are not unknown record fields."
 *
 * The shipped check is hand-written so it runs under a strict CSP with no
 * runtime dependency. Ajv is a test-only oracle here: every vector states its
 * expected verdict and is also compared with Ajv's own 2020-12 meta-schema
 * validation, so the two cannot drift apart silently. `validateFormats` is off
 * because the 2020-12 meta-schema uses the format-annotation vocabulary:
 * `format: "regex"` and `format: "uri"` annotate and do not assert.
 */
import { Ajv2020 } from 'ajv/dist/2020.js';
import { describe, expect, it } from 'vitest';
import { isLlmGenerationRequest } from './llm-validate.js';

const oracle = new Ajv2020({ strict: false, validateFormats: false, logger: false });
/** Ajv's verdict on a schema. It refuses a non-text `$schema` by throwing, which is a rejection too. */
function metaValid(schema: unknown): boolean {
  try {
    return oracle.validateSchema(schema as Record<string, unknown>) === true;
  } catch {
    return false;
  }
}
/** Every keyword the 2020-12 meta-schema documents describe, read from the oracle's own copies. */
const META_SCHEMA_IDS = ['schema', 'meta/core', 'meta/applicator', 'meta/unevaluated', 'meta/validation', 'meta/meta-data', 'meta/format-annotation', 'meta/content'];
const META_KEYWORDS = META_SCHEMA_IDS.flatMap((id) => {
  const document = oracle.getSchema(`https://json-schema.org/draft/2020-12/${id}`)?.schema as { properties?: Record<string, unknown> } | undefined;
  return Object.keys(document?.properties ?? {});
});
/** Values of every JSON type and of each shape a keyword can demand, valid for some keywords and not for others. */
const PROBE_VALUES: unknown[] = [
  5, 0, -1, 1.5, 'a', 'a b', '1a', 'a#b', 'string', true, false, null,
  [], ['a'], ['a', 'a'], ['string', 'null'], [1], [{}], [true], [{ type: 5 }],
  {}, { a: 1 }, { a: true }, { a: {} }, { a: ['b'] }, { a: ['b', 'b'] }, { a: { type: 5 } }, { type: 5 },
];
const ASK = [{ role: 'user', content: [{ type: 'text', text: 'hi' }] }];
const accepts = (parameters: unknown): boolean => isLlmGenerationRequest({ handle: 'h1', messages: ASK, tools: [{ name: 'a', parameters }] });
/** A root-object schema carrying `keywords` on a nested property, so the walk has to recurse to see them. */
const nested = (keywords: Record<string, unknown>) => ({ type: 'object', properties: { x: keywords } });

const MALFORMED: Array<[string, Record<string, unknown>]> = [
  ['issue #401: properties is a number', { type: 'object', properties: 5 }],
  ['issue #401: required is text', { type: 'object', required: 'city' }],
  ['a property that is not a schema', { type: 'object', properties: { x: 3 } }],
  ['unknown type name', nested({ type: 'text' })],
  ['empty type list', nested({ type: [] })],
  ['repeated type list entry', nested({ type: ['string', 'string'] })],
  ['repeated required name', { type: 'object', required: ['city', 'city'] }],
  ['required with a non-text entry', { type: 'object', required: ['city', 1] }],
  ['enum is not a list', nested({ enum: 'a' })],
  ['examples is not a list', nested({ examples: 'a' })],
  ['2019-style items list', nested({ type: 'array', items: [{ type: 'string' }] })],
  ['empty anyOf', { type: 'object', anyOf: [] }],
  ['allOf entry is not a schema', { type: 'object', allOf: [1] }],
  ['prefixItems is a schema, not a list', nested({ prefixItems: { type: 'string' } })],
  ['not is a list', { type: 'object', not: [] }],
  ['$defs entry is not a schema', { type: 'object', $defs: { id: 'integer' } }],
  ['definitions entry is not a schema', { type: 'object', definitions: { id: 1 } }],
  ['patternProperties is a list', { type: 'object', patternProperties: [] }],
  ['dependentSchemas entry is not a schema', { type: 'object', dependentSchemas: { a: 1 } }],
  ['dependentRequired entry is text', { type: 'object', dependentRequired: { a: 'b' } }],
  ['dependentRequired entry repeats a name', { type: 'object', dependentRequired: { a: ['b', 'b'] } }],
  ['dependencies entry is a number', { type: 'object', dependencies: { a: 1 } }],
  ['unevaluatedProperties is a number', { type: 'object', unevaluatedProperties: 5 }],
  ['unevaluatedItems is text', nested({ unevaluatedItems: 'no' })],
  ['contentSchema is a number', nested({ contentSchema: 1 })],
  ['minLength is text', nested({ minLength: '3' })],
  ['maxLength is negative', nested({ maxLength: -1 })],
  ['minItems is fractional', nested({ minItems: 1.5 })],
  ['maxItems is boolean', nested({ maxItems: true })],
  ['minContains is text', nested({ minContains: '1' })],
  ['maxContains is negative', nested({ maxContains: -2 })],
  ['minProperties is text', { type: 'object', minProperties: '1' }],
  ['maxProperties is fractional', { type: 'object', maxProperties: 0.5 }],
  ['minimum is text', nested({ minimum: '1' })],
  ['maximum is null', nested({ maximum: null })],
  ['exclusiveMinimum is boolean (draft 4 style)', nested({ exclusiveMinimum: true })],
  ['exclusiveMaximum is boolean (draft 4 style)', nested({ exclusiveMaximum: false })],
  ['multipleOf is zero', nested({ multipleOf: 0 })],
  ['multipleOf is negative', nested({ multipleOf: -2 })],
  ['uniqueItems is text', nested({ uniqueItems: 'yes' })],
  ['pattern is a number', nested({ pattern: 5 })],
  ['format is a number', nested({ format: 1 })],
  ['title is a number', { type: 'object', title: 5 }],
  ['description is a list', nested({ description: ['a'] })],
  ['deprecated is text', nested({ deprecated: 'yes' })],
  ['readOnly is a number', nested({ readOnly: 1 })],
  ['writeOnly is null', nested({ writeOnly: null })],
  ['contentEncoding is a number', nested({ contentEncoding: 64 })],
  ['contentMediaType is boolean', nested({ contentMediaType: true })],
  ['$ref is a number', nested({ $ref: 5 })],
  ['$dynamicRef is an object', nested({ $dynamicRef: {} })],
  ['$recursiveRef is a number', nested({ $recursiveRef: 1 })],
  ['$id with a non-empty fragment', { type: 'object', $id: 'https://example.test/s#frag' }],
  ['$schema is a number', { type: 'object', $schema: 2020 }],
  ['$anchor with a space', nested({ $anchor: 'not valid' })],
  ['$dynamicAnchor starting with a digit', nested({ $dynamicAnchor: '1a' })],
  ['$recursiveAnchor is boolean (2019-09 style)', { type: 'object', $recursiveAnchor: true }],
  ['$comment is a number', { type: 'object', $comment: 1 }],
  ['$vocabulary value is text', { type: 'object', $vocabulary: { 'https://example.test/v': 'yes' } }],
  ['if is a number', { type: 'object', if: 1 }],
  ['then is text', { type: 'object', then: 'x' }],
  ['else is a list', { type: 'object', else: [] }],
  ['contains is a number', nested({ contains: 1 })],
  ['propertyNames is text', { type: 'object', propertyNames: 'x' }],
  ['additionalProperties is text', { type: 'object', additionalProperties: 'no' }],
  ['malformed keyword deep inside $defs', { type: 'object', $defs: { a: { items: { anyOf: [{ properties: { b: { minLength: -1 } } }] } } } }],
];

const WELL_FORMED: Array<[string, Record<string, unknown>]> = [
  ['issue #401: properties, required, enum and $defs', {
    type: 'object',
    $defs: { unit: { enum: ['c', 'f'] } },
    properties: { city: { type: 'string' }, unit: { $ref: '#/$defs/unit' } },
    required: ['city'],
  }],
  ['bare root object', { type: 'object' }],
  ['boolean subschemas', { type: 'object', properties: { any: true, none: false }, additionalProperties: false }],
  ['every assertion keyword with a valid value', nested({
    type: ['string', 'null'], minLength: 0, maxLength: 3, pattern: '^a+$', format: 'email',
    minimum: -1.5, maximum: 2, exclusiveMinimum: 0, exclusiveMaximum: 10, multipleOf: 0.5,
    minItems: 1, maxItems: 2, uniqueItems: true, minContains: 0, maxContains: 1,
    const: null, enum: [], default: { any: [1] }, examples: [1, 'a'],
    title: 't', description: 'd', deprecated: false, readOnly: true, writeOnly: false,
    contentEncoding: 'base64', contentMediaType: 'application/json', contentSchema: { type: 'object' },
  })],
  ['every applicator keyword with a valid value', {
    type: 'object', minProperties: 0, maxProperties: 9,
    patternProperties: { '^x-': { type: 'string' } }, propertyNames: { maxLength: 8 },
    dependentSchemas: { a: { required: ['b'] } }, dependentRequired: { a: ['b', 'c'] },
    unevaluatedProperties: false,
    allOf: [true], anyOf: [{ type: 'object' }], oneOf: [{}], not: false,
    if: { required: ['a'] }, then: { required: ['b'] }, else: true,
    properties: { list: { type: 'array', prefixItems: [{ type: 'string' }], items: { type: 'number' }, contains: {}, unevaluatedItems: false } },
  }],
  ['core keywords with valid values', {
    type: 'object', $schema: 'https://json-schema.org/draft/2020-12/schema', $id: 'https://example.test/tool#',
    $comment: 'c', $vocabulary: { 'https://json-schema.org/draft/2020-12/vocab/core': true },
    $defs: { node: { $anchor: 'node', $dynamicAnchor: 'meta', $ref: '#/$defs/node', $dynamicRef: '#meta' } },
  }],
  ['deprecated keywords the meta-schema still describes', {
    type: 'object', definitions: { a: {} }, dependencies: { a: ['b'], c: { required: ['d'] } }, $recursiveAnchor: 'meta', $recursiveRef: '#',
  }],
  ['unknown and vendor keywords', { type: 'object', 'x-vendor': { anything: 1 }, nullable: 5, properties: { x: { 'x-order': [] } } }],
  ['property names that shadow Object.prototype', { type: 'object', properties: { constructor: { type: 'string' }, toString: { type: 'string' } }, required: ['constructor'] }],
  ['keyword-named properties are property names, not keywords', { type: 'object', properties: { required: { type: 'string' }, minLength: { type: 'integer' }, type: { enum: ['a'] } } }],
  ['unresolvable $ref and uncompilable pattern stay annotations', nested({ $ref: '#/$defs/missing', pattern: '(' })],
];

describe('NAP-LLM tool parameters: JSON Schema 2020-12 meta-schema', () => {
  it.each(MALFORMED)('rejects a malformed schema: %s', (_label, schema) => {
    expect(metaValid(schema), 'meta-schema oracle').toBe(false);
    expect(accepts(schema)).toBe(false);
  });

  it.each(WELL_FORMED)('accepts a well-formed schema: %s', (_label, schema) => {
    expect(metaValid(schema), 'meta-schema oracle').toBe(true);
    expect(accepts(schema)).toBe(true);
  });

  it('agrees with the meta-schema for every documented keyword against every probe value', () => {
    expect(META_KEYWORDS.length).toBeGreaterThanOrEqual(60);
    const disagreements: string[] = [];
    for (const keyword of META_KEYWORDS) {
      for (const value of PROBE_VALUES) {
        const schema = nested({ [keyword]: value });
        if (accepts(schema) !== metaValid(schema)) disagreements.push(`${keyword}: ${JSON.stringify(value)}`);
      }
    }
    expect(disagreements).toEqual([]);
  });

  it('keeps the NAP-LLM root rule on top of the meta-schema: a well-formed schema without root type "object" is rejected', () => {
    for (const schema of [{ type: 'array' }, { type: 'string' }, { properties: {} }, { type: ['object', 'null'] }]) {
      expect(metaValid(schema)).toBe(true);
      expect(accepts(schema)).toBe(false);
    }
    for (const notAnObject of [true, false, [], 'object', 5, null]) expect(accepts(notAnObject)).toBe(false);
  });

  it('never compiles or runs a napplet-supplied pattern while checking the schema', () => {
    const catastrophic = '^(a+)+$';
    const schema = { type: 'object', patternProperties: { [catastrophic]: { type: 'string' } }, properties: { x: { type: 'string', pattern: catastrophic, default: `${'a'.repeat(40)}!`, examples: [`${'a'.repeat(40)}!`] } } };
    const started = Date.now();
    expect(accepts(schema)).toBe(true);
    expect(Date.now() - started).toBeLessThan(250);
  });

  it('bounds the walk: cyclic, over-deep and oversized schemas are rejected promptly', () => {
    const cycle: Record<string, unknown> = { type: 'object' };
    cycle.properties = { self: cycle };
    let deep: Record<string, unknown> = { type: 'string' };
    for (let level = 0; level < 40; level += 1) deep = { type: 'array', items: deep };
    let shared: unknown = { type: 'string' };
    for (let level = 0; level < 40; level += 1) shared = { a: shared, b: shared };
    const wide = Object.fromEntries(Array.from({ length: 60_000 }, (_, index) => [`p${index}`, true]));
    const started = Date.now();
    expect(accepts(cycle)).toBe(false);
    expect(accepts({ type: 'object', properties: { deep } })).toBe(false);
    expect(accepts({ type: 'object', $defs: shared })).toBe(false);
    expect(accepts({ type: 'object', properties: wide })).toBe(false);
    expect(Date.now() - started).toBeLessThan(2000);
  });
});
