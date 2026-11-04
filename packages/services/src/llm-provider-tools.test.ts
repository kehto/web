/**
 * NAP-LLM provider dialect conformance for tools, thinking and block deltas.
 * Authority: napplet/naps PR #134 at 5e93bdfce0e84c0de728234cb7b3feed498f8635,
 * cases LLM-C14..C18 and C22 (plus the dialect halves of C03, C19 and C21), using
 * the spec's own g2/g3/g4 vectors. Event shapes follow each provider's documented
 * request, response and streaming formats.
 */
import { describe, expect, it } from 'vitest';
import { buildLlmProviderRequest, parseLlmProviderResponse, type LlmProviderEndpoint, type LlmProviderProtocol } from './llm-providers.js';
import { createLlmStreamAccumulator } from './llm-provider-stream.js';
import { createLlmBlockBuilder } from './llm-provider-blocks.js';
import type { LlmBlockEvent, LlmGeneration, LlmGenerationRequest, LlmMessage } from './llm-types.js';

const KEY = 'sk-planted-secret';
const WEATHER = { name: 'get_weather', description: 'Look up current weather', parameters: { type: 'object', properties: { city: { type: 'string' } }, required: ['city'] } };
const ASK: LlmMessage = { role: 'user', content: [{ type: 'text', text: 'What is the weather in Berlin?' }] };
const CALL = { type: 'toolCall' as const, toolCallId: 'call_1', name: 'get_weather', arguments: { city: 'Berlin' } };
const RESULT: LlmMessage = { role: 'toolResult', toolCallId: 'call_1', toolName: 'get_weather', content: [{ type: 'text', text: '18°C and clear' }] };
const G2: LlmGenerationRequest = { handle: 'h', messages: [ASK], tools: [WEATHER], toolChoice: 'auto' };
const G3: LlmGenerationRequest = { handle: 'h', messages: [ASK, { role: 'assistant', content: [CALL] }, RESULT], tools: [WEATHER], toolChoice: 'auto' };
const EXPECTED_CALL = { content: [CALL], finish: 'toolUse' };

const endpoint = (protocol: LlmProviderProtocol, extra: Partial<LlmProviderEndpoint> = {}): LlmProviderEndpoint => ({ protocol, baseUrl: 'https://api.example.test/v1', model: 'm-1', credential: KEY, ...extra });
const body = (protocol: LlmProviderProtocol, request: LlmGenerationRequest, extra: Partial<LlmProviderEndpoint> = {}) =>
  JSON.parse(buildLlmProviderRequest(endpoint(protocol, extra), request).body) as Record<string, any>;
const unsupported = expect.objectContaining({ code: 'unsupported' });
const providerError = expect.objectContaining({ code: 'provider-error' });
const withMessages = (messages: LlmMessage[], extra: Partial<LlmGenerationRequest> = {}): LlmGenerationRequest => ({ handle: 'h', messages, ...extra });

/** Feed provider events through an accumulator, collecting block events and the generation. */
function run(protocol: LlmProviderProtocol, events: unknown[]): { blocks: LlmBlockEvent[]; result: LlmGeneration } {
  const accumulator = createLlmStreamAccumulator(protocol);
  const blocks: LlmBlockEvent[] = [];
  for (const event of events) blocks.push(...accumulator.push(event));
  return { blocks, result: accumulator.finish() };
}

const openAiChunk = (delta: Record<string, unknown>, finish: string | null = null) => ({ choices: [{ index: 0, delta, finish_reason: finish }] });

