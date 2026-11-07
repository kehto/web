/**
 * domains/llm-fixtures.ts — Seed connections, schema checks and canned
 * answers for the mock NAP-LLM service.
 *
 * Spec: naps/NAP-LLM.md @ napplet/naps PR #134 head 3e10939cf788 (draft) is
 * the base contract; PR #138 head 8f741326c111 (draft) adds tools, inference
 * controls (`maxTokens`, `temperature`, `samplingParams`), `thinking` and
 * `toolCall` parts, the `toolResult` role and block-aware deltas.
 * `@napplet/nap@0.32.0` ships no `llm` subpath, so the wire records are
 * declared here (drift: upstream 0.35 exports pr134-shaped types only).
 */

/**
 * Why a generation ended. Only `stop` is normal completion.
 *
 * @example
 * ```ts
 * const finish: MockLlmFinish = 'stop';
 * ```
 */
export type MockLlmFinish = 'stop' | 'length' | 'refusal' | 'toolUse';

/**
 * NAP-LLM error object carried in `error` of a result envelope.
 *
 * @example
 * ```ts
 * const failure: MockLlmFailure = { code: 'unsupported', message: 'No image input.' };
 * ```
 */
export interface MockLlmFailure {
  /** Stable failure category from the NAP-LLM error table. */
  code: string;
  /** Safe human-readable diagnostic. */
  message: string;
}

/**
 * A seeded connection the mock user may select. `id` never crosses the wire.
 *
 * @example
 * ```ts
 * const local = MOCK_LLM_CONNECTIONS[0];
 * local.tools === true;
 * ```
 */
export interface MockLlmConnection {
  /** Host-private identifier. */
  id: string;
  /** User-facing connection label. */
  name: string;
  /** Exact provider model identifier. */
  model: string;
  /** Disclosure route: intermediaries and destination, never credentials. */
  route: string;
  /** Accepts image input. */
  images: boolean;
  /** Supports JSON-object output. */
  json: boolean;
  /** Supports tool calling (pr138). */
  tools: boolean;
}

/**
 * Selection requirements (pr134 plus pr138 `tools`).
 *
 * @example
 * ```ts
 * const wanted: MockLlmRequirements = { json: true, tools: true };
 * ```
 */
export interface MockLlmRequirements {
  /** Exact model identifier. */
  model?: string;
  /** Require image input. */
  images?: boolean;
  /** Require JSON-object output. */
  json?: boolean;
  /** Require tool calling. */
  tools?: boolean;
}

/**
 * One content part (pr134 `text`/`image`; pr138 `thinking`/`toolCall`).
 *
 * @example
 * ```ts
 * const part: MockLlmPart = { type: 'text', text: 'Hello' };
 * ```
 */
export interface MockLlmPart {
  /** Record variant. */
  type: 'text' | 'image' | 'thinking' | 'toolCall';
  /** Text for `text`/`thinking`. */
  text?: string;
  /** Image encoding for `image`. */
  mimeType?: string;
  /** Padded base64 bytes for `image`. */
  data?: string;
  /** Stable call id for `toolCall`. */
  toolCallId?: string;
  /** Tool name for `toolCall`. */
  name?: string;
  /** Tool arguments for `toolCall`. */
  arguments?: Record<string, unknown>;
}

/**
 * One conversation message.
 *
 * @example
 * ```ts
 * const message: MockLlmMessage = { role: 'user', content: [{ type: 'text', text: 'Hi' }] };
 * ```
 */
export interface MockLlmMessage {
  /** Role; `toolResult` is a pr138 addition. */
  role: 'system' | 'user' | 'assistant' | 'toolResult';
  /** Ordered, non-empty parts. */
  content: MockLlmPart[];
  /** `toolResult` only: the call this answers. */
  toolCallId?: string;
  /** `toolResult` only: tool name. */
  toolName?: string;
  /** `toolResult` only: whether the tool failed. */
  isError?: boolean;
}

/**
 * A tool the model may call (pr138).
 *
 * @example
 * ```ts
 * const tool: MockLlmTool = { name: 'get_weather', parameters: { type: 'object' } };
 * ```
 */
