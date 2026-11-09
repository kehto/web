/**
 * Streaming support for the NAP-LLM provider dialects.
 *
 * `readLlmSseData` yields the `data` payload of each server-sent event, and
 * `createLlmStreamAccumulator` folds one dialect's stream events into the same
 * `LlmGeneration` the buffered parsers produce while surfacing ordered block
 * lifecycle events for `llm.delta`. Provisional blocks never replace the
 * terminal result: NAP-LLM makes the final `content` authoritative.
 */

import { anthropicAccumulator } from './llm-provider-anthropic.js';
import { geminiAccumulator } from './llm-provider-gemini.js';
import { openAiAccumulator } from './llm-provider-openai.js';
import { providerError, type LlmProviderProtocol, type LlmStreamAccumulator } from './llm-provider-shared.js';

export type { LlmStreamAccumulator } from './llm-provider-shared.js';

/**
 * Create the stream accumulator for one provider dialect.
 *
 * @param protocol - Dialect whose streaming events will be pushed.
 * @returns Accumulator yielding block events per payload and the final generation.
 * @example
 * const stream = createLlmStreamAccumulator('openai-chat');
 * for await (const data of readLlmSseData(response.body!)) if (data !== '[DONE]') for (const event of stream.push(JSON.parse(data))) onDelta(event);
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
