/**
 * OpenAI Responses dialect (kehto/web#414).
 *
 * NAP-LLM authority: napplet/naps PR #134 at
 * 5e93bdfce0e84c0de728234cb7b3feed498f8635 (LLM-C03, C10, C14..C18, C21, C22).
 * The dialect is a host-side adapter and leaves the napplet-facing wire alone.
 *
 * Provider shapes are built from the official SDK types, `openai@7.62.0`
 * (openai/openai-node 02e2995540d35d92d7f6e814ee40009cc9c8c83d,
 * `src/resources/responses/responses.ts`): `ResponseCreateParamsBase`,
 * `EasyInputMessage`, `ResponseInputText`, `ResponseInputImage`,
 * `ResponseFunctionToolCall`, `ResponseInputItem.FunctionCallOutput`,
 * `FunctionTool`, `NamespaceTool`, `ToolChoiceFunction`, `Response`,
 * `ResponseUsage` and the `ResponseStreamEvent` members. The sign-in limits come
 * from https://developers.openai.com/siwc/token-sharing-open-source/preview-limitations
 * and `/models-and-inference`. None of it was exercised against the live API.
 */
import { describe, expect, it } from 'vitest';
import { buildLlmProviderRequest, parseLlmProviderResponse, type LlmProviderEndpoint } from './llm-providers.js';
import { createHttpLlmProvider, type LlmFetchResponse } from './llm-provider-http.js';
import { createLlmStreamAccumulator } from './llm-provider-stream.js';
import { checkTerminal, createLlmDeltaTracker } from './llm-generation-checks.js';
import type { LlmBlockEvent, LlmGeneration, LlmGenerationRequest, LlmMessage } from './llm-types.js';

const KEY = 'sk-planted-secret';
const WEATHER = { name: 'get_weather', description: 'Look up current weather', parameters: { type: 'object', properties: { city: { type: 'string' } }, required: ['city'] } };
const ASK: LlmMessage = { role: 'user', content: [{ type: 'text', text: 'What is the weather in Berlin?' }] };
const CALL = { type: 'toolCall' as const, toolCallId: 'call_1', name: 'get_weather', arguments: { city: 'Berlin' } };
const RESULT: LlmMessage = { role: 'toolResult', toolCallId: 'call_1', toolName: 'get_weather', content: [{ type: 'text', text: '18°C and clear' }] };
const G2: LlmGenerationRequest = { handle: 'h', messages: [ASK], tools: [WEATHER], toolChoice: 'auto' };
const G3: LlmGenerationRequest = { handle: 'h', messages: [ASK, { role: 'assistant', content: [CALL] }, RESULT], tools: [WEATHER], toolChoice: 'auto' };
const SIGN_IN = { responses: { profile: 'chatgpt-sign-in' as const } };
const PNG = { type: 'image' as const, mimeType: 'image/png' as const, data: 'iVBORw0KGgo=' };

const endpoint = (extra: Partial<LlmProviderEndpoint> = {}): LlmProviderEndpoint => ({ protocol: 'openai-responses', baseUrl: 'https://api.example.test/v1/', model: 'm-1', credential: KEY, ...extra });
const body = (request: LlmGenerationRequest, extra: Partial<LlmProviderEndpoint> = {}, stream = false) =>
  JSON.parse(buildLlmProviderRequest(endpoint(extra), request, { stream }).body) as Record<string, any>;
const withMessages = (messages: LlmMessage[], extra: Partial<LlmGenerationRequest> = {}): LlmGenerationRequest => ({ handle: 'h', messages, ...extra });
const unsupported = expect.objectContaining({ code: 'unsupported' });
const providerError = expect.objectContaining({ code: 'provider-error' });