export interface MockLlmTool {
  /** Tool name. */
  name: string;
  /** What the tool does. */
  description?: string;
  /** JSON Schema for the arguments. */
  parameters?: Record<string, unknown>;
}

/**
 * How the model selects tools (pr138).
 *
 * @example
 * ```ts
 * const choice: MockLlmToolChoice = { type: 'tool', name: 'get_weather' };
 * ```
 */
export type MockLlmToolChoice = 'auto' | 'none' | 'required' | { type: 'tool'; name: string };

/**
 * A validated GenerationRequest (pr134 fields plus pr138 additions).
 *
 * @example
 * ```ts
 * const request: MockLlmGenerationRequest = { handle: 'h-0123456789ab', messages: [], format: 'json' };
 * ```
 */
export interface MockLlmGenerationRequest {
  /** A live Model handle. */
  handle: string;
  /** Ordered conversation. */
  messages: MockLlmMessage[];
  /** Output format; defaults to `text`. */
  format?: 'text' | 'json';
  /** Output token limit. */
  maxTokens?: number;
  /** Sampling temperature. */
  temperature?: number;
  /** Provider-neutral sampling parameters (dropped by the mock). */
  samplingParams?: Record<string, unknown>;
  /** Tools the model may call. */
  tools?: MockLlmTool[];
  /** Tool selection policy. */
  toolChoice?: MockLlmToolChoice;
}

/**
 * A derived answer before streaming: its parts, flat text and finish reason.
 *
 * @example
 * ```ts
 * const answer: MockLlmAnswer = { text: 'Hi', parts: [{ type: 'text', text: 'Hi' }], finish: 'stop' };
 * ```
 */
export interface MockLlmAnswer {
  /** Flat text (empty for a tool call). */
  text: string;
  /** Content parts for the pr138 `content` list. */
  parts: MockLlmPart[];
  /** Finish reason. */
  finish: MockLlmFinish;
}

/**
 * Two seeded connections: a local, tool-capable text model and a hosted
 * vision model that cannot call tools.
 *
 * @example
 * ```ts
 * MOCK_LLM_CONNECTIONS.map((c) => c.model); // ['llama-3.1-8b-instruct-q4', 'mock-vision-70b']
 * ```
 */
export const MOCK_LLM_CONNECTIONS: readonly MockLlmConnection[] = Object.freeze([
  {
    id: 'local-llama',
    name: 'Local llama.cpp',
    model: 'llama-3.1-8b-instruct-q4',
    route: 'Mock shell → llama.cpp on this device',
    images: false,
    json: true,
    tools: true,
  },
  {
    id: 'hosted-vision',
    name: 'Hosted vision connection',
    model: 'mock-vision-70b',
    route: 'Mock shell → inference-proxy.example.org → provider.example.net',
    images: true,
    json: true,
    tools: false,
  },
]);

/**
 * Suffix every canned text answer ends with.
 *
 * @example
 * ```ts
 * answer.text.endsWith(MOCK_LLM_ANSWER_SUFFIX);
 * ```
 */
export const MOCK_LLM_ANSWER_SUFFIX = 'This is a deterministic mock completion; no provider was contacted.';

type Check = (value: unknown) => boolean;

const isText: Check = (value) => typeof value === 'string';
const isNonempty: Check = (value) => typeof value === 'string' && value.length > 0;
const isBool: Check = (value) => typeof value === 'boolean';
const isNonNegInt: Check = (value) => typeof value === 'number' && Number.isInteger(value) && value >= 0;
const isFinite: Check = (value) => typeof value === 'number' && Number.isFinite(value);
const isRecord: Check = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);
const oneOf = (...allowed: readonly string[]): Check => (value) => typeof value === 'string' && allowed.includes(value);
const BASE64 = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;
const isBase64: Check = (value) => typeof value === 'string' && value.length >= 4 && BASE64.test(value);
const list = (item: Check, min = 1): Check => (value) => Array.isArray(value) && value.length >= min && value.every(item);

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

