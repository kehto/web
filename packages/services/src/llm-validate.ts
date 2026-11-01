/**
 * NAP-LLM input schema checks (napplet/naps PR #134, Schemas).
 *
 * Unknown fields, explicit `null`, wrong types and invalid base64 are
 * `invalid-request`. Optional fields may be omitted. These checks describe the
 * napplet's request; policy limits, handle ownership and consent live in the
 * service.
 */

import type { LlmGeneration, LlmGenerationRequest, LlmMessage, LlmRequirements, LlmUsage } from './llm-types.js';

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

function exactRecord(required: Fields, optional: Fields = {}): Check {
  return (value) => {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
    const data = value as Record<string, unknown>;
    if (Object.keys(data).some((key) => !(key in required) && !(key in optional))) return false;
    return Object.entries(required).every(([key, check]) => check(data[key]))
      && Object.entries(optional).every(([key, check]) => data[key] === undefined || check(data[key]));
  };
}

const nonemptyList = (item: Check): Check => (value) => Array.isArray(value) && value.length > 0 && value.every(item);

const textPart = exactRecord({ type: oneOf('text'), text });
const imagePart = exactRecord({ type: oneOf('image'), mimeType: oneOf('image/png', 'image/jpeg', 'image/webp'), data: base64 });
const part: Check = (value) => textPart(value) || imagePart(value);
const message = exactRecord({ role: oneOf('system', 'user', 'assistant'), content: nonemptyList(part) });
const requirements = exactRecord({}, { model: nonemptyText, images: boolean, json: boolean });
const generationRequest = exactRecord({ handle: nonemptyText, messages: nonemptyList(message) }, { format: oneOf('text', 'json') });
const usage = exactRecord({ inputTokens: nonNegativeInteger, outputTokens: nonNegativeInteger });
const generation = exactRecord({ text, finish: oneOf('stop', 'length', 'refusal') }, { usage });

/** True for a well-formed optional Requirements record (omission allowed, `null` rejected). */
export function isLlmRequirements(value: unknown): value is LlmRequirements | undefined {
  return value === undefined || requirements(value);
}

/** True for a well-formed GenerationRequest record. */
export const isLlmGenerationRequest = generationRequest as (value: unknown) => value is LlmGenerationRequest;

/** True for a well-formed Generation record returned by a provider adapter. */
export const isLlmGeneration = generation as (value: unknown) => value is LlmGeneration;

/** True for a well-formed Usage record. */
export const isLlmUsage = usage as (value: unknown) => value is LlmUsage;

/** True for non-empty request text usable as a correlation id or handle. */
export const isNonemptyText = nonemptyText as (value: unknown) => value is string;

/** Count inline image parts across a conversation. */
export function countLlmImages(messages: readonly LlmMessage[]): number {
  let count = 0;
  for (const entry of messages) for (const item of entry.content) if (item.type === 'image') count += 1;
  return count;
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