const USAGE = { input_tokens: 31, input_tokens_details: { cached_tokens: 4, cache_write_tokens: 2 }, output_tokens: 12, output_tokens_details: { reasoning_tokens: 3 }, total_tokens: 43 };
const usage = { inputTokens: 31, outputTokens: 12, cacheReadTokens: 4, cacheWriteTokens: 2, reasoningTokens: 3 };
const message = (text: string, id = 'msg_1') => ({ id, type: 'message', status: 'completed', role: 'assistant', content: [{ type: 'output_text', text, annotations: [] }] });
const functionCall = (callId: unknown, args: unknown, name: unknown = 'get_weather') => ({ id: 'fc_1', type: 'function_call', status: 'completed', call_id: callId, name, arguments: args });
const reasoning = (...summaries: string[]) => ({ id: 'rs_1', type: 'reasoning', summary: summaries.map((text) => ({ type: 'summary_text', text })) });
const response = (output: unknown[], extra: Record<string, unknown> = {}) =>
  ({ id: 'resp_1', object: 'response', status: 'completed', error: null, incomplete_details: null, output, usage: USAGE, ...extra });
const incomplete = (output: unknown[], reason: string) => response(output, { status: 'incomplete', incomplete_details: { reason } });

/** Feed provider events through the accumulator, collecting block events and the generation. */
function run(events: unknown[]): { blocks: LlmBlockEvent[]; result: LlmGeneration } {
  const accumulator = createLlmStreamAccumulator('openai-responses');
  const blocks: LlmBlockEvent[] = [];
  for (const event of events) blocks.push(...accumulator.push(event));
  return { blocks, result: accumulator.finish() };
}

function sse(events: Array<Record<string, unknown>>): LlmFetchResponse {
  const text = events.map((event) => `event: ${String(event.type)}\ndata: ${JSON.stringify(event)}\n\n`).join('');
  const stream = new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(new TextEncoder().encode(text)); controller.close(); } });
  return { ok: true, status: 200, json: async () => { throw new Error('not json'); }, body: stream, headers: { get: (name) => name === 'content-type' ? 'text/event-stream' : null } };
}

