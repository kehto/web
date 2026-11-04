/**
 * NAP-LLM input schema checks (napplet/naps PR #134 at
 * 5e93bdfce0e84c0de728234cb7b3feed498f8635, Schemas).
 *
 * Unknown fields, explicit `null`, wrong types and invalid base64 are
 * `invalid-request`. Optional fields may be omitted. These checks describe the
 * napplet's request; policy limits, handle ownership and consent live in the
 * service.
 *
 * `parameters` and `arguments` are the first napplet-supplied free-form values.
 * postMessage's structured clone can deliver cycles, heavily shared subgraphs
 * and non-plain objects, so they pass {@link isJsonValue} (a depth bound and a
 * visit budget) before anything inspects or serializes them.
 */

import type { LlmGeneration, LlmGenerationRequest, LlmMessage, LlmOutputPart, LlmRequirements, LlmToolCallPart, LlmToolChoiceMode, LlmUsage } from './llm-types.js';

type Check = (value: unknown) => boolean;
type Fields = Record<string, Check>;

const text: Check = (value) => typeof value === 'string';
const nonemptyText: Check = (value) => typeof value === 'string' && value.length > 0;
const boolean: Check = (value) => typeof value === 'boolean';
const oneOf = (...allowed: readonly string[]): Check => (value) => typeof value === 'string' && allowed.includes(value);
/** RFC 4648 standard alphabet, padded, no whitespace, at least one quantum. */
const base64: Check = (value) =>
  typeof value === 'string'
  && value.length >= 4
  && /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value);
const nonNegativeInteger: Check = (value) => typeof value === 'number' && Number.isInteger(value) && value >= 0;
const positiveInteger: Check = (value) => typeof value === 'number' && Number.isInteger(value) && value > 0;
const finiteNumber: Check = (value) => typeof value === 'number' && Number.isFinite(value);

/** Deepest JSON nesting accepted in `parameters` and `arguments`. */
const MAX_JSON_DEPTH = 64;
/** Total values visited per free-form value; a shared subgraph walked as a tree exhausts it. */
const MAX_JSON_NODES = 50_000;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const prototype: unknown = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

/**
 * True for plain JSON data: objects, arrays, strings, booleans, null and finite
 * numbers. Cycles fail the depth bound, heavily shared subgraphs fail the visit
 * budget, and functions, symbols, `undefined`, non-finite numbers and class
 * instances are rejected.
 */
export function isJsonValue(value: unknown): boolean {
  let budget = MAX_JSON_NODES;
  const visit = (current: unknown, depth: number): boolean => {
    if ((budget -= 1) < 0 || depth > MAX_JSON_DEPTH) return false;
    if (current === null || typeof current === 'string' || typeof current === 'boolean') return true;
    if (typeof current === 'number') return Number.isFinite(current);
    if (Array.isArray(current)) return current.every((entry) => visit(entry, depth + 1));
    return isPlainObject(current) && Object.values(current).every((entry) => visit(entry, depth + 1));
  };
  return visit(value, 0);
}

/** A JSON object (not an array or scalar) passing {@link isJsonValue}. */
const jsonObject: Check = (value) => isPlainObject(value) && isJsonValue(value);

function hasKey(record: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(record, key);
}

function exactRecord(required: Fields, optional: Fields = {}): Check {
  return (value) => {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
    const data = value as Record<string, unknown>;
    if (Object.keys(data).some((key) => !hasKey(required, key) && !hasKey(optional, key))) return false;
    return Object.entries(required).every(([key, check]) => check(data[key]))
      && Object.entries(optional).every(([key, check]) => data[key] === undefined || check(data[key]));
  };
}

const nonemptyList = (item: Check): Check => (value) => Array.isArray(value) && value.length > 0 && value.every(item);