describe('tool request mapping', () => {
  it('maps tools, tool_choice, assistant calls and tool results for OpenAI Chat Completions', () => {
    const sent = body('openai-chat', G3);
    expect(sent.tools).toEqual([{ type: 'function', function: { name: 'get_weather', description: 'Look up current weather', parameters: WEATHER.parameters } }]);
    expect(sent.tool_choice).toBe('auto');
    expect(sent.messages).toEqual([
      { role: 'user', content: 'What is the weather in Berlin?' },
      { role: 'assistant', content: null, tool_calls: [{ id: 'call_1', type: 'function', function: { name: 'get_weather', arguments: '{"city":"Berlin"}' } }] },
      { role: 'tool', tool_call_id: 'call_1', content: '18°C and clear' },
    ]);
    expect(body('openai-chat', withMessages([ASK], { tools: [{ name: 'a' }], toolChoice: { type: 'tool', name: 'a' } })).tool_choice).toEqual({ type: 'function', function: { name: 'a' } });
    expect(body('openai-chat', withMessages([ASK], { tools: [{ name: 'a' }], toolChoice: 'required' })).tool_choice).toBe('required');
    expect(body('openai-chat', withMessages([ASK], { tools: [{ name: 'a' }] })).tool_choice).toBeUndefined();
    expect(body('openai-chat', withMessages([ASK])).tools).toBeUndefined();
    expect(body('openai-chat', withMessages([ASK], { tools: [] })).tools).toBeUndefined();
  });

  it('gives a tool without parameters the specified empty object schema', () => {
    const empty = { type: 'object', properties: {}, additionalProperties: false };
    const request = withMessages([ASK], { tools: [{ name: 'ping' }] });
    expect(body('openai-chat', request).tools[0].function).toEqual({ name: 'ping', parameters: empty });
    expect(body('anthropic-messages', request).tools[0]).toEqual({ name: 'ping', input_schema: empty });
    expect(body('gemini', request).tools[0].functionDeclarations[0]).toEqual({ name: 'ping', parametersJsonSchema: empty });
  });

  it('maps tools, tool_choice, tool_use blocks and merged tool_result turns for Anthropic Messages', () => {
    const sent = body('anthropic-messages', G3);
    expect(sent.tools).toEqual([{ name: 'get_weather', description: 'Look up current weather', input_schema: WEATHER.parameters }]);
    expect(sent.tool_choice).toEqual({ type: 'auto' });
    expect(sent.messages).toEqual([
      { role: 'user', content: [{ type: 'text', text: 'What is the weather in Berlin?' }] },
      { role: 'assistant', content: [{ type: 'tool_use', id: 'call_1', name: 'get_weather', input: { city: 'Berlin' } }] },
      { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'call_1', content: [{ type: 'text', text: '18°C and clear' }] }] },
    ]);
    const choices: Array<[LlmGenerationRequest['toolChoice'], unknown]> = [['none', { type: 'none' }], ['required', { type: 'any' }], [{ type: 'tool', name: 'a' }, { type: 'tool', name: 'a' }]];
    for (const [choice, expected] of choices) {
      expect(body('anthropic-messages', withMessages([ASK], { tools: [{ name: 'a' }], toolChoice: choice })).tool_choice).toEqual(expected);
    }
    // Results answering one turn merge into a single user turn, ahead of later user text.
    const second = { type: 'toolCall' as const, toolCallId: 'call_2', name: 'get_time', arguments: {} };
    const merged = body('anthropic-messages', withMessages([
      ASK, { role: 'assistant', content: [CALL, second] }, RESULT,
      { role: 'toolResult', toolCallId: 'call_2', toolName: 'get_time', content: [{ type: 'text', text: '10:00' }] },
      { role: 'user', content: [{ type: 'text', text: 'Thanks' }] },
    ], { tools: [WEATHER, { name: 'get_time' }] }));
    expect(merged.messages[2].content.map((block: { type: string }) => block.type)).toEqual(['tool_result', 'tool_result', 'text']);
  });

  it('maps functionDeclarations, functionCallingConfig and regrouped functionResponse parts for Gemini', () => {
    const sent = body('gemini', G3);
    expect(sent.tools).toEqual([{ functionDeclarations: [{ name: 'get_weather', description: 'Look up current weather', parametersJsonSchema: WEATHER.parameters }] }]);
    expect(sent.toolConfig).toEqual({ functionCallingConfig: { mode: 'AUTO' } });
    expect(sent.contents).toEqual([
      { role: 'user', parts: [{ text: 'What is the weather in Berlin?' }] },
      { role: 'model', parts: [{ functionCall: { name: 'get_weather', args: { city: 'Berlin' } } }] },
      { role: 'user', parts: [{ functionResponse: { name: 'get_weather', response: { output: '18°C and clear' } } }] },
    ]);
    const modes: Array<[LlmGenerationRequest['toolChoice'], unknown]> = [
      ['none', { functionCallingConfig: { mode: 'NONE' } }],
      ['required', { functionCallingConfig: { mode: 'ANY' } }],
      [{ type: 'tool', name: 'a' }, { functionCallingConfig: { mode: 'ANY', allowedFunctionNames: ['a'] } }],
    ];
    for (const [choice, expected] of modes) {
      expect(body('gemini', withMessages([ASK], { tools: [{ name: 'a' }], toolChoice: choice })).toolConfig).toEqual(expected);
    }
    // Results regroup into one user content in the assistant's call order, whatever order they arrive in.
    const second = { type: 'toolCall' as const, toolCallId: 'call_2', name: 'get_time', arguments: {} };
    const secondResult: LlmMessage = { role: 'toolResult', toolCallId: 'call_2', toolName: 'get_time', content: [{ type: 'text', text: '10:00' }] };
    const regrouped = body('gemini', withMessages([ASK, { role: 'assistant', content: [CALL, second] }, secondResult, RESULT], { tools: [WEATHER, { name: 'get_time' }] }));
    expect(regrouped.contents[2]).toEqual({ role: 'user', parts: [
      { functionResponse: { name: 'get_weather', response: { output: '18°C and clear' } } },
      { functionResponse: { name: 'get_time', response: { output: '10:00' } } },
    ] });
  });

  it('LLM-C03: Gemini cannot combine JSON output with tools, and a tool-less request is unaffected', () => {
    expect(() => buildLlmProviderRequest(endpoint('gemini'), { ...G2, format: 'json' })).toThrow(unsupported);
    expect(body('gemini', withMessages([ASK], { format: 'json' })).generationConfig).toEqual({ responseMimeType: 'application/json' });
  });

  it('sends the smaller of maxTokens and the endpoint ceiling and keeps the Anthropic default', () => {
    expect(body('openai-chat', withMessages([ASK], { maxTokens: 50 }), { maxOutputTokens: 100 }).max_tokens).toBe(50);
    expect(body('openai-chat', withMessages([ASK], { maxTokens: 500 }), { maxOutputTokens: 100 }).max_tokens).toBe(100);
    expect(body('openai-chat', withMessages([ASK], { maxTokens: 500 })).max_tokens).toBe(500);
    expect(body('openai-chat', withMessages([ASK])).max_tokens).toBeUndefined();
    expect(body('anthropic-messages', withMessages([ASK])).max_tokens).toBe(4096);
    expect(body('anthropic-messages', withMessages([ASK], { maxTokens: 64 })).max_tokens).toBe(64);
    expect(body('anthropic-messages', withMessages([ASK], { maxTokens: 64 }), { maxOutputTokens: 32 }).max_tokens).toBe(32);
    expect(body('gemini', withMessages([ASK], { maxTokens: 64 }), { maxOutputTokens: 128 }).generationConfig.maxOutputTokens).toBe(64);
  });

  it('forwards temperature within the dialect range and answers unsupported outside it', () => {
    expect(body('openai-chat', withMessages([ASK], { temperature: 2 })).temperature).toBe(2);
    expect(body('gemini', withMessages([ASK], { temperature: 1.5 })).generationConfig.temperature).toBe(1.5);
    expect(body('anthropic-messages', withMessages([ASK], { temperature: 1 })).temperature).toBe(1);
    for (const [protocol, temperature] of [['openai-chat', 2.1], ['gemini', -0.1], ['anthropic-messages', 1.2]] as const) {
      expect(() => buildLlmProviderRequest(endpoint(protocol), withMessages([ASK], { temperature }))).toThrow(unsupported);
    }
  });
});

