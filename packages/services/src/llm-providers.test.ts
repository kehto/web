import { describe, expect, it, vi } from 'vitest';
import { buildLlmProviderRequest, parseLlmProviderResponse, type LlmProviderEndpoint } from './llm-providers.js';
import { LLM_PROVIDER_PRESETS, createHttpLlmProvider } from './llm-provider-http.js';
import { LlmServiceError, type LlmGenerationRequest } from './llm-types.js';

const KEY = 'sk-test-secret';
const REQUEST: LlmGenerationRequest = {
  handle: 'h1',
  messages: [
    { role: 'system', content: [{ type: 'text', text: 'Be brief.' }] },
    { role: 'user', content: [{ type: 'text', text: 'Describe this.' }, { type: 'image', mimeType: 'image/png', data: 'iVBORw0KGgo=' }] },
    { role: 'assistant', content: [{ type: 'text', text: 'A picture.' }] },
    { role: 'user', content: [{ type: 'text', text: 'More detail.' }] },
  ],
  format: 'json',
};

function endpoint(overrides: Partial<LlmProviderEndpoint>): LlmProviderEndpoint {
  return { protocol: 'openai-chat', baseUrl: 'https://api.example.test/v1/', model: 'm-1', credential: KEY, ...overrides };
}

describe('NAP-LLM provider mappers', () => {
  it('maps a conversation to OpenAI Chat Completions with the bearer credential only on that request', () => {
    const http = buildLlmProviderRequest(endpoint({ headers: { 'x-title': 'Paja' }, maxOutputTokens: 256 }), REQUEST);
    expect(http.url).toBe('https://api.example.test/v1/chat/completions');
    expect(http.headers).toEqual({ 'content-type': 'application/json', 'x-title': 'Paja', authorization: `Bearer ${KEY}` });
    const body = JSON.parse(http.body);
    expect(body).toMatchObject({ model: 'm-1', stream: false, max_tokens: 256, response_format: { type: 'json_object' } });
    expect(body.messages[0]).toEqual({ role: 'system', content: 'Be brief.' });
    expect(body.messages[1].content).toEqual([
      { type: 'text', text: 'Describe this.' },
      { type: 'image_url', image_url: { url: 'data:image/png;base64,iVBORw0KGgo=' } },
    ]);
    expect(http.body).not.toContain(KEY);
    const azure = buildLlmProviderRequest(endpoint({ credentialHeader: 'api-key' }), REQUEST);
    expect(azure.headers).toMatchObject({ 'api-key': KEY });
    expect('authorization' in azure.headers).toBe(false);
    expect(buildLlmProviderRequest(endpoint({ credential: undefined }), REQUEST).headers).toEqual({ 'content-type': 'application/json' });
  });

  it('parses OpenAI finish reasons, refusals and usage; missing markers are provider-error without the body', () => {
    const usage = { prompt_tokens: 3, completion_tokens: 2 };
    expect(parseLlmProviderResponse('openai-chat', { choices: [{ message: { content: '{"a":1}' }, finish_reason: 'stop' }], usage }))
      .toEqual({ text: '{"a":1}', finish: 'stop', usage: { inputTokens: 3, outputTokens: 2 } });
    expect(parseLlmProviderResponse('openai-chat', { choices: [{ message: { content: 'cut' }, finish_reason: 'length' }] })).toEqual({ text: 'cut', finish: 'length' });
    expect(parseLlmProviderResponse('openai-chat', { choices: [{ message: { content: null }, finish_reason: 'content_filter' }] })).toEqual({ text: '', finish: 'refusal' });
    expect(parseLlmProviderResponse('openai-chat', { choices: [{ message: { content: null, refusal: 'no' }, finish_reason: 'stop' }] })).toEqual({ text: '', finish: 'refusal' });
    for (const bad of [{ choices: [{ message: { content: 'x' }, finish_reason: 'tool_calls' }] }, { choices: [] }, { error: { message: `bad key ${KEY}` } }, 'text', null]) {
      let caught: unknown;
      try { parseLlmProviderResponse('openai-chat', bad); } catch (error) { caught = error; }
      expect(caught).toBeInstanceOf(LlmServiceError);
      expect((caught as LlmServiceError).code).toBe('provider-error');
      expect((caught as LlmServiceError).message).not.toContain(KEY);
    }
  });

  it('maps to Anthropic Messages: system text, merged turns, base64 images, required max_tokens and browser header', () => {
    const http = buildLlmProviderRequest(endpoint({ protocol: 'anthropic-messages', baseUrl: 'https://api.anthropic.com/v1' }), REQUEST);
    expect(http.url).toBe('https://api.anthropic.com/v1/messages');
    expect(http.headers).toEqual({
      'content-type': 'application/json', 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true', 'x-api-key': KEY,
    });
    const body = JSON.parse(http.body);
    expect(body.max_tokens).toBe(4096);
    expect(body.system).toBe('Be brief.\nRespond with a single JSON object and no other text.');
    expect(body.messages).toEqual([
      { role: 'user', content: [{ type: 'text', text: 'Describe this.' }, { type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'iVBORw0KGgo=' } }] },
      { role: 'assistant', content: [{ type: 'text', text: 'A picture.' }] },
      { role: 'user', content: [{ type: 'text', text: 'More detail.' }] },
    ]);
    const merged = buildLlmProviderRequest(endpoint({ protocol: 'anthropic-messages' }), { handle: 'h', messages: [
      { role: 'user', content: [{ type: 'text', text: 'a' }] }, { role: 'user', content: [{ type: 'text', text: 'b' }] },
    ] });
    expect(JSON.parse(merged.body).messages).toEqual([{ role: 'user', content: [{ type: 'text', text: 'a' }, { type: 'text', text: 'b' }] }]);
    expect(JSON.parse(merged.body).system).toBeUndefined();
  });

  it('reports Anthropic and Gemini input restrictions as unsupported before any request is built', () => {
    const assistantFirst: LlmGenerationRequest = { handle: 'h', messages: [{ role: 'assistant', content: [{ type: 'text', text: 'x' }] }] };
    const systemImage: LlmGenerationRequest = { handle: 'h', messages: [{ role: 'system', content: [{ type: 'image', mimeType: 'image/png', data: 'iVBORw0KGgo=' }] }, { role: 'user', content: [{ type: 'text', text: 'x' }] }] };
    const systemOnly: LlmGenerationRequest = { handle: 'h', messages: [{ role: 'system', content: [{ type: 'text', text: 'x' }] }] };
    for (const [protocol, request] of [['anthropic-messages', assistantFirst], ['anthropic-messages', systemImage], ['gemini', systemImage], ['gemini', systemOnly]] as const) {
      expect(() => buildLlmProviderRequest(endpoint({ protocol }), request)).toThrow(expect.objectContaining({ code: 'unsupported' }));
    }
  });

  it('parses Anthropic stop reasons and usage', () => {
    expect(parseLlmProviderResponse('anthropic-messages', { content: [{ type: 'text', text: 'Hel' }, { type: 'text', text: 'lo' }], stop_reason: 'end_turn', usage: { input_tokens: 5, output_tokens: 1 } }))
      .toEqual({ text: 'Hello', finish: 'stop', usage: { inputTokens: 5, outputTokens: 1 } });
    expect(parseLlmProviderResponse('anthropic-messages', { content: [], stop_reason: 'max_tokens' })).toEqual({ text: '', finish: 'length' });
    expect(parseLlmProviderResponse('anthropic-messages', { content: [{ type: 'text', text: 'no' }], stop_reason: 'refusal' })).toEqual({ text: 'no', finish: 'refusal' });
    expect(() => parseLlmProviderResponse('anthropic-messages', { content: [{ type: 'text', text: 'x' }], stop_reason: 'tool_use' })).toThrow(expect.objectContaining({ code: 'provider-error' }));
    expect(() => parseLlmProviderResponse('anthropic-messages', { type: 'error' })).toThrow(expect.objectContaining({ code: 'provider-error' }));
  });

  it('maps to Gemini generateContent with the header credential, model roles, inline data and JSON mime', () => {
    const http = buildLlmProviderRequest(endpoint({ protocol: 'gemini', baseUrl: 'https://generativelanguage.googleapis.com/v1beta', model: 'gemini-2.5-flash', maxOutputTokens: 100 }), REQUEST);
    expect(http.url).toBe('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent');
    expect(http.url).not.toContain(KEY);
    expect(http.headers).toEqual({ 'content-type': 'application/json', 'x-goog-api-key': KEY });
    const body = JSON.parse(http.body);
    expect(body.systemInstruction).toEqual({ parts: [{ text: 'Be brief.' }] });
    expect(body.generationConfig).toEqual({ responseMimeType: 'application/json', maxOutputTokens: 100 });
    expect(body.contents).toEqual([
      { role: 'user', parts: [{ text: 'Describe this.' }, { inlineData: { mimeType: 'image/png', data: 'iVBORw0KGgo=' } }] },
      { role: 'model', parts: [{ text: 'A picture.' }] },
      { role: 'user', parts: [{ text: 'More detail.' }] },
    ]);
  });

  it('parses Gemini candidates, block reasons and usage', () => {
    expect(parseLlmProviderResponse('gemini', { candidates: [{ content: { parts: [{ text: 'Hi' }] }, finishReason: 'STOP' }], usageMetadata: { promptTokenCount: 2, candidatesTokenCount: 1 } }))
      .toEqual({ text: 'Hi', finish: 'stop', usage: { inputTokens: 2, outputTokens: 1 } });
    expect(parseLlmProviderResponse('gemini', { candidates: [{ content: { parts: [{ text: 'cut' }] }, finishReason: 'MAX_TOKENS' }] })).toEqual({ text: 'cut', finish: 'length' });
    expect(parseLlmProviderResponse('gemini', { candidates: [{ finishReason: 'SAFETY' }] })).toEqual({ text: '', finish: 'refusal' });
    expect(parseLlmProviderResponse('gemini', { promptFeedback: { blockReason: 'SAFETY' } })).toEqual({ text: '', finish: 'refusal' });
    expect(() => parseLlmProviderResponse('gemini', { candidates: [{ content: { parts: [{ text: 'x' }] }, finishReason: 'OTHER' }] })).toThrow(expect.objectContaining({ code: 'provider-error' }));
    expect(() => parseLlmProviderResponse('gemini', {})).toThrow(expect.objectContaining({ code: 'provider-error' }));
  });

  it('rejects unknown protocols', () => {
    expect(() => buildLlmProviderRequest(endpoint({ protocol: 'soap' as never }), REQUEST)).toThrow(expect.objectContaining({ code: 'unsupported' }));
    expect(() => parseLlmProviderResponse('soap' as never, {})).toThrow(expect.objectContaining({ code: 'provider-error' }));
  });
});