const textPart = exactRecord({ type: oneOf('text'), text });
const imagePart = exactRecord({ type: oneOf('image'), mimeType: oneOf('image/png', 'image/jpeg', 'image/webp'), data: base64 });
const thinkingPart = exactRecord({ type: oneOf('thinking'), text });
const toolCallPart = exactRecord({ type: oneOf('toolCall'), toolCallId: nonemptyText, name: nonemptyText, arguments: jsonObject });
const inputPart: Check = (value) => textPart(value) || imagePart(value);
const assistantPart: Check = (value) => inputPart(value) || thinkingPart(value) || toolCallPart(value);
const resultPart: Check = inputPart;
const plainMessage = exactRecord({ role: oneOf('system', 'user'), content: nonemptyList(inputPart) });
const assistantMessage = exactRecord({ role: oneOf('assistant'), content: nonemptyList(assistantPart) });
const toolResultMessage = exactRecord(
  { role: oneOf('toolResult'), content: nonemptyList(resultPart), toolCallId: nonemptyText, toolName: nonemptyText },
  { isError: boolean },
);
/** Role-discriminated message: placement rules for thinking, toolCall and the toolResult fields live in the variants. */
const message: Check = (value) => plainMessage(value) || assistantMessage(value) || toolResultMessage(value);

const requirements = exactRecord({}, { model: nonemptyText, images: boolean, json: boolean, tools: boolean });

const SCHEMA_TYPES = new Set(['string', 'number', 'integer', 'boolean', 'object', 'array', 'null']);
/** Schema nesting bound; deeper schemas are treated as malformed. */
const MAX_SCHEMA_DEPTH = 32;
const SCHEMA_MAPS = ['properties', 'patternProperties', '$defs'] as const;
const SCHEMA_SINGLES = ['items', 'additionalProperties', 'not', 'contains', 'propertyNames', 'if', 'then', 'else'] as const;
const SCHEMA_LISTS = ['allOf', 'anyOf', 'oneOf', 'prefixItems'] as const;

function validSchemaType(type: unknown): boolean {
  if (typeof type === 'string') return SCHEMA_TYPES.has(type);
  return Array.isArray(type) && type.length > 0 && type.every((entry) => typeof entry === 'string' && SCHEMA_TYPES.has(entry));
}

/**
 * Dependency-free structural check of the JSON Schema 2020-12 keywords NAP-LLM
 * can rely on: `type` values, `properties`/`$defs` maps of schemas, a single
 * `items` schema, `required` as a string list, `enum` as a list, and
 * `allOf`/`anyOf`/`oneOf` as schema lists. Booleans are schemas. Unknown
 * keywords pass, since JSON Schema keywords are not unknown record fields.
 */
function isSchema(value: unknown, depth: number): boolean {
  if (typeof value === 'boolean') return true;
  if (depth > MAX_SCHEMA_DEPTH || !isPlainObject(value)) return false;
  const sub = (entry: unknown): boolean => isSchema(entry, depth + 1);
  if (value.type !== undefined && !validSchemaType(value.type)) return false;
  for (const key of SCHEMA_MAPS) {
    const entry = value[key];
    if (entry !== undefined && !(isPlainObject(entry) && Object.values(entry).every(sub))) return false;
  }
  for (const key of SCHEMA_SINGLES) if (value[key] !== undefined && !sub(value[key])) return false;
  for (const key of SCHEMA_LISTS) {
    const entry = value[key];
    if (entry !== undefined && !(Array.isArray(entry) && entry.length > 0 && entry.every(sub))) return false;
  }
  if (value.required !== undefined && !(Array.isArray(value.required) && value.required.every((name) => typeof name === 'string'))) return false;
  return value.enum === undefined || Array.isArray(value.enum);
}

/** Tool `parameters`: a JSON object, structurally a schema, with root `type: "object"`. */
const toolParameters: Check = (value) => isPlainObject(value) && isJsonValue(value) && value.type === 'object' && isSchema(value, 0);
const toolName: Check = (value) => typeof value === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(value);
const tool = exactRecord({ name: toolName }, { description: text, parameters: toolParameters });
const namedToolChoice = exactRecord({ type: oneOf('tool'), name: nonemptyText });
const toolChoice: Check = (value) => oneOf('auto', 'none', 'required')(value) || namedToolChoice(value);
const generationFields = exactRecord(
  { handle: nonemptyText, messages: nonemptyList(message) },
  {
    format: oneOf('text', 'json'),
    maxTokens: positiveInteger,
    temperature: finiteNumber,
    tools: (value) => Array.isArray(value) && value.every(tool),
    toolChoice,
  },
);

function callsOf(turn: LlmMessage): LlmToolCallPart[] {
  return turn.role === 'assistant' ? turn.content.filter((entry): entry is LlmToolCallPart => entry.type === 'toolCall') : [];
}