describe('LLM-C17: thinking and opaque reasoning', () => {
  const thinking: LlmMessage = { role: 'assistant', content: [{ type: 'thinking', text: 'private reasoning' }, { type: 'text', text: 'Hello' }] };

  it('omits thinking from provider input in every dialect and drops a message it leaves empty', () => {
    const thought: LlmMessage = { role: 'assistant', content: [{ type: 'thinking', text: 'private reasoning' }] };
    const history = withMessages([ASK, thinking, thought, { role: 'user', content: [{ type: 'text', text: 'More' }] }]);
    for (const protocol of ['openai-chat', 'anthropic-messages', 'gemini'] as const) {
      const sent = JSON.stringify(body(protocol, history));
      expect(sent, protocol).not.toContain('private reasoning');
      expect(sent, protocol).toContain('Hello');
    }
    expect(body('openai-chat', history).messages.map((message: { role: string }) => message.role)).toEqual(['user', 'assistant', 'user']);
    expect(() => buildLlmProviderRequest(endpoint('openai-chat'), withMessages([thought]))).toThrow(unsupported);
  });

  it('is unsupported before any request when the endpoint requires opaque reasoning and history has tool calls', () => {
    expect(() => buildLlmProviderRequest(endpoint('openai-chat', { requiresOpaqueReasoning: true }), G3)).toThrow(unsupported);
    expect(() => buildLlmProviderRequest(endpoint('anthropic-messages', { requiresOpaqueReasoning: true }), G3)).toThrow(unsupported);
    // Without tool calls in history the flag changes nothing.
    expect(body('openai-chat', G2, { requiresOpaqueReasoning: true }).tools).toHaveLength(1);
  });

  it('defaults the flag from the Gemini model name, and an explicit value overrides it', () => {
    for (const model of ['gemini-3-pro', 'models/gemini-3.1-flash', 'gemini-12-ultra']) {
      expect(() => buildLlmProviderRequest(endpoint('gemini', { model }), G3), model).toThrow(unsupported);
    }
    for (const model of ['gemini-2.5-flash', 'gemini-1.5-pro', 'models/gemini-2.0-flash']) {
      expect(() => buildLlmProviderRequest(endpoint('gemini', { model }), G3), model).not.toThrow();
    }
    expect(() => buildLlmProviderRequest(endpoint('gemini', { model: 'gemini-3-pro', requiresOpaqueReasoning: false }), G3)).not.toThrow();
    expect(() => buildLlmProviderRequest(endpoint('gemini', { model: 'gemini-2.5-flash', requiresOpaqueReasoning: true }), G3)).toThrow(unsupported);
    // A first tool turn has no history to continue, so even Gemini 3 can start one.
    expect(() => buildLlmProviderRequest(endpoint('gemini', { model: 'gemini-3-pro' }), G2)).not.toThrow();
    // The default is Gemini-only.
    expect(() => buildLlmProviderRequest(endpoint('openai-chat', { model: 'gemini-3-pro' }), G3)).not.toThrow();
  });
});