const textPart = record({ type: oneOf('text', 'thinking'), text: isText });
const imagePart = record({ type: oneOf('image'), mimeType: oneOf('image/png', 'image/jpeg', 'image/webp'), data: isBase64 });
const toolCallPart = record({ type: oneOf('toolCall'), toolCallId: isNonempty, name: isNonempty, arguments: isRecord });
const part: Check = (value) => textPart(value) || imagePart(value) || toolCallPart(value);
const chatMessage = record({ role: oneOf('system', 'user', 'assistant'), content: list(part) });
const toolResultMessage = record(
  { role: oneOf('toolResult'), toolCallId: isNonempty, toolName: isNonempty, content: list(part) },
  { isError: isBool },
);
const message: Check = (value) => chatMessage(value) || toolResultMessage(value);
const tool = record({ name: isNonempty }, { description: isText, parameters: isRecord });
const toolChoice: Check = (value) => oneOf('auto', 'none', 'required')(value) || record({ type: oneOf('tool'), name: isNonempty })(value);
const requirements = record({}, { model: isNonempty, images: isBool, json: isBool, tools: isBool });
const generationRequest = record(
  { handle: isNonempty, messages: list(message) },
  {
    format: oneOf('text', 'json'),
    maxTokens: isNonNegInt,
    temperature: isFinite,
    samplingParams: isRecord,
    tools: list(tool, 0),
    toolChoice,
  },
);

function invalid(message: string): MockLlmFailure {
  return { code: 'invalid-request', message };
}

/** Every `toolCall` must be answered by exactly one later `toolResult`, and vice versa (pr138, LLM-C12). */
function toolPairingValid(messages: readonly MockLlmMessage[]): boolean {
  const open = new Set<string>();
  const seen = new Set<string>();
  for (const entry of messages) {
    if (entry.role === 'toolResult') {
      if (!entry.toolCallId || !open.delete(entry.toolCallId)) return false;
      continue;
    }
    if (entry.role !== 'assistant') continue;
    for (const item of entry.content) {
      if (item.type !== 'toolCall' || !item.toolCallId) continue;
      if (seen.has(item.toolCallId)) return false;
      seen.add(item.toolCallId);
      open.add(item.toolCallId);
    }
  }
  return open.size === 0;
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
 * Validate a GenerationRequest (pr134 schema plus pr138 additions).
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
  if (!toolPairingValid(request.messages)) return invalid('Every toolCall part must be answered by exactly one toolResult message.');
  if (request.toolChoice !== undefined && request.toolChoice !== 'none' && (request.tools?.length ?? 0) === 0) {
    return invalid('toolChoice requires at least one tool.');
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
 * Provider-specific input restrictions that must fail with `unsupported`
 * before any generation starts.
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
  const hasImage = request.messages.some((entry) => entry.content.some((item) => item.type === 'image'));
  if (hasImage && !connection.images) return { code: 'unsupported', message: 'This connection does not accept image input.' };
  if (request.format === 'json' && !connection.json) return { code: 'unsupported', message: 'This connection does not support JSON-object output.' };
  if ((request.tools?.length ?? 0) > 0 && !connection.tools) return { code: 'unsupported', message: 'This connection does not support tool calling.' };
  if (request.temperature !== undefined && (request.temperature < 0 || request.temperature > 2)) {
    return { code: 'unsupported', message: 'temperature must be between 0 and 2 for this connection.' };
  }
  return null;
}

function partsText(parts: readonly MockLlmPart[]): string {
  return parts.filter((item) => item.type === 'text').map((item) => item.text ?? '').join(' ').trim();
}

function lastUserText(messages: readonly MockLlmMessage[]): string {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const entry = messages[index];
    if (entry?.role === 'user') return partsText(entry.content);
  }
  return '';
}

function excerpt(text: string, max = 80): string {
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
}

