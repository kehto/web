/**
 * domains/llm-fixtures.ts — Wire records, seed connections and canned
 * answers for the mock NAP-LLM service.
 *
 * Spec: naps/NAP-LLM.md @ napplet/naps PR #134 head 5e93bdfce0e8 (draft).
 * That head folds in PR #138 (tools, inference controls, thinking and
 * toolCall parts, the toolResult role, block lifecycle deltas). Request
 * checks live in `llm-validate.ts`. `@napplet/nap@0.32.0` ships no `llm`
 * subpath, so the wire records are declared here.
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
  /** Supports tool calling. */
  tools: boolean;
  /** Supported tool-choice modes; empty when `tools` is false, else at least `auto` and `none`. */
  toolChoiceModes: readonly MockLlmToolChoiceMode[];
}

/**
 * A tool-choice mode a connection may support; `tool` is named-tool forcing.
 *
 * @example
 * ```ts
 * const mode: MockLlmToolChoiceMode = 'required';
 * ```
 */
export type MockLlmToolChoiceMode = 'auto' | 'none' | 'required' | 'tool';

/**
 * Selection requirements.
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
 * One content part. `thinking` and `toolCall` belong to assistant messages only.
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
  /** Message role. */
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
 * A tool the model may call.
 *
 * @example
 * ```ts
 * const tool: MockLlmTool = { name: 'get_weather', parameters: { type: 'object' } };
 * ```
 */
export interface MockLlmTool {
  /** Portable tool name matching `^[A-Za-z0-9_-]{1,64}$`. */
  name: string;
  /** What the tool does. */
  description?: string;
  /** JSON Schema with root `type: "object"`. */
  parameters?: Record<string, unknown>;
}

/**
 * How the model selects tools.
 *
 * @example
 * ```ts
 * const choice: MockLlmToolChoice = { type: 'tool', name: 'get_weather' };
 * ```
 */
export type MockLlmToolChoice = 'auto' | 'none' | 'required' | { type: 'tool'; name: string };

/**
 * A validated GenerationRequest.
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
  /** Positive output token limit. */
  maxTokens?: number;
  /** Sampling temperature. */
  temperature?: number;
  /** Tools the model may call. */
  tools?: MockLlmTool[];
  /** Tool selection policy. */
  toolChoice?: MockLlmToolChoice;
}

/**
 * A derived answer before streaming: its content parts and finish reason.
 *
 * @example
 * ```ts
 * const answer: MockLlmAnswer = { parts: [{ type: 'text', text: 'Hi' }], finish: 'stop' };
 * ```
 */
export interface MockLlmAnswer {
  /** Terminal `content`: text or toolCall parts. */
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
    toolChoiceModes: ['auto', 'none', 'required', 'tool'],
  },
  {
    id: 'hosted-vision',
    name: 'Hosted vision connection',
    model: 'mock-vision-70b',
    route: 'Mock shell → inference-proxy.example.org → provider.example.net',
    images: true,
    json: true,
    tools: false,
    toolChoiceModes: [],
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
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
 * offered and the turn is not answering a tool result (always, under
 * `required` or a named choice), a tool-aware sentence after a `toolResult`,
 * a JSON object for `format: "json"`, else a canned sentence quoting the last
 * user prompt. A turn with a call always finishes `toolUse`.
 *
 * @param request - Validated generation request.
 * @param toolCallId - Id to stamp on a tool call part.
 * @returns The answer to stream.
 * @example
 * ```ts
 * deriveAnswer({ handle: 'h', messages: [{ role: 'user', content: [{ type: 'text', text: 'Hi' }] }] }, 'call_1').parts[0]?.text;
 * // 'You asked: "Hi". This is a deterministic mock completion; no provider was contacted.'
 * ```
 */
export function deriveAnswer(request: MockLlmGenerationRequest, toolCallId: string): MockLlmAnswer {
  const last = request.messages[request.messages.length - 1];
  const prompt = lastUserText(request.messages);
  const tools = request.tools ?? [];
  const choice = request.toolChoice ?? 'auto';
  const mustCall = choice === 'required' || typeof choice === 'object';
  if (tools.length > 0 && choice !== 'none' && (mustCall || last?.role !== 'toolResult')) {
    const forced = typeof choice === 'object' ? tools.find((item) => item.name === choice.name) : undefined;
    const chosen = forced ?? tools[0] as MockLlmTool;
    const part: MockLlmPart = { type: 'toolCall', toolCallId, name: chosen.name, arguments: deriveArguments(chosen, prompt) };
    return { parts: [part], finish: 'toolUse' };
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
  return { parts: [{ type: 'text', text }], finish: 'stop' };
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
