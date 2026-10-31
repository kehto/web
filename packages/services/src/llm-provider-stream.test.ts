/**
 * Streaming provider path (kehto/web#370). Event shapes follow each provider's
 * documented streaming format: OpenAI Chat Completions chunks with
 * `stream_options.include_usage`, Anthropic Messages SSE events and Gemini
 * `streamGenerateContent?alt=sse` responses.
 */
import { describe, expect, it } from 'vitest';
import { buildLlmProviderRequest, parseLlmProviderResponse, type LlmProviderEndpoint, type LlmProviderProtocol } from './llm-providers.js';
import { createHttpLlmProvider, type LlmFetchResponse } from './llm-provider-http.js';
import { createLlmStreamAccumulator, readLlmSseData } from './llm-provider-stream.js';
import type { LlmGenerationRequest } from './llm-types.js';

const KEY = 'sk-stream-secret';
const REQUEST: LlmGenerationRequest = { handle: 'h', messages: [{ role: 'user', content: [{ type: 'text', text: 'hi' }] }] };

const OPENAI_SSE = [
  'data: {"id":"c1","object":"chat.completion.chunk","choices":[{"index":0,"delta":{"role":"assistant","content":""},"finish_reason":null}]}',
  'data: {"id":"c1","object":"chat.completion.chunk","choices":[{"index":0,"delta":{"content":"Hél"},"finish_reason":null}]}',
  'data: {"id":"c1","object":"chat.completion.chunk","choices":[{"index":0,"delta":{"content":"lo"},"finish_reason":null}]}',
  'data: {"id":"c1","object":"chat.completion.chunk","choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}',
  'data: {"id":"c1","object":"chat.completion.chunk","choices":[],"usage":{"prompt_tokens":9,"completion_tokens":2,"total_tokens":11}}',
  'data: [DONE]',
].map((line) => `${line}\n\n`).join('');

const ANTHROPIC_SSE = [
  ['message_start', '{"type":"message_start","message":{"id":"msg_1","type":"message","role":"assistant","content":[],"model":"claude","stop_reason":null,"usage":{"input_tokens":25,"output_tokens":1}}}'],
  ['content_block_start', '{"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}}'],
  ['ping', '{"type": "ping"}'],
  ['content_block_delta', '{"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Hél"}}'],
  ['content_block_delta', '{"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"lo"}}'],
  ['content_block_stop', '{"type":"content_block_stop","index":0}'],
  ['message_delta', '{"type":"message_delta","delta":{"stop_reason":"end_turn","stop_sequence":null},"usage":{"output_tokens":15}}'],
  ['message_stop', '{"type":"message_stop"}'],
].map(([event, data]) => `event: ${event}\r\ndata: ${data}\r\n\r\n`).join('');

const GEMINI_SSE = [
  '{"candidates": [{"content": {"parts": [{"text": "Hél"}],"role": "model"},"index": 0}],"usageMetadata": {"promptTokenCount": 4,"candidatesTokenCount": 1,"totalTokenCount": 5}}',
  '{"candidates": [{"content": {"parts": [{"text": "lo"}],"role": "model"},"finishReason": "STOP","index": 0}],"usageMetadata": {"promptTokenCount": 4,"candidatesTokenCount": 2,"totalTokenCount": 6}}',
].map((data) => `data: ${data}\r\n\r\n`).join('');

const BUFFERED: Record<LlmProviderProtocol, unknown> = {
  'openai-chat': { choices: [{ message: { content: 'Héllo' }, finish_reason: 'stop' }], usage: { prompt_tokens: 9, completion_tokens: 2 } },
  'anthropic-messages': { content: [{ type: 'text', text: 'Héllo' }], stop_reason: 'end_turn', usage: { input_tokens: 25, output_tokens: 15 } },
  gemini: { candidates: [{ content: { parts: [{ text: 'Héllo' }] }, finishReason: 'STOP' }], usageMetadata: { promptTokenCount: 4, candidatesTokenCount: 2 } },
};

/** Split text into byte chunks of `size`, deliberately cutting UTF-8 sequences and CRLF pairs. */
function bytes(text: string, size: number): Uint8Array[] {
  const encoded = new TextEncoder().encode(text);
  const chunks: Uint8Array[] = [];
  for (let offset = 0; offset < encoded.length; offset += size) chunks.push(encoded.slice(offset, offset + size));
  return chunks;
}