describe('LLM-C21 and C22: history and tool results', () => {
  it('LLM-C21: completed history without current tools is sent by OpenAI and Gemini and unsupported on Anthropic', () => {
    const history = withMessages(G3.messages);
    expect(body('openai-chat', history).tools).toBeUndefined();
    expect(body('openai-chat', history).messages).toHaveLength(3);
    expect(body('gemini', history).contents).toHaveLength(3);
    expect(() => buildLlmProviderRequest(endpoint('anthropic-messages'), history)).toThrow(unsupported);
    expect(() => buildLlmProviderRequest(endpoint('anthropic-messages'), G3)).not.toThrow();
  });

  it('LLM-C22: image tool results are unsupported on OpenAI and Gemini and allowed on Anthropic', () => {
    const image: LlmMessage = { ...RESULT, content: [{ type: 'image', mimeType: 'image/png', data: 'iVBORw0KGgo=' }] };
    const request = withMessages([ASK, { role: 'assistant', content: [CALL] }, image], { tools: [WEATHER] });
    expect(() => buildLlmProviderRequest(endpoint('openai-chat'), request)).toThrow(unsupported);
    expect(() => buildLlmProviderRequest(endpoint('gemini'), request)).toThrow(unsupported);
    expect(body('anthropic-messages', request).messages[2].content[0].content).toEqual([{ type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'iVBORw0KGgo=' } }]);
  });

  it('LLM-C22: isError maps to is_error on Anthropic and to the Tool execution failed. prefix elsewhere', () => {
    const failed: LlmMessage = { ...RESULT, isError: true, content: [{ type: 'text', text: 'timeout' }, { type: 'text', text: 'try later' }] };
    const request = withMessages([ASK, { role: 'assistant', content: [CALL] }, failed], { tools: [WEATHER] });
    expect(body('anthropic-messages', request).messages[2].content[0].is_error).toBe(true);
    expect(body('anthropic-messages', request).messages[2].content[0].content).toEqual([{ type: 'text', text: 'timeout' }, { type: 'text', text: 'try later' }]);
    expect(body('openai-chat', request).messages[2]).toEqual({ role: 'tool', tool_call_id: 'call_1', content: 'Tool execution failed.\ntimeout\ntry later' });
    expect(body('gemini', request).contents[2].parts[0].functionResponse.response).toEqual({ output: 'Tool execution failed.\ntimeout\ntry later' });
    // A successful result carries no flag and no prefix.
    expect(body('anthropic-messages', G3).messages[2].content[0].is_error).toBeUndefined();
    expect(body('openai-chat', G3).messages[2].content).toBe('18°C and clear');
  });
});