function deriveArguments(tool: MockLlmTool, prompt: string): Record<string, unknown> {
  const properties = tool.parameters?.properties;
  if (!isRecord(properties)) return {};
  const out: Record<string, unknown> = {};
  for (const [key, schema] of Object.entries(properties as Record<string, unknown>)) {
    const kind = isRecord(schema) ? (schema as { type?: unknown }).type : undefined;
    if (kind === 'number' || kind === 'integer') out[key] = 1;
    else if (kind === 'boolean') out[key] = true;
    else if (kind === 'array') out[key] = [];
    else if (kind === 'object') out[key] = {};
    else out[key] = excerpt(prompt);
  }
  return out;
}

/**
 * Derive the deterministic answer for a request: a tool call when tools are
 * offered and not yet answered, a tool-aware sentence after a `toolResult`,
 * a JSON object for `format: "json"`, else a canned sentence quoting the
 * last user prompt.
 *
 * @param request - Validated generation request.
 * @param toolCallId - Id to stamp on a tool call part.
 * @returns The answer to stream.
 * @example
 * ```ts
 * deriveAnswer({ handle: 'h', messages: [{ role: 'user', content: [{ type: 'text', text: 'Hi' }] }] }, 'call_1').text;
 * // 'You asked: "Hi". This is a deterministic mock completion; no provider was contacted.'
 * ```
 */
export function deriveAnswer(request: MockLlmGenerationRequest, toolCallId: string): MockLlmAnswer {
  const last = request.messages[request.messages.length - 1];
  const prompt = lastUserText(request.messages);
  const tools = request.tools ?? [];
  const choice = request.toolChoice ?? 'auto';
  if (tools.length > 0 && choice !== 'none' && last?.role !== 'toolResult') {
    const forced = typeof choice === 'object' ? tools.find((item) => item.name === choice.name) : undefined;
    const chosen = forced ?? tools[0] as MockLlmTool;
    const part: MockLlmPart = { type: 'toolCall', toolCallId, name: chosen.name, arguments: deriveArguments(chosen, prompt) };
    return { text: '', parts: [part], finish: 'toolUse' };
  }
  let text: string;
  if (last?.role === 'toolResult') {
    const outcome = partsText(last.content);
    text = last.isError ? `The ${last.toolName} tool failed: ${outcome}` : `Using ${last.toolName}: ${outcome}`;
  } else if (request.format === 'json') {
    text = JSON.stringify({ answer: MOCK_LLM_ANSWER_SUFFIX, prompt: excerpt(prompt) });
  } else {
    text = `You asked: "${excerpt(prompt)}". ${MOCK_LLM_ANSWER_SUFFIX}`;
  }
  return { text, parts: [{ type: 'text', text }], finish: 'stop' };
}

/**
 * Split text into word-grouped delta chunks whose concatenation is the text.
 *
 * @param text - Text to split.
 * @param wordsPerDelta - Words per chunk. Default 3.
 * @returns Non-empty list of chunks.
 * @example
 * ```ts
 * splitDeltas('a b c d', 3); // ['a b c', ' d']
 * ```
 */
export function splitDeltas(text: string, wordsPerDelta = 3): string[] {
  const size = Math.max(1, Math.floor(wordsPerDelta));
  const words = text.split(' ');
  const out: string[] = [];
  for (let index = 0; index < words.length; index += size) {
    const chunk = words.slice(index, index + size).join(' ');
    out.push(index === 0 ? chunk : ` ${chunk}`);
  }
  return out;
}

/**
 * Rough token estimate (four characters per token), used for `usage`.
 *
 * @param text - Any text.
 * @returns Non-negative integer.
 * @example
 * ```ts
 * estimateTokens('abcdefgh') === 2;
 * ```
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Flatten every text part of a conversation for input-token accounting.
 *
 * @param request - Validated generation request.
 * @returns Joined input text.
 * @example
 * ```ts
 * requestInputText({ handle: 'h', messages: [{ role: 'user', content: [{ type: 'text', text: 'Hi' }] }] }) === 'Hi';
 * ```
 */
export function requestInputText(request: MockLlmGenerationRequest): string {
  return request.messages.map((entry) => partsText(entry.content)).join('\n');
}
