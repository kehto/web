/**
 * domains/llm-validate.ts — Request checks for the mock NAP-LLM service.
 *
 * Spec: naps/NAP-LLM.md @ napplet/naps PR #134 head 5e93bdfce0e8 (draft),
 * Schemas. Mirrors the rules `@kehto/services` enforces at the same head:
 * exact records, role-specific parts, portable tool names, explicit choices
 * against listed tools, adjacent tool results, then connection capabilities.
 *
 * Spec gap / decision: `parameters` is checked for a plain JSON object with
 * root `type: "object"`, not against the full JSON Schema 2020-12
 * meta-schema. Use `@kehto/services` when a test needs that check.
 */
import type {
  MockLlmConnection,
  MockLlmFailure,
  MockLlmGenerationRequest,
  MockLlmMessage,
  MockLlmPart,
  MockLlmRequirements,
  MockLlmToolChoiceMode,
} from './llm-fixtures.js';

type Check = (value: unknown) => boolean;

const isText: Check = (value) => typeof value === 'string';
const isNonempty: Check = (value) => typeof value === 'string' && value.length > 0;
const isBool: Check = (value) => typeof value === 'boolean';
const isPositiveInt: Check = (value) => typeof value === 'number' && Number.isInteger(value) && value > 0;
const isFinite: Check = (value) => typeof value === 'number' && Number.isFinite(value);
const isRecord: Check = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);
const oneOf = (...allowed: readonly string[]): Check => (value) => typeof value === 'string' && allowed.includes(value);
const BASE64 = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;
const isBase64: Check = (value) => typeof value === 'string' && value.length >= 4 && BASE64.test(value);
const nonemptyList = (item: Check): Check => (value) => Array.isArray(value) && value.length > 0 && value.every(item);
const TOOL_NAME = /^[A-Za-z0-9_-]{1,64}$/;

/** Plain JSON data: no cycles, functions, non-finite numbers or class instances. */
function isJson(value: unknown, depth = 0): boolean {
  if (depth > 64) return false;
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (Array.isArray(value)) return value.every((entry) => isJson(entry, depth + 1));
  if (!isRecord(value) || Object.getPrototypeOf(value) !== Object.prototype) return false;
  return Object.values(value as Record<string, unknown>).every((entry) => isJson(entry, depth + 1));
}
const isJsonObject: Check = (value) => isRecord(value) && isJson(value);

/** Exact record: unknown keys, explicit `null` and wrong types all fail. */
function record(required: Record<string, Check>, optional: Record<string, Check> = {}): Check {
  return (value) => {
    if (!isRecord(value)) return false;
    const data = value as Record<string, unknown>;
    for (const key of Object.keys(data)) {
      if (!Object.hasOwn(required, key) && !Object.hasOwn(optional, key)) return false;
    }
    return Object.entries(required).every(([key, check]) => check(data[key]))
      && Object.entries(optional).every(([key, check]) => data[key] === undefined || check(data[key]));
  };
}

const textPart = record({ type: oneOf('text'), text: isText });
const thinkingPart = record({ type: oneOf('thinking'), text: isText });
const imagePart = record({ type: oneOf('image'), mimeType: oneOf('image/png', 'image/jpeg', 'image/webp'), data: isBase64 });
const toolCallPart = record({ type: oneOf('toolCall'), toolCallId: isNonempty, name: isNonempty, arguments: isJsonObject });
const inputPart: Check = (value) => textPart(value) || imagePart(value);
const assistantPart: Check = (value) => inputPart(value) || thinkingPart(value) || toolCallPart(value);
const plainMessage = record({ role: oneOf('system', 'user'), content: nonemptyList(inputPart) });
const assistantMessage = record({ role: oneOf('assistant'), content: nonemptyList(assistantPart) });
const toolResultMessage = record(
  { role: oneOf('toolResult'), toolCallId: isNonempty, toolName: isNonempty, content: nonemptyList(inputPart) },
  { isError: isBool },
);
const message: Check = (value) => plainMessage(value) || assistantMessage(value) || toolResultMessage(value);
const toolParameters: Check = (value) => isJsonObject(value) && (value as Record<string, unknown>).type === 'object';
const tool = record({ name: (value) => typeof value === 'string' && TOOL_NAME.test(value) }, { description: isText, parameters: toolParameters });
const toolChoice: Check = (value) => oneOf('auto', 'none', 'required')(value) || record({ type: oneOf('tool'), name: isNonempty })(value);
const requirements = record({}, { model: isNonempty, images: isBool, json: isBool, tools: isBool });
const generationRequest = record(
  { handle: isNonempty, messages: nonemptyList(message) },
  {
    format: oneOf('text', 'json'),
    maxTokens: isPositiveInt,
    temperature: isFinite,
    tools: (value) => Array.isArray(value) && value.every(tool),
    toolChoice,
  },
);

function invalid(text: string): MockLlmFailure {
  return { code: 'invalid-request', message: text };
}

function unsupported(text: string): MockLlmFailure {
  return { code: 'unsupported', message: text };
}

function callsOf(entry: MockLlmMessage): MockLlmPart[] {
  return entry.role === 'assistant' ? entry.content.filter((item) => item.type === 'toolCall') : [];
}

/**
 * Call ids are unique across the conversation; each assistant turn's calls are
 * answered immediately after it, one name-matching result per call in any
 * order; no result appears anywhere else (LLM-C12, LLM-C21).
 */