describe('Responses request mapping', () => {
  it('posts to /responses, stateless, with system text as instructions and the credential only in the header', () => {
    const request = withMessages([
      { role: 'system', content: [{ type: 'text', text: 'Be brief.' }] },
      { role: 'user', content: [{ type: 'text', text: 'Describe this.' }, PNG] },
      { role: 'assistant', content: [{ type: 'text', text: 'A ' }, { type: 'text', text: 'picture.' }] },
      { role: 'system', content: [{ type: 'text', text: 'Use metric units.' }] },
      { role: 'user', content: [{ type: 'text', text: 'More detail.' }] },
    ], { format: 'json', maxTokens: 500, temperature: 0.7 });
    const http = buildLlmProviderRequest(endpoint({ headers: { 'x-title': 'Host' }, maxOutputTokens: 256 }), request);
    expect(http.url).toBe('https://api.example.test/v1/responses');
    expect(http.method).toBe('POST');
    expect(http.headers).toEqual({ 'content-type': 'application/json', 'x-title': 'Host', authorization: `Bearer ${KEY}` });
    expect(http.body).not.toContain(KEY);
    expect(JSON.parse(http.body)).toEqual({
      model: 'm-1',
      instructions: 'Be brief.\nUse metric units.',
      input: [
        { type: 'message', role: 'user', content: [{ type: 'input_text', text: 'Describe this.' }, { type: 'input_image', image_url: 'data:image/png;base64,iVBORw0KGgo=', detail: 'auto' }] },
        { type: 'message', role: 'assistant', content: 'A picture.' },
        { type: 'message', role: 'user', content: [{ type: 'input_text', text: 'More detail.' }] },
      ],
      stream: false,
      store: false,
      text: { format: { type: 'json_object' } },
      max_output_tokens: 256,
      temperature: 0.7,
    });
    expect(buildLlmProviderRequest(endpoint({ credentialHeader: 'api-key' }), request).headers).toMatchObject({ 'api-key': KEY });
    expect(buildLlmProviderRequest(endpoint({ credential: undefined }), request).headers).toEqual({ 'content-type': 'application/json' });
  });

  it('never sends server-side conversation state and only streams when asked', () => {
    for (const stream of [false, true]) {
      const sent = body(G3, {}, stream);
      expect(sent.stream).toBe(stream);
      expect(sent.store).toBe(false);
      for (const field of ['previous_response_id', 'conversation', 'background', 'include', 'reasoning', 'instructions', 'text', 'max_output_tokens', 'temperature']) {
        expect(field in sent, field).toBe(false);
      }
    }
  });

  it('maps flat function tools, tool_choice, function_call items and function_call_output items', () => {
    const sent = body(G3);
    expect(sent.tools).toEqual([{ type: 'function', name: 'get_weather', description: 'Look up current weather', parameters: WEATHER.parameters, strict: false }]);
    expect(sent.tool_choice).toBe('auto');
    expect(sent.input).toEqual([
      { type: 'message', role: 'user', content: [{ type: 'input_text', text: 'What is the weather in Berlin?' }] },
      { type: 'function_call', call_id: 'call_1', name: 'get_weather', arguments: '{"city":"Berlin"}' },
      { type: 'function_call_output', call_id: 'call_1', output: '18°C and clear' },
    ]);
    const choose = (toolChoice: LlmGenerationRequest['toolChoice']) => body(withMessages([ASK], { tools: [{ name: 'a' }], toolChoice })).tool_choice;
    expect(choose('none')).toBe('none');
    expect(choose('required')).toBe('required');
    expect(choose({ type: 'tool', name: 'a' })).toEqual({ type: 'function', name: 'a' });
    expect(choose(undefined)).toBeUndefined();
    expect(body(withMessages([ASK], { tools: [{ name: 'ping' }] })).tools).toEqual([{ type: 'function', name: 'ping', parameters: { type: 'object', properties: {}, additionalProperties: false }, strict: false }]);
    expect(body(withMessages([ASK], { tools: [] })).tools).toBeUndefined();
  });

  it('keeps assistant part order: text before and after a call become separate messages around it', () => {
    const second = { type: 'toolCall' as const, toolCallId: 'call_2', name: 'get_time', arguments: {} };
    const turn: LlmMessage = { role: 'assistant', content: [{ type: 'text', text: 'Checking.' }, CALL, second, { type: 'text', text: 'One moment.' }] };
    const time: LlmMessage = { role: 'toolResult', toolCallId: 'call_2', toolName: 'get_time', content: [{ type: 'text', text: '10:00' }] };
    expect(body(withMessages([ASK, turn, RESULT, time], { tools: [WEATHER, { name: 'get_time' }] })).input.slice(1)).toEqual([
      { type: 'message', role: 'assistant', content: 'Checking.' },
      { type: 'function_call', call_id: 'call_1', name: 'get_weather', arguments: '{"city":"Berlin"}' },
      { type: 'function_call', call_id: 'call_2', name: 'get_time', arguments: '{}' },
      { type: 'message', role: 'assistant', content: 'One moment.' },
      { type: 'function_call_output', call_id: 'call_1', output: '18°C and clear' },
      { type: 'function_call_output', call_id: 'call_2', output: '10:00' },
    ]);
  });

  it('LLM-C17: omits thinking from input and honours requiresOpaqueReasoning', () => {
    const thinking: LlmMessage = { role: 'assistant', content: [{ type: 'thinking', text: 'private reasoning' }, { type: 'text', text: 'Hello' }] };
    const sent = body(withMessages([ASK, thinking, { role: 'user', content: [{ type: 'text', text: 'More' }] }]));
    expect(JSON.stringify(sent)).not.toContain('private reasoning');
    expect(sent.input[1]).toEqual({ type: 'message', role: 'assistant', content: 'Hello' });
    expect(() => buildLlmProviderRequest(endpoint({ requiresOpaqueReasoning: true }), G3)).toThrow(unsupported);
    expect(() => buildLlmProviderRequest(endpoint({ requiresOpaqueReasoning: true }), G2)).not.toThrow();
  });

  it('LLM-C21 and C22: history without tools is sent, image results are content lists and isError keeps the specified sentence', () => {
    expect(body(withMessages(G3.messages)).input).toHaveLength(3);
    expect(body(withMessages(G3.messages)).tools).toBeUndefined();
    const failed: LlmMessage = { ...RESULT, isError: true, content: [{ type: 'text', text: 'timeout' }, { type: 'text', text: 'try later' }] };
    expect(body(withMessages([ASK, { role: 'assistant', content: [CALL] }, failed])).input[2].output).toBe('Tool execution failed.\ntimeout\ntry later');
    const image: LlmMessage = { ...RESULT, content: [{ type: 'text', text: 'chart' }, PNG] };
    const imageOutput = [{ type: 'input_text', text: 'chart' }, { type: 'input_image', image_url: 'data:image/png;base64,iVBORw0KGgo=', detail: 'auto' }];
    expect(body(withMessages([ASK, { role: 'assistant', content: [CALL] }, image])).input[2].output).toEqual(imageOutput);
    expect(body(withMessages([ASK, { role: 'assistant', content: [CALL] }, { ...image, isError: true }])).input[2].output).toEqual([{ type: 'input_text', text: 'Tool execution failed.' }, ...imageOutput]);
  });

  it('reports what the dialect cannot express as unsupported before any request is built', () => {
    const cases: LlmGenerationRequest[] = [
      withMessages([ASK], { temperature: 2.1 }),
      withMessages([ASK], { temperature: -0.1 }),
      withMessages([{ role: 'system', content: [PNG] }, ASK]),
      withMessages([{ role: 'system', content: [{ type: 'text', text: 'Only instructions.' }] }]),
      withMessages([ASK, { role: 'assistant', content: [PNG] }]),
    ];
    for (const request of cases) expect(() => buildLlmProviderRequest(endpoint(), request)).toThrow(unsupported);
    expect(body(withMessages([ASK], { temperature: 2 })).temperature).toBe(2);
    expect(body(withMessages([ASK], { maxTokens: 50 }), { maxOutputTokens: 100 }).max_output_tokens).toBe(50);
  });

  it('asks for reasoning summaries only when the endpoint opts in', () => {
    expect(body(G2).reasoning).toBeUndefined();
    expect(body(G2, { responses: { reasoningSummary: 'auto' } }).reasoning).toEqual({ summary: 'auto' });
  });
});