/**
 * Walk the conversation for the tool-history rules: call ids are unique across
 * the conversation, results immediately follow their assistant turn, each call
 * has exactly one name-matching result in any order, and the conversation does
 * not end on unanswered calls.
 */
function validToolHistory(messages: readonly LlmMessage[]): boolean {
  const seen = new Set<string>();
  let index = 0;
  while (index < messages.length) {
    const turn = messages[index]!;
    index += 1;
    if (turn.role === 'toolResult') return false;
    const calls = callsOf(turn);
    for (const call of calls) {
      if (seen.has(call.toolCallId)) return false;
      seen.add(call.toolCallId);
    }
    const pending = new Map(calls.map((call) => [call.toolCallId, call.name]));
    for (let answered = 0; answered < calls.length; answered += 1) {
      const result = messages[index + answered];
      if (result?.role !== 'toolResult' || result.toolCallId === undefined || pending.get(result.toolCallId) !== result.toolName) return false;
      pending.delete(result.toolCallId);
    }
    index += calls.length;
  }
  return true;
}

/** Cross-field rules: unique tool names, explicit choices against listed tools, and tool history. */
function validRequestRelations(request: LlmGenerationRequest): boolean {
  const names = (request.tools ?? []).map((entry) => entry.name);
  if (new Set(names).size !== names.length) return false;
  if (request.toolChoice !== undefined) {
    if (names.length === 0) return false;
    if (typeof request.toolChoice === 'object' && !names.includes(request.toolChoice.name)) return false;
  }
  return validToolHistory(request.messages);
}
const usage = exactRecord(
  { inputTokens: nonNegativeInteger, outputTokens: nonNegativeInteger },
  { cacheReadTokens: nonNegativeInteger, cacheWriteTokens: nonNegativeInteger, reasoningTokens: nonNegativeInteger },
);
const outputPart: Check = (value) => textPart(value) || thinkingPart(value) || toolCallPart(value);
const generation = exactRecord(
  { content: (value) => Array.isArray(value) && value.every(outputPart), finish: oneOf('stop', 'length', 'refusal', 'toolUse') },
  { usage },
);

/** True for a well-formed optional Requirements record (omission allowed, `null` rejected). */
export function isLlmRequirements(value: unknown): value is LlmRequirements | undefined {
  return value === undefined || requirements(value);
}

/** True for a well-formed GenerationRequest record, including tool and history relations. */
export function isLlmGenerationRequest(value: unknown): value is LlmGenerationRequest {
  return generationFields(value) && validRequestRelations(value as LlmGenerationRequest);
}

/** True for a well-formed Generation record returned by a provider adapter. */
export const isLlmGeneration = generation as (value: unknown) => value is LlmGeneration;

/** True for a well-formed Usage record. */
export const isLlmUsage = usage as (value: unknown) => value is LlmUsage;

/** Concatenate the text parts of terminal content in order (the `format: "json"` input). */
export function llmTextOf(content: readonly LlmOutputPart[]): string {
  return content.map((part) => part.type === 'text' ? part.text : '').join('');
}

/** True for non-empty request text usable as a correlation id or handle. */
export const isNonemptyText = nonemptyText as (value: unknown) => value is string;

/** Count inline image parts across a conversation, tool results included. */
export function countLlmImages(messages: readonly LlmMessage[]): number {
  let count = 0;
  for (const entry of messages) for (const item of entry.content) if (item.type === 'image') count += 1;
  return count;
}

/** True when the conversation carries historical `toolCall` parts or `toolResult` messages. */
export function hasLlmToolHistory(messages: readonly LlmMessage[]): boolean {
  return messages.some((entry) => entry.role === 'toolResult' || entry.content.some((item) => item.type === 'toolCall'));
}

/**
 * The tool-choice mode a request asks for, or `null` when it sends no tools:
 * an absent choice with tools is `auto`, a named choice is `tool`.
 */
export function llmToolChoiceMode(request: LlmGenerationRequest): LlmToolChoiceMode | null {
  if ((request.tools ?? []).length === 0) return null;
  if (request.toolChoice === undefined) return 'auto';
  return typeof request.toolChoice === 'string' ? request.toolChoice : 'tool';
}

/** True when a completed `format: "json"` text parses as a JSON object (not array or scalar). */
export function isJsonObjectText(value: string): boolean {
  try {
    const parsed: unknown = JSON.parse(value);
    return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed);
  } catch {
    return false;
  }
}