function toolHistoryValid(messages: readonly MockLlmMessage[]): boolean {
  const seen = new Set<string>();
  let index = 0;
  while (index < messages.length) {
    const turn = messages[index] as MockLlmMessage;
    index += 1;
    if (turn.role === 'toolResult') return false;
    const calls = callsOf(turn);
    const pending = new Map<string, string | undefined>();
    for (const call of calls) {
      const id = call.toolCallId as string;
      if (seen.has(id)) return false;
      seen.add(id);
      pending.set(id, call.name);
    }
    for (let answered = 0; answered < calls.length; answered += 1) {
      const result = messages[index + answered];
      if (result?.role !== 'toolResult' || !pending.has(result.toolCallId as string) || pending.get(result.toolCallId as string) !== result.toolName) return false;
      pending.delete(result.toolCallId as string);
    }
    index += calls.length;
  }
  return true;
}

/**
 * The tool-choice mode a request asks for, or `null` when it sends no tools.
 *
 * @param request - Validated generation request.
 * @returns `auto` for tools without a choice, `tool` for a named choice.
 * @example
 * ```ts
 * mockToolChoiceMode({ handle: 'h', messages: [], tools: [{ name: 'get_weather' }] }) === 'auto';
 * ```
 */
export function mockToolChoiceMode(request: MockLlmGenerationRequest): MockLlmToolChoiceMode | null {
  if ((request.tools ?? []).length === 0) return null;
  if (request.toolChoice === undefined) return 'auto';
  return typeof request.toolChoice === 'string' ? request.toolChoice : 'tool';
}

/**
 * Validate an optional Requirements record. Omission is fine; `null`,
 * unknown fields and wrong types are `invalid-request`.
 *
 * @param value - The `requirements` field of `llm.select`.
 * @returns A failure or `null` when valid.
 * @example
 * ```ts
 * validateRequirements({ json: true }) === null;
 * validateRequirements(null)?.code === 'invalid-request';
 * ```
 */
export function validateRequirements(value: unknown): MockLlmFailure | null {
  if (value === undefined || requirements(value)) return null;
  return invalid('requirements must be a Requirements record.');
}

/**
 * Validate a GenerationRequest: the exact record shape, then unique tool
 * names, explicit choices against listed tools, and the tool history.
 *
 * @param value - The `request` field of `llm.generate`.
 * @returns A failure or `null` when valid.
 * @example
 * ```ts
 * validateGenerationRequest({ handle: 'h1', messages: [{ role: 'user', content: [{ type: 'text', text: 'hi' }] }] }) === null;
 * ```
 */
export function validateGenerationRequest(value: unknown): MockLlmFailure | null {
  if (!generationRequest(value)) return invalid('request must be a GenerationRequest record.');
  const request = value as MockLlmGenerationRequest;
  const names = (request.tools ?? []).map((item) => item.name);
  if (new Set(names).size !== names.length) return invalid('Tool names must be unique.');
  if (request.toolChoice !== undefined) {
    if (names.length === 0) return invalid('toolChoice requires a non-empty tools list.');
    if (typeof request.toolChoice === 'object' && !names.includes(request.toolChoice.name)) return invalid('A forced tool must appear in tools.');
  }
  if (!toolHistoryValid(request.messages)) {
    return invalid('Every toolCall must be answered by one matching toolResult immediately after its assistant turn.');
  }
  return null;
}

/**
 * Whether a connection satisfies selection requirements.
 *
 * @param connection - Candidate connection.
 * @param wanted - Validated requirements.
 * @returns `true` when every required capability is present.
 * @example
 * ```ts
 * meetsRequirements(MOCK_LLM_CONNECTIONS[0], { tools: true }) === true;
 * ```
 */
export function meetsRequirements(connection: MockLlmConnection, wanted: MockLlmRequirements): boolean {
  if (wanted.model !== undefined && wanted.model !== connection.model) return false;
  if (wanted.images === true && !connection.images) return false;
  if (wanted.json === true && !connection.json) return false;
  return !(wanted.tools === true && !connection.tools);
}

/**
 * Connection restrictions that must fail with `unsupported` before any
 * generation starts: tools, tool-choice mode, tool history, images (tool
 * results included), JSON output, then the mock's temperature range.
 *
 * @param connection - The selected connection.
 * @param request - Validated generation request.
 * @returns A failure or `null`.
 * @example
 * ```ts
 * unsupportedInput(MOCK_LLM_CONNECTIONS[0], { handle: 'h', messages: [], format: 'json' }) === null;
 * ```
 */
export function unsupportedInput(connection: MockLlmConnection, request: MockLlmGenerationRequest): MockLlmFailure | null {
  const mode = mockToolChoiceMode(request);
  if (mode !== null && !connection.tools) return unsupported('This connection does not support tool calling.');
  if (mode !== null && !connection.toolChoiceModes.includes(mode)) return unsupported(`This connection does not support the "${mode}" tool choice.`);
  const history = request.messages.some((entry) => entry.role === 'toolResult' || entry.content.some((item) => item.type === 'toolCall'));
  if (history && !connection.tools) return unsupported('This connection does not accept tool calls or tool results.');
  const hasImage = request.messages.some((entry) => entry.content.some((item) => item.type === 'image'));
  if (hasImage && !connection.images) return unsupported('This connection does not accept image input.');
  if (request.format === 'json' && !connection.json) return unsupported('This connection does not support JSON-object output.');
  if (request.temperature !== undefined && (request.temperature < 0 || request.temperature > 2)) {
    return unsupported('temperature must be between 0 and 2 for this connection.');
  }
  return null;
}