describe('Responses chatgpt-sign-in profile', () => {
  it('always streams with store false and groups function tools in one namespace', () => {
    const sent = body(G3, SIGN_IN);
    expect(sent).toMatchObject({ stream: true, store: false, tool_choice: 'auto' });
    expect(sent.tools).toEqual([{
      type: 'namespace', name: 'napplet', description: 'Functions supplied by the calling application.',
      tools: [{ type: 'function', name: 'get_weather', description: 'Look up current weather', parameters: WEATHER.parameters, strict: false }],
    }]);
    expect(sent.input[1]).toEqual({ type: 'function_call', call_id: 'call_1', name: 'get_weather', arguments: '{"city":"Berlin"}', namespace: 'napplet' });
    expect(sent.input[2]).toEqual({ type: 'function_call_output', call_id: 'call_1', output: '18°C and clear' });
    const named = body(G3, { responses: { profile: 'chatgpt-sign-in', toolNamespace: { name: 'crm', description: 'Customer records.' } } });
    expect(named.tools[0]).toMatchObject({ type: 'namespace', name: 'crm', description: 'Customer records.' });
    expect(named.input[1].namespace).toBe('crm');
  });

  it('keeps system text in instructions and sends none of the fields the route rejects', () => {
    const sent = body(withMessages([{ role: 'system', content: [{ type: 'text', text: 'Be brief.' }] }, ASK], { format: 'json' }), SIGN_IN);
    expect(sent.instructions).toBe('Be brief.');
    expect(sent.input.map((item: { role: string }) => item.role)).toEqual(['user']);
    const rejected = ['background', 'conversation', 'max_output_tokens', 'max_tool_calls', 'metadata', 'moderation', 'multi_agent', 'prompt', 'prompt_cache_retention', 'safety_identifier', 'temperature', 'top_logprobs', 'top_p', 'truncation', 'user', 'previous_response_id'];
    for (const field of rejected) expect(field in sent, field).toBe(false);
    expect(sent.tools).toBeUndefined();
  });

  it('answers unsupported for an output limit, a temperature, a forced tool name and tool history without tools', () => {
    const build = (request: LlmGenerationRequest, extra: Partial<LlmProviderEndpoint> = {}) => () => buildLlmProviderRequest(endpoint({ ...SIGN_IN, ...extra }), request);
    expect(build(withMessages([ASK], { maxTokens: 64 }))).toThrow(unsupported);
    expect(build(withMessages([ASK]), { maxOutputTokens: 64 })).toThrow(unsupported);
    expect(build(withMessages([ASK], { temperature: 0 }))).toThrow(unsupported);
    expect(build(withMessages([ASK], { tools: [WEATHER], toolChoice: { type: 'tool', name: 'get_weather' } }))).toThrow(unsupported);
    expect(build(withMessages(G3.messages))).toThrow(unsupported);
    expect(build(withMessages([ASK], { tools: [WEATHER], toolChoice: 'required' }))).not.toThrow();
  });

  it('reads the stream on the buffered provider path without forwarding deltas', async () => {
    const calls: Array<{ body: string }> = [];
    const deltas: LlmBlockEvent[] = [];
    const final = response([message('Héllo')]);
    const events = [
      { type: 'response.output_text.delta', output_index: 0, content_index: 0, item_id: 'msg_1', delta: 'Héllo', logprobs: [], sequence_number: 1 },
      { type: 'response.completed', response: final, sequence_number: 2 },
    ];
    const generate = createHttpLlmProvider({ fetch: async (_url, init) => { calls.push(init); return sse(events); } });
    await expect(generate(endpoint(SIGN_IN), withMessages([ASK]), new AbortController().signal, (event) => deltas.push(event)))
      .resolves.toEqual({ content: [{ type: 'text', text: 'Héllo' }], finish: 'stop', usage });
    expect(JSON.parse(calls[0]!.body).stream).toBe(true);
    expect(deltas).toEqual([]);
    const streaming = createHttpLlmProvider({ stream: true, fetch: async () => sse(events) });
    await streaming(endpoint(SIGN_IN), withMessages([ASK]), new AbortController().signal, (event) => deltas.push(event));
    expect(deltas.map((event) => event.event)).toEqual(['start', 'delta', 'end']);
  });
});