describe('buffered tool responses (LLM-C14, C15, C16)', () => {
  const openAiCall = (id: unknown, args: unknown, name: unknown = 'get_weather') => ({ id, type: 'function', function: { name, arguments: args } });
  const openAiReply = (calls: unknown[], finish: string, extra: Record<string, unknown> = {}) =>
    ({ choices: [{ message: { content: null, tool_calls: calls, ...extra }, finish_reason: finish }], usage: { prompt_tokens: 31, completion_tokens: 12 } });
  const anthropicReply = (content: unknown[], stop: string) => ({ content, stop_reason: stop, usage: { input_tokens: 31, output_tokens: 12 } });
  const geminiReply = (parts: unknown[], finish = 'STOP') => ({ candidates: [{ content: { parts }, finishReason: finish }], usageMetadata: { promptTokenCount: 31, candidatesTokenCount: 12 } });
  const usage = { inputTokens: 31, outputTokens: 12 };

  it('parses the spec g2 call in all three dialects', () => {
    expect(parseLlmProviderResponse('openai-chat', openAiReply([openAiCall('call_1', '{"city":"Berlin"}')], 'tool_calls'))).toEqual({ ...EXPECTED_CALL, usage });
    expect(parseLlmProviderResponse('anthropic-messages', anthropicReply([{ type: 'tool_use', id: 'call_1', name: 'get_weather', input: { city: 'Berlin' } }], 'tool_use'))).toEqual({ ...EXPECTED_CALL, usage });
    expect(parseLlmProviderResponse('gemini', geminiReply([{ functionCall: { id: 'call_1', name: 'get_weather', args: { city: 'Berlin' } } }]))).toEqual({ ...EXPECTED_CALL, usage });
  });

  it('LLM-C15: completed calls under different normal stop labels all become toolUse', () => {
    for (const label of ['stop', 'tool_calls']) {
      expect(parseLlmProviderResponse('openai-chat', openAiReply([openAiCall('call_1', '{"city":"Berlin"}')], label)).finish, label).toBe('toolUse');
    }
    for (const label of ['end_turn', 'tool_use', 'stop_sequence']) {
      expect(parseLlmProviderResponse('anthropic-messages', anthropicReply([{ type: 'tool_use', id: 'c', name: 'get_weather', input: {} }], label)).finish, label).toBe('toolUse');
    }
    expect(parseLlmProviderResponse('gemini', geminiReply([{ functionCall: { name: 'get_weather', args: {} } }], 'STOP')).finish).toBe('toolUse');
  });

  it('LLM-C15: a parallel turn truncated or refused after one completed call keeps its finish and has no toolCall parts', () => {
    const half = [openAiCall('call_1', '{"city":"Berlin"}'), openAiCall('call_2', '{"city":')];
    expect(parseLlmProviderResponse('openai-chat', openAiReply(half, 'length'))).toEqual({ content: [], finish: 'length', usage });
    expect(parseLlmProviderResponse('openai-chat', openAiReply(half, 'content_filter'))).toEqual({ content: [], finish: 'refusal', usage });
    const anthropic = [{ type: 'text', text: 'Working' }, { type: 'tool_use', id: 'c1', name: 'get_weather', input: { city: 'Berlin' } }];
    expect(parseLlmProviderResponse('anthropic-messages', anthropicReply(anthropic, 'max_tokens'))).toEqual({ content: [{ type: 'text', text: 'Working' }], finish: 'length', usage });
    expect(parseLlmProviderResponse('anthropic-messages', anthropicReply(anthropic, 'refusal')).finish).toBe('refusal');
    const gemini = [{ functionCall: { name: 'get_weather', args: { city: 'Berlin' } } }];
    expect(parseLlmProviderResponse('gemini', geminiReply(gemini, 'MAX_TOKENS'))).toEqual({ content: [], finish: 'length', usage });
    expect(parseLlmProviderResponse('gemini', geminiReply(gemini, 'SAFETY')).finish).toBe('refusal');
  });

  it('LLM-C14: a call without an id gets one synthesized id; absent arguments mean an empty object', () => {
    const reply = parseLlmProviderResponse('openai-chat', openAiReply([openAiCall(undefined, '')], 'tool_calls'));
    const call = reply.content[0] as { toolCallId: string; arguments: unknown };
    expect(call.toolCallId).toMatch(/^call_.+/);
    expect(call.arguments).toEqual({});
    const gemini = parseLlmProviderResponse('gemini', geminiReply([{ functionCall: { name: 'get_weather' } }]));
    expect(gemini.content[0]).toMatchObject({ type: 'toolCall', arguments: {} });
    const [first, second] = [0, 1].map(() => (parseLlmProviderResponse('anthropic-messages', anthropicReply([{ type: 'tool_use', name: 'a', input: {} }], 'tool_use')).content[0] as { toolCallId: string }).toolCallId);
    expect(first).not.toBe(second);
    // The synthesized id round-trips through the request builder.
    const history = withMessages([ASK, { role: 'assistant', content: [call as never] }, { ...RESULT, toolCallId: call.toolCallId }], { tools: [WEATHER] });
    expect(body('openai-chat', history).messages[1].tool_calls[0].id).toBe(call.toolCallId);
    expect(body('openai-chat', history).messages[2].tool_call_id).toBe(call.toolCallId);
  });

  it('LLM-C16: malformed or non-object arguments and a missing name are provider-error without the provider body', () => {
    const bad: Array<[LlmProviderProtocol, unknown]> = [
      ['openai-chat', openAiReply([openAiCall('c', `{"city": "${KEY}"`)], 'tool_calls')],
      ['openai-chat', openAiReply([openAiCall('c', `["${KEY}"]`)], 'tool_calls')],
      ['openai-chat', openAiReply([openAiCall('c', '"text"')], 'tool_calls')],
      ['openai-chat', openAiReply([openAiCall('c', '{}', null)], 'tool_calls')],
      ['anthropic-messages', anthropicReply([{ type: 'tool_use', id: 'c', name: 'get_weather', input: [KEY] }], 'tool_use')],
      ['anthropic-messages', anthropicReply([{ type: 'tool_use', id: 'c', input: {} }], 'tool_use')],
      ['anthropic-messages', anthropicReply([{ type: 'tool_use', id: 'c', name: 'get_weather', input: null }], 'tool_use')],
      ['gemini', geminiReply([{ functionCall: { name: 'get_weather', args: [KEY] } }])],
      ['gemini', geminiReply([{ functionCall: { args: {} } }])],
    ];
    for (const [protocol, reply] of bad) {
      let caught: unknown;
      try { parseLlmProviderResponse(protocol, reply); } catch (error) { caught = error; }
      expect(caught, protocol).toEqual(providerError);
      expect(JSON.stringify(caught), protocol).not.toContain(KEY);
      expect((caught as Error).message, protocol).not.toContain(KEY);
    }
  });

  it('keeps reasoning as thinking parts and omits redacted blocks', () => {
    expect(parseLlmProviderResponse('openai-chat', { choices: [{ message: { content: 'Hi', reasoning_content: 'let me think' }, finish_reason: 'stop' }] }).content)
      .toEqual([{ type: 'thinking', text: 'let me think' }, { type: 'text', text: 'Hi' }]);
    expect(parseLlmProviderResponse('openai-chat', { choices: [{ message: { content: 'Hi', reasoning: 'hmm' }, finish_reason: 'stop' }] }).content[0]).toEqual({ type: 'thinking', text: 'hmm' });
    expect(parseLlmProviderResponse('anthropic-messages', anthropicReply([
      { type: 'thinking', thinking: 'plan', signature: 'sig' }, { type: 'redacted_thinking', data: 'opaque' }, { type: 'text', text: 'Done' },
    ], 'end_turn')).content).toEqual([{ type: 'thinking', text: 'plan' }, { type: 'text', text: 'Done' }]);
    expect(parseLlmProviderResponse('gemini', geminiReply([{ text: 'weigh options', thought: true }, { text: 'Answer' }])).content)
      .toEqual([{ type: 'thinking', text: 'weigh options' }, { type: 'text', text: 'Answer' }]);
  });

  it('reports cache and reasoning usage only when the provider does', () => {
    expect(parseLlmProviderResponse('openai-chat', { choices: [{ message: { content: 'x' }, finish_reason: 'stop' }], usage: { prompt_tokens: 5, completion_tokens: 2, prompt_tokens_details: { cached_tokens: 3 }, completion_tokens_details: { reasoning_tokens: 1 } } }).usage)
      .toEqual({ inputTokens: 5, outputTokens: 2, cacheReadTokens: 3, reasoningTokens: 1 });
    expect(parseLlmProviderResponse('anthropic-messages', { content: [], stop_reason: 'end_turn', usage: { input_tokens: 5, output_tokens: 2, cache_read_input_tokens: 4, cache_creation_input_tokens: 6 } }).usage)
      .toEqual({ inputTokens: 5, outputTokens: 2, cacheReadTokens: 4, cacheWriteTokens: 6 });
    expect(parseLlmProviderResponse('gemini', { candidates: [{ content: { parts: [{ text: 'x' }] }, finishReason: 'STOP' }], usageMetadata: { promptTokenCount: 5, candidatesTokenCount: 2, cachedContentTokenCount: 4, thoughtsTokenCount: 7 } }).usage)
      .toEqual({ inputTokens: 5, outputTokens: 2, cacheReadTokens: 4, reasoningTokens: 7 });
    expect(parseLlmProviderResponse('openai-chat', { choices: [{ message: { content: 'x' }, finish_reason: 'stop' }], usage: { prompt_tokens: 5, completion_tokens: 2, prompt_tokens_details: { cached_tokens: -1 } } }).usage)
      .toEqual({ inputTokens: 5, outputTokens: 2 });
  });
});