describe('createHttpLlmProvider', () => {
  const request: LlmGenerationRequest = { handle: 'h', messages: [{ role: 'user', content: [{ type: 'text', text: 'hi' }] }] };

  it('posts once to the configured base URL with the credential header and maps the response', async () => {
    const fetchImpl = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ choices: [{ message: { content: 'yo' }, finish_reason: 'stop' }] }) }));
    const generate = createHttpLlmProvider({ fetch: fetchImpl });
    const controller = new AbortController();
    await expect(generate(endpoint({}), request, controller.signal)).resolves.toEqual({ text: 'yo', finish: 'stop' });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, { headers: Record<string, string>; signal: AbortSignal; body: string }];
    expect(url).toBe('https://api.example.test/v1/chat/completions');
    expect(init.headers.authorization).toBe(`Bearer ${KEY}`);
    expect(init.signal).toBe(controller.signal);
    expect(init.body).not.toContain(KEY);
  });

  it('turns HTTP status, transport and JSON failures into provider-error without echoing bodies', async () => {
    const statusFail = createHttpLlmProvider({ fetch: async () => ({ ok: false, status: 401, json: async () => ({ error: KEY }) }) });
    await expect(statusFail(endpoint({}), request, new AbortController().signal)).rejects.toMatchObject({ code: 'provider-error', message: 'The provider responded with HTTP 401.' });
    const transportFail = createHttpLlmProvider({ fetch: async () => { throw new TypeError(`fetch failed ${KEY}`); } });
    await expect(transportFail(endpoint({}), request, new AbortController().signal)).rejects.toMatchObject({ code: 'provider-error', message: 'The provider could not be reached.' });
    const jsonFail = createHttpLlmProvider({ fetch: async () => ({ ok: true, status: 200, json: async () => { throw new SyntaxError('bad'); } }) });
    await expect(jsonFail(endpoint({}), request, new AbortController().signal)).rejects.toMatchObject({ code: 'provider-error', message: 'The provider response was not valid JSON.' });
  });

  it('propagates aborts so the service can settle cancellation', async () => {
    const controller = new AbortController();
    const abortError = new DOMException('Aborted', 'AbortError');
    const aborted = createHttpLlmProvider({ fetch: async () => { controller.abort(); throw abortError; } });
    await expect(aborted(endpoint({}), request, controller.signal)).rejects.toBe(abortError);
  });
});

describe('LLM_PROVIDER_PRESETS', () => {
  it('covers the common hosted and local providers with usable protocol metadata', () => {
    const ids = LLM_PROVIDER_PRESETS.map((preset) => preset.id);
    expect(ids).toEqual(expect.arrayContaining(['openai', 'anthropic', 'gemini', 'openrouter', 'groq', 'mistral', 'deepseek', 'xai', 'together', 'ollama', 'lmstudio', 'azure-openai', 'custom']));
    expect(new Set(ids).size).toBe(ids.length);
    for (const preset of LLM_PROVIDER_PRESETS) {
      expect(['openai-chat', 'anthropic-messages', 'gemini']).toContain(preset.protocol);
      expect(preset.docsUrl).toMatch(/^https:\/\//);
      expect(Object.isFrozen(preset)).toBe(true);
      if (preset.local) expect(preset.baseUrl).toMatch(/^http:\/\/127\.0\.0\.1:/);
    }
    expect(LLM_PROVIDER_PRESETS.find((preset) => preset.id === 'azure-openai')?.credentialHeader).toBe('api-key');
  });
});
