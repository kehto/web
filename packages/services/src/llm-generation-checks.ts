/**
 * Request-side capability checks and terminal/stream validation for the NAP-LLM
 * reference service (napplet/naps PR #134 at
 * 5e93bdfce0e84c0de728234cb7b3feed498f8635).
 *
 * Hosts are pluggable, so the service re-checks what any adapter returns:
 * terminal normalisation and validation, the block lifecycle of streamed
 * deltas, and the match between streamed blocks and the authoritative result.
 * Nothing here executes a tool call; a call is validated and relayed only.
 */

import type {
  LlmBlockEvent,
  LlmDeltaBlock,
  LlmFailure,
  LlmGeneration,
  LlmGenerationRequest,
  LlmOutputPart,
  LlmToolCallPart,
  LlmToolChoiceMode,
} from './llm-types.js';
import {
  countLlmImages,
  hasLlmToolHistory,
  isJsonObjectText,
  isLlmGeneration,
  llmTextOf,
  llmToolChoiceMode,
} from './llm-validate.js';

/** The slice of a connection these checks read. */
export interface LlmCapabilities {
  readonly images: boolean;
  readonly json: boolean;
  readonly tools: boolean;
  readonly toolChoiceModes: readonly LlmToolChoiceMode[];
}

const MALFORMED: LlmFailure = { code: 'provider-error', message: 'The provider returned an incomplete or malformed completion.' };
const LIFECYCLE: LlmFailure = { code: 'provider-error', message: 'The provider streamed output that breaks the block lifecycle.' };
const MISMATCH: LlmFailure = { code: 'provider-error', message: 'The provider result does not match its streamed blocks.' };
const BAD_CALL: LlmFailure = { code: 'provider-error', message: 'The provider returned an invalid tool call.' };
const BAD_MODE: LlmFailure = { code: 'provider-error', message: 'The provider result does not honour the requested tool choice.' };
const NO_JSON: LlmFailure = { code: 'provider-error', message: 'The provider completed without a JSON object.' };

function unsupported(message: string): LlmFailure {
  return { code: 'unsupported', message };
}

/**
 * Compare the request against the selected connection. Checked in order: tools,
 * tool-choice mode, historical tool parts, images (tool results included), then
 * JSON output. Returns `null` when the connection can serve the request.
 */
export function unsupportedInput(connection: LlmCapabilities, request: LlmGenerationRequest): LlmFailure | null {
  const mode = llmToolChoiceMode(request);
  if (mode !== null && !connection.tools) return unsupported('This connection does not support tool calling.');
  if (mode !== null && !connection.toolChoiceModes.includes(mode)) return unsupported(`This connection does not support the "${mode}" tool choice.`);
  if (hasLlmToolHistory(request.messages) && !connection.tools) return unsupported('This connection does not accept tool calls or tool results.');
  if (countLlmImages(request.messages) > 0 && !connection.images) return unsupported('This connection does not accept image input.');
  if (request.format === 'json' && !connection.json) return unsupported('This connection does not support JSON-object output.');
  return null;
}

type BlockState = {
  readonly kind: LlmDeltaBlock;
  open: boolean;
  text: string;
  readonly toolCallId?: string;
  readonly name?: string;
};

/** Validates a generation's block lifecycle and remembers what streamed. */
export interface LlmDeltaTracker {
  /** Record one host event; `false` when it violates the lifecycle. */
  accept(event: LlmBlockEvent): boolean;
  /** Check every streamed block against the terminal content of a successful turn. */
  matches(content: readonly LlmOutputPart[]): boolean;
}

const EVENTS = new Set(['start', 'delta', 'end']);
const BLOCKS = new Set(['text', 'thinking', 'toolCall']);
const nonEmpty = (value: unknown): value is string => typeof value === 'string' && value.length > 0;

/** Deep JSON equality independent of object key order. */
function jsonEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  if (Array.isArray(a) || Array.isArray(b)) {
    return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((entry, index) => jsonEqual(entry, b[index]));
  }
  const left = a as Record<string, unknown>;
  const right = b as Record<string, unknown>;
  const keys = Object.keys(left);
  return keys.length === Object.keys(right).length && keys.every((key) => Object.prototype.hasOwnProperty.call(right, key) && jsonEqual(left[key], right[key]));
}

function validStart(event: LlmBlockEvent): boolean {
  if (event.text !== undefined) return false;
  if (event.block === 'toolCall') return nonEmpty(event.toolCallId) && nonEmpty(event.name);
  return event.toolCallId === undefined && event.name === undefined;
}

/**
 * Create the lifecycle tracker for one generation.
 *
 * @returns A tracker whose `accept` enforces: one `start`, then `delta`s, then
 *   one `end`; stable kind per index; `text` on `delta` only; id and name on
 *   `toolCall` `start` only.
 */