function streamOf(chunks: Uint8Array[]): ReadableStream<Uint8Array> {
  return new ReadableStream({ start(controller) { for (const chunk of chunks) controller.enqueue(chunk); controller.close(); } });
}

function sseResponse(text: string, size = 7, contentType = 'text/event-stream'): LlmFetchResponse {
  return { ok: true, status: 200, json: async () => { throw new Error('not json'); }, body: streamOf(bytes(text, size)), headers: { get: (name) => name === 'content-type' ? contentType : null } };
}

function endpoint(protocol: LlmProviderProtocol): LlmProviderEndpoint {
  return { protocol, baseUrl: 'https://api.example.test/v1', model: 'm-1', credential: KEY };
}

async function collect(iterable: AsyncIterable<string>): Promise<string[]> {
  const out: string[] = [];
  for await (const item of iterable) out.push(item);
  return out;
}

describe('buildLlmProviderRequest stream option', () => {
  it('requests each dialect\'s streaming form only when asked', () => {
    const openai = buildLlmProviderRequest(endpoint('openai-chat'), REQUEST, { stream: true });
    expect(JSON.parse(openai.body)).toMatchObject({ stream: true, stream_options: { include_usage: true } });
    expect(JSON.parse(buildLlmProviderRequest(endpoint('openai-chat'), REQUEST).body)).toMatchObject({ stream: false });
    expect(JSON.parse(buildLlmProviderRequest(endpoint('openai-chat'), REQUEST).body).stream_options).toBeUndefined();
    expect(JSON.parse(buildLlmProviderRequest(endpoint('anthropic-messages'), REQUEST, { stream: true }).body).stream).toBe(true);
    expect(JSON.parse(buildLlmProviderRequest(endpoint('anthropic-messages'), REQUEST).body).stream).toBe(false);
    expect(buildLlmProviderRequest(endpoint('gemini'), REQUEST, { stream: true }).url).toBe('https://api.example.test/v1/models/m-1:streamGenerateContent?alt=sse');
    expect(buildLlmProviderRequest(endpoint('gemini'), REQUEST).url).toBe('https://api.example.test/v1/models/m-1:generateContent');
  });
});

describe('readLlmSseData', () => {
  it('joins multi-line data, skips comments and other fields, and survives split CRLF and UTF-8', async () => {
    const text = ': keep-alive\r\nevent: x\r\nid: 1\r\ndata: first\r\ndata: é line\r\n\r\ndata:no-space\n\nretry: 5\ndata: tail without blank line';
    for (const size of [1, 2, 3, 5, 64]) {
      expect(await collect(readLlmSseData(streamOf(bytes(text, size)))), `chunk ${size}`).toEqual(['first\né line', 'no-space', 'tail without blank line']);
    }
  });
});

