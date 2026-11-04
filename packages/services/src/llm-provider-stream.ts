/**
 * Streaming support for the NAP-LLM provider dialects.
 *
 * `readLlmSseData` yields the `data` payload of each server-sent event, and
 * `createLlmStreamAccumulator` folds one dialect's stream events into the same
 * `LlmGeneration` the buffered parsers produce while surfacing each appended
 * text fragment for `llm.delta`. Provisional fragments never replace the
 * terminal result: NAP-LLM makes the final `text` authoritative.
 */

import type { LlmFinish, LlmGeneration, LlmUsage } from './llm-types.js';
import {
  anthropicFinish,
  completed,
  geminiFinish,
  openAiFinish,
  providerError,
  record,
  usageFrom,
  type LlmProviderProtocol,
} from './llm-providers.js';

/** Folds one provider stream into deltas and a final generation. */
export interface LlmStreamAccumulator {
  /**
   * Consume one parsed event payload.
   * @returns Text appended by this event, or `''` when it carried none.
   * @throws LlmServiceError `provider-error` when the provider reports a stream error.
   */
  push(event: unknown): string;
  /**
   * Resolve the complete generation after the stream ended.
   * @throws LlmServiceError `provider-error` when no completion marker arrived.
   */
  finish(): LlmGeneration;
}

const STREAM_ERROR = 'The provider reported an error while streaming.';