describe('LLM-C18: streamed tool-call blocks', () => {
  it('OpenAI: interleaved fragments yield start with id and name, an ordered lifecycle, and fragments that parse to the final arguments', () => {
    const { blocks, result } = run('openai-chat', [
      openAiChunk({ role: 'assistant', content: '' }),
      openAiChunk({ tool_calls: [{ index: 0, id: 'call_1', type: 'function', function: { name: 'get_weather', arguments: '' } }] }),
      openAiChunk({ tool_calls: [{ index: 1, id: 'call_2', type: 'function', function: { name: 'get_time', arguments: '' } }] }),
      openAiChunk({ tool_calls: [{ index: 0, function: { arguments: '{"city":' } }] }),
      openAiChunk({ tool_calls: [{ index: 1, function: { arguments: '{}' } }, { index: 0, function: { arguments: '"Berlin"}' } }] }),
      openAiChunk({}, 'tool_calls'),
      { choices: [], usage: { prompt_tokens: 31, completion_tokens: 12 } },
    ]);
    expect(blocks).toEqual([
      { event: 'start', block: 'toolCall', blockIndex: 0, toolCallId: 'call_1', name: 'get_weather' },
      { event: 'start', block: 'toolCall', blockIndex: 1, toolCallId: 'call_2', name: 'get_time' },
      { event: 'delta', block: 'toolCall', blockIndex: 0, text: '{"city":' },
      { event: 'delta', block: 'toolCall', blockIndex: 1, text: '{}' },
      { event: 'delta', block: 'toolCall', blockIndex: 0, text: '"Berlin"}' },
      { event: 'end', block: 'toolCall', blockIndex: 0 },
      { event: 'end', block: 'toolCall', blockIndex: 1 },
    ]);
    expect(result).toEqual({
      content: [CALL, { type: 'toolCall', toolCallId: 'call_2', name: 'get_time', arguments: {} }],
      finish: 'toolUse',
      usage: { inputTokens: 31, outputTokens: 12 },
    });
    const fragments = blocks.filter((event) => event.event === 'delta' && event.blockIndex === 0).map((event) => event.text).join('');
    expect(JSON.parse(fragments)).toEqual(CALL.arguments);
  });

  it('OpenAI: holds fragments until id and name are known, then flushes them in order', () => {
    const { blocks, result } = run('openai-chat', [
      openAiChunk({ tool_calls: [{ index: 0, function: { arguments: '{"city"' } }] }),
      openAiChunk({ tool_calls: [{ index: 0, id: 'call_1' }] }),
      openAiChunk({ tool_calls: [{ index: 0, function: { name: 'get_weather', arguments: ':"Berlin"}' } }] }),
      openAiChunk({}, 'tool_calls'),
    ]);
    expect(blocks).toEqual([
      { event: 'start', block: 'toolCall', blockIndex: 0, toolCallId: 'call_1', name: 'get_weather' },
      { event: 'delta', block: 'toolCall', blockIndex: 0, text: '{"city"' },
      { event: 'delta', block: 'toolCall', blockIndex: 0, text: ':"Berlin"}' },
      { event: 'end', block: 'toolCall', blockIndex: 0 },
    ]);
    expect(result.content).toEqual([CALL]);
  });

  it('LLM-C14: when the name arrives without an id a stable id is synthesized once and a later id is ignored', () => {
    const { blocks, result } = run('openai-chat', [
      openAiChunk({ tool_calls: [{ index: 0, function: { name: 'get_weather', arguments: '{}' } }] }),
      openAiChunk({ tool_calls: [{ index: 0, id: 'late_id' }] }),
      openAiChunk({}, 'stop'),
    ]);
    const start = blocks[0] as { toolCallId: string };
    expect(start.toolCallId).toMatch(/^call_.+/);
    expect(start.toolCallId).not.toBe('late_id');
    expect(result).toMatchObject({ finish: 'toolUse', content: [{ toolCallId: start.toolCallId, name: 'get_weather' }] });
  });

  it('a call with no argument fragments emits a single {} fragment before end', () => {
    const { blocks, result } = run('openai-chat', [
      openAiChunk({ tool_calls: [{ index: 0, id: 'c', function: { name: 'ping', arguments: '' } }] }),
      openAiChunk({}, 'tool_calls'),
    ]);
    expect(blocks).toEqual([
      { event: 'start', block: 'toolCall', blockIndex: 0, toolCallId: 'c', name: 'ping' },
      { event: 'delta', block: 'toolCall', blockIndex: 0, text: '{}' },
      { event: 'end', block: 'toolCall', blockIndex: 0 },
    ]);
    expect(result.content).toEqual([{ type: 'toolCall', toolCallId: 'c', name: 'ping', arguments: {} }]);
  });

  it('OpenAI: reasoning, text and a call each get a block in order of appearance, and content before finish in one chunk is kept', () => {
    const { blocks, result } = run('openai-chat', [
      openAiChunk({ reasoning_content: 'think ' }),
      openAiChunk({ reasoning_content: 'hard' }),
      openAiChunk({ content: 'Let me ' }),
      openAiChunk({ content: 'check.', tool_calls: [{ index: 0, id: 'c', function: { name: 'get_weather', arguments: '{"city":"Berlin"}' } }] }, 'tool_calls'),
    ]);
    expect(blocks.map((event) => [event.event, event.block, event.blockIndex])).toEqual([
      ['start', 'thinking', 0], ['delta', 'thinking', 0], ['delta', 'thinking', 0],
      ['start', 'text', 1], ['delta', 'text', 1], ['delta', 'text', 1],
      ['start', 'toolCall', 2], ['delta', 'toolCall', 2],
      ['end', 'thinking', 0], ['end', 'text', 1], ['end', 'toolCall', 2],
    ]);
    expect(result.content).toEqual([
      { type: 'thinking', text: 'think hard' },
      { type: 'text', text: 'Let me check.' },
      { type: 'toolCall', toolCallId: 'c', name: 'get_weather', arguments: { city: 'Berlin' } },
    ]);
  });

  it('OpenAI: a truncated turn discards its provisional calls and keeps the finish', () => {
    const { result } = run('openai-chat', [
      openAiChunk({ tool_calls: [{ index: 0, id: 'c', function: { name: 'get_weather', arguments: '{"city":' } }] }),
      openAiChunk({}, 'length'),
    ]);
    expect(result).toEqual({ content: [], finish: 'length' });
  });

  it('OpenAI: a completed turn with unparsable arguments, or a call that never got a name, is provider-error', () => {
    const tooShort = [openAiChunk({ tool_calls: [{ index: 0, id: 'c', function: { name: 'get_weather', arguments: '{"city":' } }] }), openAiChunk({}, 'tool_calls')];
    const nameless = [openAiChunk({ tool_calls: [{ index: 0, id: 'c', function: { arguments: '{}' } }] }), openAiChunk({}, 'tool_calls')];
    const notObject = [openAiChunk({ tool_calls: [{ index: 0, id: 'c', function: { name: 'a', arguments: '[1]' } }] }), openAiChunk({}, 'tool_calls')];
    for (const events of [tooShort, nameless, notObject]) expect(() => run('openai-chat', events)).toThrow(providerError);
  });

  it('Anthropic: tool_use blocks stream id and name first, redacted blocks consume no index, and indices map to Kehto indices', () => {
    const { blocks, result } = run('anthropic-messages', [
      { type: 'message_start', message: { usage: { input_tokens: 31, output_tokens: 1, cache_read_input_tokens: 4 } } },
      { type: 'content_block_start', index: 0, content_block: { type: 'redacted_thinking', data: 'opaque' } },
      { type: 'content_block_stop', index: 0 },
      { type: 'content_block_start', index: 1, content_block: { type: 'thinking', thinking: '' } },
      { type: 'content_block_delta', index: 1, delta: { type: 'thinking_delta', thinking: 'plan' } },
      { type: 'content_block_delta', index: 1, delta: { type: 'signature_delta', signature: 'sig' } },
      { type: 'content_block_stop', index: 1 },
      { type: 'content_block_start', index: 2, content_block: { type: 'tool_use', id: 'call_1', name: 'get_weather', input: {} } },
      { type: 'content_block_delta', index: 2, delta: { type: 'input_json_delta', partial_json: '' } },
      { type: 'content_block_delta', index: 2, delta: { type: 'input_json_delta', partial_json: '{"city":' } },
      { type: 'content_block_delta', index: 2, delta: { type: 'input_json_delta', partial_json: '"Berlin"}' } },
      { type: 'content_block_stop', index: 2 },
      { type: 'message_delta', delta: { stop_reason: 'tool_use' }, usage: { output_tokens: 12 } },
      { type: 'message_stop' },
    ]);
    expect(blocks).toEqual([
      { event: 'start', block: 'thinking', blockIndex: 0 },
      { event: 'delta', block: 'thinking', blockIndex: 0, text: 'plan' },
      { event: 'end', block: 'thinking', blockIndex: 0 },
      { event: 'start', block: 'toolCall', blockIndex: 1, toolCallId: 'call_1', name: 'get_weather' },
      { event: 'delta', block: 'toolCall', blockIndex: 1, text: '{"city":' },
      { event: 'delta', block: 'toolCall', blockIndex: 1, text: '"Berlin"}' },
      { event: 'end', block: 'toolCall', blockIndex: 1 },
    ]);
    expect(result).toEqual({ content: [{ type: 'thinking', text: 'plan' }, CALL], finish: 'toolUse', usage: { inputTokens: 31, outputTokens: 12, cacheReadTokens: 4 } });
  });

  it('Gemini: whole function calls stream as start, one serialised fragment and end, and STOP with a call is toolUse', () => {
    const { blocks, result } = run('gemini', [
      { candidates: [{ content: { parts: [{ text: 'Checking. ', thought: false }] } }] },
      { candidates: [{ content: { parts: [{ functionCall: { id: 'call_1', name: 'get_weather', args: { city: 'Berlin' } } }, { functionCall: { name: 'get_time' } }] }, finishReason: 'STOP' }], usageMetadata: { promptTokenCount: 31, candidatesTokenCount: 12, thoughtsTokenCount: 3 } },
    ]);
    expect(blocks.map((event) => [event.event, event.block, event.blockIndex])).toEqual([
      ['start', 'text', 0], ['delta', 'text', 0],
      ['start', 'toolCall', 1], ['delta', 'toolCall', 1], ['end', 'toolCall', 1],
      ['start', 'toolCall', 2], ['delta', 'toolCall', 2], ['end', 'toolCall', 2],
      ['end', 'text', 0],
    ]);
    expect(blocks[3]).toEqual({ event: 'delta', block: 'toolCall', blockIndex: 1, text: '{"city":"Berlin"}' });
    expect(blocks[6]).toEqual({ event: 'delta', block: 'toolCall', blockIndex: 2, text: '{}' });
    expect(result.finish).toBe('toolUse');
    expect(result.content[1]).toEqual(CALL);
    expect((result.content[2] as { toolCallId: string }).toolCallId).toMatch(/^call_/);
    expect(result.usage).toEqual({ inputTokens: 31, outputTokens: 12, reasoningTokens: 3 });
  });

  it('Gemini: MALFORMED_FUNCTION_CALL and UNEXPECTED_TOOL_CALL carry no completion marker, so they are provider-error', () => {
    for (const finishReason of ['MALFORMED_FUNCTION_CALL', 'UNEXPECTED_TOOL_CALL']) {
      expect(() => run('gemini', [{ candidates: [{ content: { parts: [] }, finishReason }] }])).toThrow(providerError);
      expect(() => parseLlmProviderResponse('gemini', { candidates: [{ content: { parts: [] }, finishReason }] })).toThrow(providerError);
    }
  });

  it('streamed stream errors never echo the provider body', () => {
    for (const protocol of ['openai-chat', 'anthropic-messages', 'gemini'] as const) {
      const event = protocol === 'anthropic-messages' ? { type: 'error', error: { message: KEY } } : { error: { message: KEY } };
      let caught: unknown;
      try { run(protocol, [event]); } catch (error) { caught = error; }
      expect(caught, protocol).toEqual(providerError);
      expect((caught as Error).message, protocol).not.toContain(KEY);
    }
  });
});

describe('block builder', () => {
  it('starts a block only on content, ends it once, and orders terminal content by index', () => {
    const blocks = createLlmBlockBuilder();
    expect(blocks.append('text', 'a', '')).toEqual([]);
    expect(blocks.append('thinking', 'b', 'hm')).toEqual([{ event: 'start', block: 'thinking', blockIndex: 0 }, { event: 'delta', block: 'thinking', blockIndex: 0, text: 'hm' }]);
    expect(blocks.append('text', 'a', 'hi')[0]).toEqual({ event: 'start', block: 'text', blockIndex: 1 });
    expect(blocks.end('b')).toEqual([{ event: 'end', block: 'thinking', blockIndex: 0 }]);
    expect(blocks.end('b')).toEqual([]);
    expect(blocks.append('thinking', 'b', 'late')).toEqual([]);
    expect(blocks.closeAll()).toEqual([{ event: 'end', block: 'text', blockIndex: 1 }]);
    expect(blocks.content(true)).toEqual([{ type: 'thinking', text: 'hm' }, { type: 'text', text: 'hi' }]);
  });
});