export function createLlmDeltaTracker(): LlmDeltaTracker {
  const blocks = new Map<number, BlockState>();
  return {
    accept(event) {
      if (!EVENTS.has(event.event) || !BLOCKS.has(event.block)) return false;
      if (!Number.isInteger(event.blockIndex) || event.blockIndex < 0) return false;
      const known = blocks.get(event.blockIndex);
      if (event.event === 'start') {
        if (known || !validStart(event)) return false;
        blocks.set(event.blockIndex, {
          kind: event.block, open: true, text: '',
          ...(event.block === 'toolCall' ? { toolCallId: event.toolCallId as string, name: event.name as string } : {}),
        });
        return true;
      }
      if (!known?.open || known.kind !== event.block) return false;
      if (event.toolCallId !== undefined || event.name !== undefined) return false;
      if (event.event === 'end') {
        known.open = false;
        return event.text === undefined;
      }
      if (typeof event.text !== 'string') return false;
      known.text += event.text;
      return true;
    },
    matches(content) {
      for (const [index, block] of blocks) {
        if (block.open) return false;
        const part = content[index];
        if (!part || part.type !== block.kind) return false;
        if (part.type === 'toolCall') {
          if (part.toolCallId !== block.toolCallId || part.name !== block.name) return false;
          try { if (!jsonEqual(JSON.parse(block.text), part.arguments)) return false; } catch { return false; }
        } else if (part.text !== block.text) {
          return false;
        }
      }
      return true;
    },
  };
}

function callsOf(content: readonly LlmOutputPart[]): LlmToolCallPart[] {
  return content.filter((part): part is LlmToolCallPart => part.type === 'toolCall');
}

function historyIds(request: LlmGenerationRequest): Set<string> {
  const ids = new Set<string>();
  for (const message of request.messages) {
    for (const part of message.content) if (part.type === 'toolCall') ids.add(part.toolCallId);
  }
  return ids;
}

function validCalls(request: LlmGenerationRequest, calls: readonly LlmToolCallPart[]): boolean {
  const names = new Set((request.tools ?? []).map((entry) => entry.name));
  const used = historyIds(request);
  for (const call of calls) {
    if (!names.has(call.name) || used.has(call.toolCallId)) return false;
    used.add(call.toolCallId);
  }
  return true;
}

/** Mode rules for a successfully completed turn: `none` forbids calls, `required` and named need them. */
function honoursChoice(request: LlmGenerationRequest, calls: readonly LlmToolCallPart[]): boolean {
  const mode = llmToolChoiceMode(request);
  if (mode === 'none') return calls.length === 0;
  if (mode === 'required') return calls.length > 0;
  if (mode !== 'tool') return true;
  const forced = typeof request.toolChoice === 'object' ? request.toolChoice.name : '';
  return calls.length > 0 && calls.every((call) => call.name === forced);
}

/** Truncated and refused turns keep their finish and carry no executable calls. */
function stripPartialCalls(result: unknown): unknown {
  if (typeof result !== 'object' || result === null) return result;
  const generation = result as { finish?: unknown; content?: unknown };
  if ((generation.finish !== 'length' && generation.finish !== 'refusal') || !Array.isArray(generation.content)) return result;
  return { ...generation, content: generation.content.filter((part: unknown) => (part as { type?: unknown } | null)?.type !== 'toolCall') };
}

/**
 * Normalise and validate a host's terminal result.
 *
 * Order: partial turns lose their calls, the exact Generation shape is checked,
 * a completed turn with any call becomes `toolUse` (and `toolUse` without a
 * call fails), calls are checked against current `tools`, id uniqueness and the
 * tool-choice mode, `format: "json"` text is checked on `stop`, and finally the
 * streamed blocks must match. `length` and `refusal` skip the later checks.
 *
 * @returns The Generation to send, or a `provider-error` failure with a safe message.
 */
export function checkTerminal(request: LlmGenerationRequest, raw: unknown, tracker: LlmDeltaTracker): LlmGeneration | LlmFailure {
  const result = stripPartialCalls(raw);
  if (!isLlmGeneration(result)) return MALFORMED;
  if (result.finish === 'length' || result.finish === 'refusal') return result;
  const calls = callsOf(result.content);
  if (result.finish === 'toolUse' && calls.length === 0) return MALFORMED;
  if (!validCalls(request, calls)) return BAD_CALL;
  if (!honoursChoice(request, calls)) return BAD_MODE;
  const normalised: LlmGeneration = calls.length > 0 && result.finish === 'stop' ? { ...result, finish: 'toolUse' } : result;
  if (request.format === 'json' && normalised.finish === 'stop' && !isJsonObjectText(llmTextOf(normalised.content))) return NO_JSON;
  return tracker.matches(normalised.content) ? normalised : MISMATCH;
}

/** Failure sent when a host's delta breaks the block lifecycle. */
export const LLM_LIFECYCLE_FAILURE: LlmFailure = LIFECYCLE;