function textField(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function openAiAccumulator(): LlmStreamAccumulator {
  let text = '';
  let refused = false;
  let finish: LlmFinish | null = null;
  let usage: LlmUsage | undefined;
  return {
    push(event) {
      const root = record(event);
      if (root?.error !== undefined) throw providerError(STREAM_ERROR);
      const reported = record(root?.usage);
      if (reported) usage = usageFrom(reported.prompt_tokens, reported.completion_tokens) ?? usage;
      const choice = record(Array.isArray(root?.choices) ? root?.choices[0] : undefined);
      if (!choice) return '';
      const delta = record(choice.delta);
      if (textField(delta?.refusal).length > 0) refused = true;
      finish = openAiFinish(choice.finish_reason) ?? finish;
      const appended = textField(delta?.content);
      text += appended;
      return appended;
    },
    finish: () => refused ? completed('', 'refusal', usage) : completed(text, finish, usage),
  };
}

function anthropicAccumulator(): LlmStreamAccumulator {
  let text = '';
  let finish: LlmFinish | null = null;
  let inputTokens: unknown;
  let outputTokens: unknown;
  return {
    push(event) {
      const root = record(event);
      switch (root?.type) {
        case 'error': throw providerError(STREAM_ERROR);
        case 'message_start': inputTokens = record(record(root.message)?.usage)?.input_tokens; return '';
        case 'message_delta': {
          finish = anthropicFinish(record(root.delta)?.stop_reason) ?? finish;
          const usage = record(root.usage);
          if (usage?.output_tokens !== undefined) outputTokens = usage.output_tokens;
          if (usage?.input_tokens !== undefined) inputTokens = usage.input_tokens;
          return '';
        }
        case 'content_block_delta': {
          const delta = record(root.delta);
          const appended = delta?.type === 'text_delta' ? textField(delta.text) : '';
          text += appended;
          return appended;
        }
        default: return '';
      }
    },
    finish: () => completed(text, finish, usageFrom(inputTokens, outputTokens)),
  };
}

function geminiAccumulator(): LlmStreamAccumulator {
  let text = '';
  let blocked = false;
  let finish: LlmFinish | null = null;
  let usage: LlmUsage | undefined;
  return {
    push(event) {
      const root = record(event);
      if (root?.error !== undefined) throw providerError(STREAM_ERROR);
      const metadata = record(root?.usageMetadata);
      if (metadata) usage = usageFrom(metadata.promptTokenCount, metadata.candidatesTokenCount) ?? usage;
      if (typeof record(root?.promptFeedback)?.blockReason === 'string') blocked = true;
      const candidate = record(Array.isArray(root?.candidates) ? root?.candidates[0] : undefined);
      if (!candidate) return '';
      finish = geminiFinish(candidate.finishReason) ?? finish;
      const parts = record(candidate.content)?.parts;
      const appended = Array.isArray(parts) ? parts.map((part) => textField(record(part)?.text)).join('') : '';
      text += appended;
      return appended;
    },
    finish: () => blocked ? completed('', 'refusal', usage) : completed(text, finish, usage),
  };
}

/**
 * Create the stream accumulator for one provider dialect.
 *
 * @param protocol - Dialect whose streaming events will be pushed.
 * @returns Accumulator yielding appended text per event and the final generation.
 * @example
 * const stream = createLlmStreamAccumulator('openai-chat');
 * for await (const data of readLlmSseData(response.body!)) if (data !== '[DONE]') onDelta(stream.push(JSON.parse(data)));
 * const generation = stream.finish();
 */
export function createLlmStreamAccumulator(protocol: LlmProviderProtocol): LlmStreamAccumulator {
  switch (protocol) {
    case 'openai-chat': return openAiAccumulator();
    case 'anthropic-messages': return anthropicAccumulator();
    case 'gemini': return geminiAccumulator();
    default: throw providerError('Unknown provider protocol.');
  }
}

/** Index and length of the next line terminator, or null when the line is incomplete. */
function nextLineBreak(buffer: string, final: boolean): { index: number; length: number } | null {
  const index = buffer.search(/[\r\n]/);
  if (index === -1) return null;
  if (buffer[index] === '\n') return { index, length: 1 };
  // A trailing CR may be the first half of a CRLF split across chunks.
  if (index === buffer.length - 1 && !final) return null;
  return { index, length: buffer[index + 1] === '\n' ? 2 : 1 };
}

/** Parse complete lines out of `buffer`, collecting dispatched event payloads. */
function drainLines(state: { buffer: string; data: string[] }, final: boolean, events: string[]): void {
  for (let found = nextLineBreak(state.buffer, final); found; found = nextLineBreak(state.buffer, final)) {
    const line = state.buffer.slice(0, found.index);
    state.buffer = state.buffer.slice(found.index + found.length);
    if (line === '') {
      if (state.data.length > 0) events.push(state.data.join('\n'));
      state.data = [];
      continue;
    }
    if (line.startsWith(':')) continue;
    const colon = line.indexOf(':');
    const field = colon === -1 ? line : line.slice(0, colon);
    if (field !== 'data') continue;
    const value = colon === -1 ? '' : line.slice(colon + 1);
    state.data.push(value.startsWith(' ') ? value.slice(1) : value);
  }
}

/**
 * Yield the `data` payload of each server-sent event in a response body.
 *
 * Multi-line `data` fields join with `\n`; comments and other fields are
 * ignored. Aborting `signal` cancels the reader and ends iteration; callers
 * check `signal.aborted` afterwards.
 *
 * @param body - Response body stream.
 * @param signal - Optional abort signal that cancels a stalled read.
 * @returns Async iterator of event payload strings.
 * @example
 * for await (const data of readLlmSseData(response.body!, signal)) console.log(data);
 */
export async function* readLlmSseData(body: ReadableStream<Uint8Array>, signal?: AbortSignal): AsyncGenerator<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  const state = { buffer: '', data: [] as string[] };
  const cancel = (): void => { void reader.cancel().catch(() => undefined); };
  let complete = false;
  signal?.addEventListener('abort', cancel, { once: true });
  try {
    for (;;) {
      if (signal?.aborted) return;
      const { done, value } = await reader.read();
      const events: string[] = [];
      if (done) {
        complete = true;
        state.buffer += decoder.decode();
        drainLines(state, true, events);
        if (state.buffer !== '') { state.buffer += '\n'; drainLines(state, true, events); }
        if (state.data.length > 0) events.push(state.data.join('\n'));
        yield* events;
        return;
      }
      state.buffer += decoder.decode(value, { stream: true });
      drainLines(state, false, events);
      yield* events;
    }
  } finally {
    signal?.removeEventListener('abort', cancel);
    // Stop the transfer when the consumer stops early (a thrown delta handler or a provider error).
    if (!complete) cancel();
    reader.releaseLock();
  }
}
