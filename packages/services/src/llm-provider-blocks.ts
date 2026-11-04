/**
 * Block lifecycle builder shared by the NAP-LLM stream accumulators.
 *
 * Providers stream fragments; NAP-LLM streams blocks. The builder assigns each
 * block its `blockIndex` on first appearance, turns fragments into `start`,
 * `delta` and `end` events, and produces the terminal content in index order so
 * the streamed lifecycle and the authoritative result agree by construction.
 * Empty fragments are never emitted, and a block never starts without content,
 * so an empty provider block consumes no index.
 *
 * A tool call block starts only once its id and name are known; argument
 * fragments that arrive earlier are held, then flushed in order. When the
 * provider supplies no id one is synthesized exactly once, so the same id
 * appears in the deltas and the terminal result (LLM-C14). A call with no
 * argument fragments emits a single `{}` fragment before `end`, so the
 * fragments always parse to the final arguments object. Nothing here executes
 * a tool call.
 */

import { LlmServiceError, type LlmBlockEvent, type LlmOutputPart, type LlmToolCallPart } from './llm-types.js';

type TextualKind = 'text' | 'thinking';

type TextualBlock = { readonly kind: TextualKind; readonly index: number; text: string; open: boolean };

type CallBlock = {
  index: number | undefined;
  id: string | undefined;
  name: string | undefined;
  /** Fragments received before the call started. */
  held: string[];
  /** Fragments already relayed. */
  sent: string[];
  open: boolean;
};

const BAD_CALL = 'The provider returned an invalid tool call.';
let fallbackCounter = 0;

/**
 * Synthesize a tool call id for a provider that omitted one. Ids are not
 * credentials; they only need to be unique within a conversation.
 *
 * @returns A fresh `call_`-prefixed id.
 * @example synthesizeLlmToolCallId(); // 'call_3f2a…'
 */
export function synthesizeLlmToolCallId(): string {
  fallbackCounter += 1;
  const random = typeof globalThis.crypto?.randomUUID === 'function'
    ? globalThis.crypto.randomUUID()
    : `${Date.now().toString(36)}-${fallbackCounter}`;
  return `call_${random}`;
}

/**
 * Parse tool arguments into a JSON object. A provider that sends no arguments
 * means `{}`.
 *
 * @param raw - A JSON string, an already parsed object, or `undefined`.
 * @returns The arguments object.
 * @throws LlmServiceError `provider-error` for malformed or non-object arguments.
 */
export function parseToolArguments(raw: unknown): Record<string, unknown> {
  if (raw === undefined || raw === null || raw === '') return {};
  let value: unknown = raw;
  if (typeof raw === 'string') {
    try { value = JSON.parse(raw); } catch { throw new LlmServiceError('provider-error', BAD_CALL); }
  }
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new LlmServiceError('provider-error', BAD_CALL);
  return value as Record<string, unknown>;
}

/** A raw call as a dialect parsed it, before validation. */
export interface RawToolCall {
  readonly id?: unknown;
  readonly name?: unknown;
  readonly args?: unknown;
}

/**
 * Turn a buffered response's raw calls into terminal parts.
 *
 * Truncated and refused turns discard their calls, so incomplete arguments are
 * not treated as completed calls. On a completed turn a missing name or
 * malformed arguments are `provider-error`; a missing id is synthesized.
 *
 * @param partial - True for `length` and `refusal` finishes.
 * @param calls - Raw calls in provider order.
 * @returns Tool call parts, empty for a partial turn.
 */
export function toolCallParts(partial: boolean, calls: readonly RawToolCall[]): LlmToolCallPart[] {
  if (partial) return [];
  return calls.map((call) => {
    if (typeof call.name !== 'string' || call.name === '') throw new LlmServiceError('provider-error', BAD_CALL);
    const toolCallId = typeof call.id === 'string' && call.id !== '' ? call.id : synthesizeLlmToolCallId();
    return { type: 'toolCall', toolCallId, name: call.name, arguments: parseToolArguments(call.args) };
  });
}

/** Accumulates provider fragments into ordered block events and terminal content. */
export interface LlmBlockBuilder {
  /**
   * Append a fragment to the text or thinking block registered under `key`,
   * starting it on first appearance. An empty fragment starts nothing.
   * @returns Ordered events produced by this fragment.
   */
  append(kind: TextualKind, key: string, fragment: string): LlmBlockEvent[];
  /**
   * Update the tool call registered under `key`. The call starts once its id
   * and name are known; a fragment before that is held.
   * @returns Ordered events produced by this update.
   */
  toolDelta(key: string, update: { id?: unknown; name?: unknown; fragment?: unknown }): LlmBlockEvent[];
  /** Emit a call whose arguments arrive as one object: start, one fragment, end. */
  toolWhole(key: string, update: { id?: unknown; name: unknown; args: unknown }): LlmBlockEvent[];
  /** End one open block. Unknown or already ended keys produce no events. */
  end(key: string): LlmBlockEvent[];
  /** End every block still open, in index order. */
  closeAll(): LlmBlockEvent[];
  /**
   * Terminal content ordered by `blockIndex`.
   * @param completedTurn - True for `stop` and `toolUse`; false drops tool calls.
   * @throws LlmServiceError `provider-error` when a completed turn has a call
   *   without a name or with arguments that do not parse to an object.
   */
  content(completedTurn: boolean): LlmOutputPart[];
}