describe('buffered Responses output', () => {
  it('maps message text, reasoning summaries, function calls and usage', () => {
    expect(parseLlmProviderResponse('openai-responses', response([message('{"a":1}')]))).toEqual({ content: [{ type: 'text', text: '{"a":1}' }], finish: 'stop', usage });
    expect(parseLlmProviderResponse('openai-responses', response([reasoning('plan', 'refine'), message('Checking.'), functionCall('call_1', '{"city":"Berlin"}')]))).toEqual({
      content: [{ type: 'thinking', text: 'plan' }, { type: 'thinking', text: 'refine' }, { type: 'text', text: 'Checking.' }, CALL],
      finish: 'toolUse',
      usage,
    });
    expect(parseLlmProviderResponse('openai-responses', response([{ id: 'rs_1', type: 'reasoning', summary: [], content: [{ type: 'reasoning_text', text: 'raw' }] }, message('Hi')])).content)
      .toEqual([{ type: 'thinking', text: 'raw' }, { type: 'text', text: 'Hi' }]);
    // Encrypted or empty reasoning items carry nothing to display.
    expect(parseLlmProviderResponse('openai-responses', response([{ id: 'rs_1', type: 'reasoning', summary: [], encrypted_content: 'opaque' }, message('Hi')], { usage: undefined })))
      .toEqual({ content: [{ type: 'text', text: 'Hi' }], finish: 'stop' });
  });

  it('LLM-C10 and C15: incomplete responses keep length or refusal and lose their calls', () => {
    const half = [message('Working'), functionCall('call_1', '{"city":')];
    expect(parseLlmProviderResponse('openai-responses', incomplete(half, 'max_output_tokens'))).toEqual({ content: [{ type: 'text', text: 'Working' }], finish: 'length', usage });
    expect(parseLlmProviderResponse('openai-responses', incomplete(half, 'content_filter'))).toEqual({ content: [{ type: 'text', text: 'Working' }], finish: 'refusal', usage });
    const refusal = { id: 'msg_1', type: 'message', status: 'completed', role: 'assistant', content: [{ type: 'refusal', refusal: 'I can\'t help with that.' }] };
    expect(parseLlmProviderResponse('openai-responses', response([refusal]))).toEqual({ content: [], finish: 'refusal', usage });
  });

  it('LLM-C14: a call without an id gets a synthesized one and absent arguments mean an empty object', () => {
    const call = parseLlmProviderResponse('openai-responses', response([functionCall(undefined, '')])).content[0] as { toolCallId: string; arguments: unknown };
    expect(call.toolCallId).toMatch(/^call_.+/);
    expect(call.arguments).toEqual({});
  });

  it('missing markers, failures and malformed calls are provider-error without the provider body', () => {
    const bad: unknown[] = [
      response([message('x')], { status: 'in_progress' }),
      response([message('x')], { status: undefined }),
      incomplete([message('x')], 'max_messages'),
      response([], { status: 'failed', error: { code: 'server_error', message: `bad key ${KEY}` } }),
      response([functionCall('c', `{"city": "${KEY}"`)]),
      response([functionCall('c', `["${KEY}"]`)]),
      response([functionCall('c', '{}', null)]),
      { error: { message: `bad key ${KEY}` } },
      'text',
      null,
    ];
    for (const reply of bad) {
      let caught: unknown;
      try { parseLlmProviderResponse('openai-responses', reply); } catch (error) { caught = error; }
      expect(caught).toEqual(providerError);
      expect(JSON.stringify(caught)).not.toContain(KEY);
      expect((caught as Error).message).not.toContain(KEY);
    }
  });
});