describe('createHttpLlmProvider({ stream: true })', () => {
  for (const [protocol, sse] of [['openai-chat', OPENAI_SSE], ['anthropic-messages', ANTHROPIC_SSE], ['gemini', GEMINI_SSE]] as const) {
    it(`${protocol}: forwards ordered fragments and resolves the buffered path's generation`, async () => {
      for (const size of [1, 7, 4096]) {
        const deltas: string[] = [];
        const calls: Array<[string, { body: string; headers: Record<string, string> }]> = [];
        const generate = createHttpLlmProvider({ stream: true, fetch: async (url, init) => { calls.push([url, init]); return sseResponse(sse, size); } });
        const result = await generate(endpoint(protocol), REQUEST, new AbortController().signal, (text) => deltas.push(text));
        expect(deltas, `chunk ${size}`).toEqual(['Hél', 'lo']);
        expect(result).toEqual(parseLlmProviderResponse(protocol, BUFFERED[protocol]));
        expect(calls).toHaveLength(1);
        expect(calls[0]![0]).toBe(buildLlmProviderRequest(endpoint(protocol), REQUEST, { stream: true }).url);
        expect(calls[0]![1].body).not.toContain(KEY);
      }
    });
  }

  it('maps streamed refusals and blocked prompts to refusal like the buffered path', async () => {
    const refusal = 'data: {"choices":[{"index":0,"delta":{"refusal":"I can\'t help."},"finish_reason":null}]}\n\ndata: {"choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}\n\n';
    const openai = createHttpLlmProvider({ stream: true, fetch: async () => sseResponse(refusal) });
    await expect(openai(endpoint('openai-chat'), REQUEST, new AbortController().signal)).resolves.toEqual({ text: '', finish: 'refusal' });
    const blocked = 'data: {"promptFeedback":{"blockReason":"SAFETY"}}\n\n';
    const gemini = createHttpLlmProvider({ stream: true, fetch: async () => sseResponse(blocked) });
    await expect(gemini(endpoint('gemini'), REQUEST, new AbortController().signal)).resolves.toEqual({ text: '', finish: 'refusal' });
  });

  it('shapes stream errors, missing markers, bad events and missing bodies as provider-error without echoing bodies', async () => {
    const cases: Array<[LlmProviderProtocol, LlmFetchResponse, string]> = [
      ['anthropic-messages', sseResponse(`event: error\ndata: {"type":"error","error":{"type":"overloaded_error","message":"${KEY}"}}\n\n`), 'The provider reported an error while streaming.'],
      ['openai-chat', sseResponse('data: {"choices":[{"index":0,"delta":{"content":"partial"},"finish_reason":null}]}\n\n'), 'The provider response had no recognised completion marker.'],
      ['gemini', sseResponse(`data: {not json ${KEY}\n\n`), 'The provider stream carried an invalid event.'],
      ['openai-chat', { ok: true, status: 200, json: async () => ({}), body: null, headers: { get: () => 'text/event-stream' } }, 'The provider response had no readable stream.'],
    ];
    for (const [protocol, response, message] of cases) {
      const deltas: string[] = [];
      const generate = createHttpLlmProvider({ stream: true, fetch: async () => response });
      const failure = await generate(endpoint(protocol), REQUEST, new AbortController().signal, (text) => deltas.push(text)).catch((error: unknown) => error);
      expect(failure).toMatchObject({ code: 'provider-error', message });
      expect(JSON.stringify(failure)).not.toContain(KEY);
    }
  });

  it('accepts a JSON body from a server that ignored the stream request, with no deltas', async () => {
    const deltas: string[] = [];
    const generate = createHttpLlmProvider({ stream: true, fetch: async () => ({ ok: true, status: 200, json: async () => BUFFERED['openai-chat'], body: streamOf([]), headers: { get: () => 'application/json; charset=utf-8' } }) });
    await expect(generate(endpoint('openai-chat'), REQUEST, new AbortController().signal, (text) => deltas.push(text))).resolves.toEqual({ text: 'Héllo', finish: 'stop', usage: { inputTokens: 9, outputTokens: 2 } });
    expect(deltas).toEqual([]);
  });

  it('cancels a stalled stream on abort, rejects with the abort reason and forwards nothing afterwards', async () => {
    let cancelled = false;
    const body = new ReadableStream<Uint8Array>({
      start(controller) { controller.enqueue(new TextEncoder().encode('data: {"choices":[{"index":0,"delta":{"content":"one"},"finish_reason":null}]}\n\n')); },
      cancel() { cancelled = true; },
    });
    const controller = new AbortController();
    const deltas: string[] = [];
    const generate = createHttpLlmProvider({ stream: true, fetch: async () => ({ ok: true, status: 200, json: async () => ({}), body, headers: { get: () => 'text/event-stream' } }) });
    const pending = generate(endpoint('openai-chat'), REQUEST, controller.signal, (text) => { deltas.push(text); controller.abort(new DOMException('stop', 'AbortError')); });
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    expect(cancelled).toBe(true);
    expect(deltas).toEqual(['one']);
  });

  it('never calls onDelta on the buffered path', async () => {
    const deltas: string[] = [];
    const generate = createHttpLlmProvider({ fetch: async (_url, init) => {
      expect(JSON.parse(init.body).stream).toBe(false);
      return { ok: true, status: 200, json: async () => BUFFERED['openai-chat'] };
    } });
    await expect(generate(endpoint('openai-chat'), REQUEST, new AbortController().signal, (text) => deltas.push(text))).resolves.toMatchObject({ text: 'Héllo' });
    expect(deltas).toEqual([]);
  });
});

describe('createLlmStreamAccumulator', () => {
  it('rejects unknown protocols', () => {
    expect(() => createLlmStreamAccumulator('nope' as LlmProviderProtocol)).toThrow(/Unknown provider protocol/);
  });
});