/**
 * Create an empty block builder for one generation.
 *
 * @returns A builder with text, thinking and tool call blocks.
 * @example
 * const blocks = createLlmBlockBuilder();
 * const events = blocks.append('text', 'text', 'Hello');
 */
export function createLlmBlockBuilder(): LlmBlockBuilder {
  const texts = new Map<string, TextualBlock>();
  const calls = new Map<string, CallBlock>();
  let next = 0;

  function startCall(call: CallBlock): LlmBlockEvent[] {
    call.index = next++;
    const events: LlmBlockEvent[] = [
      { event: 'start', block: 'toolCall', blockIndex: call.index, toolCallId: call.id as string, name: call.name as string },
    ];
    for (const fragment of call.held) events.push(deltaOf(call, fragment));
    call.held = [];
    return events;
  }

  function deltaOf(call: CallBlock, fragment: string): LlmBlockEvent {
    call.sent.push(fragment);
    return { event: 'delta', block: 'toolCall', blockIndex: call.index as number, text: fragment };
  }

  function endCall(call: CallBlock): LlmBlockEvent[] {
    if (!call.open || call.index === undefined) return [];
    call.open = false;
    const events: LlmBlockEvent[] = [];
    // A call without argument fragments still needs fragments that parse to its arguments.
    if (call.sent.length === 0) events.push(deltaOf(call, '{}'));
    events.push({ event: 'end', block: 'toolCall', blockIndex: call.index });
    return events;
  }

  function callFor(key: string): CallBlock {
    let call = calls.get(key);
    if (!call) {
      call = { index: undefined, id: undefined, name: undefined, held: [], sent: [], open: true };
      calls.set(key, call);
    }
    return call;
  }

  function endKey(key: string): LlmBlockEvent[] {
    const text = texts.get(key);
    if (text) {
      if (!text.open) return [];
      text.open = false;
      return [{ event: 'end', block: text.kind, blockIndex: text.index }];
    }
    const call = calls.get(key);
    return call ? endCall(call) : [];
  }

  return {
    append(kind, key, fragment) {
      if (fragment === '') return [];
      const events: LlmBlockEvent[] = [];
      let block = texts.get(key);
      if (!block) {
        block = { kind, index: next++, text: '', open: true };
        texts.set(key, block);
        events.push({ event: 'start', block: kind, blockIndex: block.index });
      }
      if (!block.open) return [];
      block.text += fragment;
      events.push({ event: 'delta', block: kind, blockIndex: block.index, text: fragment });
      return events;
    },
    toolDelta(key, update) {
      const call = callFor(key);
      if (!call.open) return [];
      const events: LlmBlockEvent[] = [];
      if (call.index === undefined) {
        if (typeof update.id === 'string' && update.id !== '' && call.id === undefined) call.id = update.id;
        if (typeof update.name === 'string' && update.name !== '' && call.name === undefined) {
          call.name = update.name;
          // The chunk that delivers the name settles the id; a later id never replaces it.
          call.id ??= synthesizeLlmToolCallId();
        }
        if (call.id !== undefined && call.name !== undefined) events.push(...startCall(call));
      }
      if (typeof update.fragment === 'string' && update.fragment !== '') {
        if (call.index === undefined) call.held.push(update.fragment);
        else events.push(deltaOf(call, update.fragment));
      }
      return events;
    },
    toolWhole(key, update) {
      const call = callFor(key);
      if (typeof update.name !== 'string' || update.name === '') throw new LlmServiceError('provider-error', BAD_CALL);
      call.name = update.name;
      call.id = typeof update.id === 'string' && update.id !== '' ? update.id : synthesizeLlmToolCallId();
      const args = parseToolArguments(update.args);
      return [...startCall(call), deltaOf(call, JSON.stringify(args)), ...endCall(call)];
    },
    end: endKey,
    closeAll() {
      const open: Array<{ index: number; key: string }> = [];
      for (const [key, block] of texts) if (block.open) open.push({ index: block.index, key });
      for (const [key, call] of calls) if (call.open && call.index !== undefined) open.push({ index: call.index, key });
      return open.sort((a, b) => a.index - b.index).flatMap((entry) => endKey(entry.key));
    },
    content(completedTurn) {
      const parts: Array<{ index: number; part: LlmOutputPart }> = [];
      for (const block of texts.values()) parts.push({ index: block.index, part: { type: block.kind, text: block.text } });
      for (const call of calls.values()) {
        if (!completedTurn) continue;
        if (call.index === undefined) throw new LlmServiceError('provider-error', BAD_CALL);
        const toolCallId = call.id as string;
        const name = call.name as string;
        parts.push({ index: call.index, part: { type: 'toolCall', toolCallId, name, arguments: parseToolArguments(call.sent.join('')) } });
      }
      return parts.sort((a, b) => a.index - b.index).map((entry) => entry.part);
    },
  };
}