describe('LLM-C18: streamed Responses blocks', () => {
  const item = (type: string, index: number, value: unknown) => ({ type, output_index: index, item: value });
  const textDelta = (index: number, delta: string) => ({ type: 'response.output_text.delta', output_index: index, content_index: 0, item_id: 'msg_1', delta, logprobs: [] });
  const argsDelta = (index: number, delta: string) => ({ type: 'response.function_call_arguments.delta', output_index: index, item_id: 'fc_1', delta });
  const summaryDelta = (index: number, summary: number, delta: string) => ({ type: 'response.reasoning_summary_text.delta', output_index: index, summary_index: summary, item_id: 'rs_1', delta });
  const done = (final: unknown, type = 'response.completed') => ({ type, response: final });

  it('streams reasoning, text and interleaved calls as ordered blocks and resolves the terminal output', () => {
    const second = { ...functionCall('call_2', '{}', 'get_time'), id: 'fc_2' };
    const final = response([reasoning('plan'), message('Checking.'), functionCall('call_1', '{"city":"Berlin"}'), second]);
    const { blocks, result } = run([
      { type: 'response.created', response: response([], { status: 'in_progress', usage: null }) },
      { type: 'response.in_progress', response: response([], { status: 'in_progress', usage: null }) },
      item('response.output_item.added', 0, { id: 'rs_1', type: 'reasoning', summary: [] }),
      { type: 'response.reasoning_summary_part.added', output_index: 0, summary_index: 0, item_id: 'rs_1', part: { type: 'summary_text', text: '' } },
      summaryDelta(0, 0, 'pl'),
      summaryDelta(0, 0, 'an'),
      { type: 'response.reasoning_summary_text.done', output_index: 0, summary_index: 0, item_id: 'rs_1', text: 'plan' },
      item('response.output_item.done', 0, reasoning('plan')),
      item('response.output_item.added', 1, { id: 'msg_1', type: 'message', status: 'in_progress', role: 'assistant', content: [] }),
      { type: 'response.content_part.added', output_index: 1, content_index: 0, item_id: 'msg_1', part: { type: 'output_text', text: '', annotations: [] } },
      textDelta(1, 'Check'),
      textDelta(1, 'ing.'),
      { type: 'response.output_text.done', output_index: 1, content_index: 0, item_id: 'msg_1', text: 'Checking.', logprobs: [] },
      item('response.output_item.done', 1, message('Checking.')),
      item('response.output_item.added', 2, functionCall('call_1', '')),
      item('response.output_item.added', 3, { ...second, arguments: '' }),
      argsDelta(2, '{"city":'),
      argsDelta(3, '{}'),
      argsDelta(2, '"Berlin"}'),
      { type: 'response.function_call_arguments.done', output_index: 2, item_id: 'fc_1', arguments: '{"city":"Berlin"}' },
      item('response.output_item.done', 2, functionCall('call_1', '{"city":"Berlin"}')),
      item('response.output_item.done', 3, second),
      done(final),
    ]);
    expect(blocks).toEqual([
      { event: 'start', block: 'thinking', blockIndex: 0 },
      { event: 'delta', block: 'thinking', blockIndex: 0, text: 'pl' },
      { event: 'delta', block: 'thinking', blockIndex: 0, text: 'an' },
      { event: 'end', block: 'thinking', blockIndex: 0 },
      { event: 'start', block: 'text', blockIndex: 1 },
      { event: 'delta', block: 'text', blockIndex: 1, text: 'Check' },
      { event: 'delta', block: 'text', blockIndex: 1, text: 'ing.' },
      { event: 'end', block: 'text', blockIndex: 1 },
      { event: 'start', block: 'toolCall', blockIndex: 2, toolCallId: 'call_1', name: 'get_weather' },
      { event: 'start', block: 'toolCall', blockIndex: 3, toolCallId: 'call_2', name: 'get_time' },
      { event: 'delta', block: 'toolCall', blockIndex: 2, text: '{"city":' },
      { event: 'delta', block: 'toolCall', blockIndex: 3, text: '{}' },
      { event: 'delta', block: 'toolCall', blockIndex: 2, text: '"Berlin"}' },
      { event: 'end', block: 'toolCall', blockIndex: 2 },
      { event: 'end', block: 'toolCall', blockIndex: 3 },
    ]);
    expect(result).toEqual(parseLlmProviderResponse('openai-responses', final));
    expect(result.content).toEqual([{ type: 'thinking', text: 'plan' }, { type: 'text', text: 'Checking.' }, CALL, { type: 'toolCall', toolCallId: 'call_2', name: 'get_time', arguments: {} }]);
    expect(result.finish).toBe('toolUse');
    // The service's own lifecycle and block-match checks accept the stream against its terminal result.
    const tracker = createLlmDeltaTracker();
    expect(blocks.every((event) => tracker.accept(event))).toBe(true);
    expect(checkTerminal({ handle: 'h', messages: [ASK], tools: [WEATHER, { name: 'get_time' }] }, result, tracker)).toEqual(result);
  });

  it('sends an item whole when the server streamed no fragments for it', () => {
    const final = response([reasoning('plan'), message('Hi'), functionCall('call_1', '{"city":"Berlin"}')]);
    const { blocks, result } = run([
      item('response.output_item.done', 0, reasoning('plan')),
      item('response.output_item.done', 1, message('Hi')),
      item('response.output_item.done', 2, functionCall('call_1', '{"city":"Berlin"}')),
      done(final),
    ]);
    expect(blocks).toEqual([
      { event: 'start', block: 'thinking', blockIndex: 0 }, { event: 'delta', block: 'thinking', blockIndex: 0, text: 'plan' }, { event: 'end', block: 'thinking', blockIndex: 0 },
      { event: 'start', block: 'text', blockIndex: 1 }, { event: 'delta', block: 'text', blockIndex: 1, text: 'Hi' }, { event: 'end', block: 'text', blockIndex: 1 },
      { event: 'start', block: 'toolCall', blockIndex: 2, toolCallId: 'call_1', name: 'get_weather' }, { event: 'delta', block: 'toolCall', blockIndex: 2, text: '{"city":"Berlin"}' }, { event: 'end', block: 'toolCall', blockIndex: 2 },
    ]);
    expect(result).toEqual(parseLlmProviderResponse('openai-responses', final));
  });

  it('assembles the result from streamed items when the terminal output is empty', () => {
    const { blocks, result } = run([
      textDelta(0, 'Let me check.'),
      item('response.output_item.added', 1, functionCall('call_1', '')),
      argsDelta(1, '{"city":"Berlin"}'),
      done(response([])),
    ]);
    expect(blocks.slice(-2)).toEqual([{ event: 'end', block: 'text', blockIndex: 0 }, { event: 'end', block: 'toolCall', blockIndex: 1 }]);
    expect(result).toEqual({ content: [{ type: 'text', text: 'Let me check.' }, CALL], finish: 'toolUse', usage });
    // The event type is the marker when the nested response carries no status.
    expect(run([textDelta(0, 'Hi'), done({ output: [] })]).result).toEqual({ content: [{ type: 'text', text: 'Hi' }], finish: 'stop' });
  });

  it('a call with no argument fragments emits a single {} fragment before end', () => {
    const { blocks } = run([item('response.output_item.added', 0, functionCall('c', '', 'ping')), item('response.output_item.done', 0, functionCall('c', '', 'ping')), done(response([functionCall('c', '', 'ping')]))]);
    expect(blocks).toEqual([
      { event: 'start', block: 'toolCall', blockIndex: 0, toolCallId: 'c', name: 'ping' },
      { event: 'delta', block: 'toolCall', blockIndex: 0, text: '{}' },
      { event: 'end', block: 'toolCall', blockIndex: 0 },
    ]);
  });

  it('LLM-C10 and C15: response.incomplete maps max_output_tokens to length and content_filter to refusal, without calls', () => {
    const events = [textDelta(0, 'Working'), item('response.output_item.added', 1, functionCall('call_1', '')), argsDelta(1, '{"city":')];
    const half = [message('Working'), { ...functionCall('call_1', '{"city":'), status: 'incomplete' }];
    expect(run([...events, done(incomplete(half, 'max_output_tokens'), 'response.incomplete')]).result).toEqual({ content: [{ type: 'text', text: 'Working' }], finish: 'length', usage });
    expect(run([...events, done(incomplete([], 'max_output_tokens'), 'response.incomplete')]).result).toEqual({ content: [{ type: 'text', text: 'Working' }], finish: 'length', usage });
    expect(run([...events, done(incomplete(half, 'content_filter'), 'response.incomplete')]).result.finish).toBe('refusal');
    expect(() => run([...events, done(incomplete(half, 'max_messages'), 'response.incomplete')])).toThrow(providerError);
  });

  it('a streamed refusal resolves refusal with no content', () => {
    const refusal = { id: 'msg_1', type: 'message', status: 'completed', role: 'assistant', content: [{ type: 'refusal', refusal: 'No.' }] };
    const delta = { type: 'response.refusal.delta', output_index: 0, content_index: 0, item_id: 'msg_1', delta: 'No.' };
    expect(run([delta, done(response([refusal]))]).result).toEqual({ content: [], finish: 'refusal', usage });
    expect(run([delta, done(response([]))]).result).toEqual({ content: [], finish: 'refusal', usage });
    expect(run([item('response.output_item.done', 0, refusal), done(response([]))]).result.finish).toBe('refusal');
  });

  it('error and response.failed events, a missing terminal event and bad completed calls are provider-error without the body', () => {
    const failures: unknown[][] = [
      [{ type: 'error', code: 'server_error', message: KEY, param: null }],
      [{ type: 'response.failed', response: response([], { status: 'failed', error: { code: 'rate_limit_exceeded', message: KEY } }) }],
      [textDelta(0, 'partial')],
      [item('response.output_item.added', 0, functionCall('c', '')), argsDelta(0, '{"city":'), done(response([]))],
      [done(response([functionCall('c', `["${KEY}"]`)]))],
    ];
    for (const events of failures) {
      let caught: unknown;
      try { run(events); } catch (error) { caught = error; }
      expect(caught).toEqual(providerError);
      expect((caught as Error).message).not.toContain(KEY);
    }
  });
});
