/**
 * NAP-LLM reference service conformance for tools, thinking and block deltas.
 * Authority: napplet/naps PR #134 at 5e93bdfce0e84c0de728234cb7b3feed498f8635,
 * cases LLM-C02, C03, C09, C10 and C12..C23 (service half) against a controllable
 * host fixture. Vectors g1..g4 are the spec's own examples. Dialect cases live in
 * llm-provider-tools.test.ts. The service validates and relays tool calls; no
 * test here, and no code under test, executes one.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { NappletMessage } from '@napplet/core';
import { createLlmService, type LlmConnection, type LlmConnectionHost, type LlmGenerateHooks, type LlmPromptOptions, type LlmService } from './llm-service.js';
import type { LlmBlockEvent, LlmGeneration, LlmGenerationRequest } from './llm-types.js';

type Sent = Record<string, unknown> & { type: string };

const ALL_MODES = ['auto', 'none', 'required', 'tool'] as const;
const TOOL_MODEL: LlmConnection = { id: 'c-tool', name: 'Tools', model: 'tool-1', route: 'Paja → Example provider', images: true, json: true, tools: true, toolChoiceModes: ALL_MODES };
const BASIC_MODEL: LlmConnection = { id: 'c-basic', name: 'Basic', model: 'basic-1', route: 'Paja → Example provider', images: false, json: true, tools: false, toolChoiceModes: [] };
const AUTO_ONLY: LlmConnection = { id: 'c-auto', name: 'Auto only', model: 'auto-1', route: 'Paja → Example provider', images: false, json: true, tools: true, toolChoiceModes: ['auto', 'none'] };
const NO_IMAGES: LlmConnection = { ...TOOL_MODEL, id: 'c-noimg', images: false };
const PNG = 'iVBORw0KGgo=';

const WEATHER = { name: 'get_weather', description: 'Look up current weather', parameters: { type: 'object', properties: { city: { type: 'string' } }, required: ['city'] } };
const CLOCK = { name: 'get_time', description: 'Look up the time' };
const ASK = [{ role: 'user', content: [{ type: 'text', text: 'What is the weather in Berlin?' }] }];
const CALL = { type: 'toolCall', toolCallId: 'call_1', name: 'get_weather', arguments: { city: 'Berlin' } };
const ANSWERED = [
  ...ASK,
  { role: 'assistant', content: [CALL] },
  { role: 'toolResult', toolCallId: 'call_1', toolName: 'get_weather', content: [{ type: 'text', text: '18°C and clear' }] },
];
const G2_RESULT: LlmGeneration = { content: [{ type: 'toolCall', toolCallId: 'call_1', name: 'get_weather', arguments: { city: 'Berlin' } }], finish: 'toolUse', usage: { inputTokens: 31, outputTokens: 12 } };
const G3_RESULT: LlmGeneration = { content: [{ type: 'text', text: 'It is 18°C and clear in Berlin.' }], finish: 'stop', usage: { inputTokens: 58, outputTokens: 15 } };

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => { resolve = res; });
  return { promise, resolve };
}

class Fixture implements LlmConnectionHost {
  connections = new Map<string, LlmConnection>([TOOL_MODEL, BASIC_MODEL, AUTO_ONLY, NO_IMAGES].map((entry) => [entry.id, entry]));
  selection: LlmConnection = TOOL_MODEL;
  consent: boolean | Promise<boolean> = true;
  consentRequests: LlmGenerationRequest[] = [];
  generations: LlmGenerationRequest[] = [];
  result: LlmGeneration | unknown | ((hooks: LlmGenerateHooks) => Promise<unknown>) = G2_RESULT;
  hooks: LlmGenerateHooks[] = [];
  select(_ctx: unknown, _req: unknown, _options?: LlmPromptOptions) { return this.selection; }
  describe(_ctx: unknown, id: string) { return this.connections.get(id) ?? null; }
  authorize(_ctx: unknown, _c: unknown, request: LlmGenerationRequest) { this.consentRequests.push(request); return this.consent; }
  async generate(_ctx: unknown, _c: LlmConnection, request: LlmGenerationRequest, hooks: LlmGenerateHooks): Promise<LlmGeneration> {
    this.generations.push(request); this.hooks.push(hooks);
    const result = typeof this.result === 'function' ? await (this.result as (h: LlmGenerateHooks) => Promise<unknown>)(hooks) : this.result;
    if (result instanceof Error) throw result;
    return result as LlmGeneration;
  }
}

function harness() {
  const host = new Fixture();
  const service: LlmService = createLlmService({ host, createHandle: (() => { let n = 0; return () => `h${++n}`; })() });
  service.onRegistered?.({} as never);
  const sent: Sent[] = [];
  const send = (message: NappletMessage) => { sent.push(message as Sent); };
  const post = (message: Record<string, unknown> & { type: string }) => service.handleMessage('w1', message, send);
  const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
  const select = async (connection: LlmConnection = TOOL_MODEL, requirements?: unknown) => {
    host.selection = connection;
    post({ type: 'llm.select', id: `s-${sent.length}`, ...(requirements === undefined ? {} : { requirements }) });
    await flush();
    return (sent.at(-1)?.model as { handle: string } | undefined)?.handle ?? '';
  };
  let counter = 0;
  const generate = async (handle: string, request: Record<string, unknown>) => {
    const id = `g-${++counter}`;
    post({ type: 'llm.generate', id, request: { handle, ...request } });
    await flush();
    return sent.filter((message) => message.id === id || message.requestId === id);
  };
  const terminal = (messages: Sent[]) => messages.find((message) => message.type === 'llm.generate.result');
  const deltas = (messages: Sent[]) => messages.filter((message) => message.type === 'llm.delta');
  return { host, service, post, sent, flush, select, generate, terminal, deltas };
}

const withTools = (extra: Record<string, unknown> = {}) => ({ messages: ASK, tools: [WEATHER], ...extra });

describe('NAP-LLM service: tools, thinking and block deltas', () => {
  beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }));
  afterEach(() => vi.useRealTimers());

  it('LLM-C02: every new record field, explicit null and invalid type is invalid-request with zero generations', async () => {
    const h = harness();
    const handle = await h.select();
    const bad: Array<[string, Record<string, unknown>]> = [
      ['maxTokens 1.5', { messages: ASK, maxTokens: 1.5 }],
      ['maxTokens text', { messages: ASK, maxTokens: '5' }],
      ['maxTokens null', { messages: ASK, maxTokens: null }],
      ['temperature NaN', { messages: ASK, temperature: Number.NaN }],
      ['temperature Infinity', { messages: ASK, temperature: Number.POSITIVE_INFINITY }],
      ['temperature text', { messages: ASK, temperature: 'hot' }],
      ['temperature null', { messages: ASK, temperature: null }],
      ['tools null', { messages: ASK, tools: null }],
      ['tools not a list', { messages: ASK, tools: WEATHER }],
      ['tool with extra field', withTools({ tools: [{ ...WEATHER, extra: true }] })],
      ['tool description null', withTools({ tools: [{ ...WEATHER, description: null }] })],
      ['tool parameters null', withTools({ tools: [{ name: 'a', parameters: null }] })],
      ['toolChoice text', withTools({ toolChoice: 'sometimes' })],
      ['toolChoice null', withTools({ toolChoice: null })],
      ['named toolChoice without name', withTools({ toolChoice: { type: 'tool' } })],
      ['named toolChoice with extra', withTools({ toolChoice: { type: 'tool', name: 'get_weather', extra: 1 } })],
      ['toolCallId on a user message', { messages: [{ role: 'user', content: [{ type: 'text', text: 'x' }], toolCallId: 'c' }] }],
      ['toolName on an assistant message', { messages: [{ role: 'assistant', content: [{ type: 'text', text: 'x' }], toolName: 'n' }] }],
      ['isError on a user message', { messages: [{ role: 'user', content: [{ type: 'text', text: 'x' }], isError: true }] }],
      ['thinking in a user message', { messages: [{ role: 'user', content: [{ type: 'thinking', text: 'hm' }] }] }],
      ['toolCall in a user message', { messages: [{ role: 'user', content: [CALL] }] }],
      ['toolCall in a system message', { messages: [{ role: 'system', content: [CALL] }] }],
      ['toolResult without toolCallId', { messages: [{ role: 'toolResult', toolName: 'n', content: [{ type: 'text', text: 'x' }] }] }],
      ['toolResult without toolName', { messages: [{ role: 'toolResult', toolCallId: 'c', content: [{ type: 'text', text: 'x' }] }] }],
      ['toolResult carrying thinking', { messages: [...ANSWERED.slice(0, 2), { role: 'toolResult', toolCallId: 'call_1', toolName: 'get_weather', content: [{ type: 'thinking', text: 'x' }] }] }],
      ['toolResult carrying a toolCall', { messages: [...ANSWERED.slice(0, 2), { role: 'toolResult', toolCallId: 'call_1', toolName: 'get_weather', content: [CALL] }] }],
      ['isError not boolean', { messages: [...ANSWERED.slice(0, 2), { ...ANSWERED[2], isError: 'yes' }] }],
      ['toolCall arguments null', { messages: [{ role: 'assistant', content: [{ ...CALL, arguments: null }] }] }],
      ['toolCall arguments array', { messages: [{ role: 'assistant', content: [{ ...CALL, arguments: [] }] }] }],
      ['toolCall without name', { messages: [{ role: 'assistant', content: [{ type: 'toolCall', toolCallId: 'c', arguments: {} }] }] }],
    ];
    for (const [label, request] of bad) {
      const messages = await h.generate(handle, request);
      expect(h.terminal(messages), label).toMatchObject({ error: { code: 'invalid-request' } });
    }
    expect(h.host.generations).toHaveLength(0);
    expect(h.host.consentRequests).toHaveLength(0);
  });

  it('LLM-C02: cyclic, heavily shared and non-plain parameters or arguments answer invalid-request promptly', async () => {
    const h = harness();
    const handle = await h.select();
    const cycle: Record<string, unknown> = { type: 'object' };
    cycle.properties = { self: cycle };
    let shared: unknown = { type: 'string' };
    for (let level = 0; level < 40; level += 1) shared = { a: shared, b: shared };
    const argumentsCycle: Record<string, unknown> = {};
    argumentsCycle.self = argumentsCycle;
    const cases: Array<[string, Record<string, unknown>]> = [
      ['cyclic parameters', withTools({ tools: [{ name: 'a', parameters: cycle }] })],
      ['heavily shared parameters', withTools({ tools: [{ name: 'a', parameters: { type: 'object', properties: shared } }] })],
      ['cyclic arguments', { messages: [{ role: 'assistant', content: [{ ...CALL, arguments: argumentsCycle }] }] }],
      ['class instance in arguments', { messages: [{ role: 'assistant', content: [{ ...CALL, arguments: { when: new Date() } }] }] }],
      ['function in arguments', { messages: [{ role: 'assistant', content: [{ ...CALL, arguments: { run: () => 1 } }] }] }],
      ['non-finite number in parameters', withTools({ tools: [{ name: 'a', parameters: { type: 'object', maximum: Number.NaN } }] })],
    ];
    const started = Date.now();
    for (const [label, request] of cases) {
      expect(h.terminal(await h.generate(handle, request)), label).toMatchObject({ error: { code: 'invalid-request' } });
    }
    expect(Date.now() - started).toBeLessThan(2000);
    expect(h.host.generations).toHaveLength(0);
  });

  it('LLM-C20: duplicate or invalid names, a choice without tools, an unknown forced name, a non-object schema and zero maxTokens are invalid-request', async () => {
    const h = harness();
    const handle = await h.select();
    const cases: Array<[string, Record<string, unknown>]> = [
      ['duplicate names', withTools({ tools: [WEATHER, { ...CLOCK, name: 'get_weather' }] })],
      ['name with a space', withTools({ tools: [{ name: 'get weather' }] })],
      ['empty name', withTools({ tools: [{ name: '' }] })],
      ['name over 64 characters', withTools({ tools: [{ name: 'n'.repeat(65) }] })],
      ['explicit choice without tools', { messages: ASK, toolChoice: 'auto' }],
      ['explicit choice with an empty tools list', { messages: ASK, tools: [], toolChoice: 'required' }],
      ['named choice without tools', { messages: ASK, toolChoice: { type: 'tool', name: 'get_weather' } }],
      ['forced name not listed', withTools({ toolChoice: { type: 'tool', name: 'missing' } })],
      ['schema root not an object', withTools({ tools: [{ name: 'a', parameters: { type: 'string' } }] })],
      ['schema root without a type', withTools({ tools: [{ name: 'a', parameters: { properties: {} } }] })],
      ['schema root type list', withTools({ tools: [{ name: 'a', parameters: { type: ['object', 'null'] } }] })],
      ['unknown schema type', withTools({ tools: [{ name: 'a', parameters: { type: 'object', properties: { x: { type: 'text' } } } }] })],
      ['properties not a map of schemas', withTools({ tools: [{ name: 'a', parameters: { type: 'object', properties: { x: 3 } } }] })],
      ['required not a string list', withTools({ tools: [{ name: 'a', parameters: { type: 'object', required: 'x' } }] })],
      ['2019-style items list', withTools({ tools: [{ name: 'a', parameters: { type: 'object', properties: { x: { type: 'array', items: [{ type: 'string' }] } } } }] })],
      ['enum not a list', withTools({ tools: [{ name: 'a', parameters: { type: 'object', properties: { x: { enum: 'a' } } } }] })],
      ['empty anyOf', withTools({ tools: [{ name: 'a', parameters: { type: 'object', anyOf: [] } }] })],
      ['zero maxTokens', { messages: ASK, maxTokens: 0 }],
      ['negative maxTokens', { messages: ASK, maxTokens: -4 }],
    ];
    for (const [label, request] of cases) {
      expect(h.terminal(await h.generate(handle, request)), label).toMatchObject({ error: { code: 'invalid-request' } });
    }
    expect(h.host.generations).toHaveLength(0);
  });

  it('LLM-C20: JSON Schema keywords pass, unknown keywords included, and an empty tools list is omission', async () => {
    const h = harness();
    const handle = await h.select();
    h.host.result = { content: [{ type: 'text', text: 'ok' }], finish: 'stop' };
    const rich = { type: 'object', $defs: { id: { type: 'integer', minimum: 1 } }, properties: { id: { $ref: '#/$defs/id' }, tags: { type: 'array', items: { type: 'string' }, uniqueItems: true }, mode: { enum: ['a', 'b'] }, either: { anyOf: [{ type: 'string' }, true] } }, required: ['id'], additionalProperties: false, 'x-vendor': { anything: 1 } };
    expect(h.terminal(await h.generate(handle, withTools({ tools: [{ name: 'rich', parameters: rich }] })))).toMatchObject({ result: { finish: 'stop' } });
    expect(h.terminal(await h.generate(handle, { messages: ASK, tools: [] }))).toMatchObject({ result: { finish: 'stop' } });
    expect(h.host.generations).toHaveLength(2);
  });

  it('LLM-C03: tools on a connection without tool support, an unmet tools requirement and historical calls are unsupported with zero consent and generations', async () => {
    const h = harness();
    const basic = await h.select(BASIC_MODEL);
    for (const request of [withTools(), { messages: ANSWERED }]) {
      expect(h.terminal(await h.generate(basic, request))).toMatchObject({ error: { code: 'unsupported' } });
    }
    expect(h.host.consentRequests).toHaveLength(0);
    expect(h.host.generations).toHaveLength(0);

    h.host.selection = BASIC_MODEL;
    h.post({ type: 'llm.select', id: 'need-tools', requirements: { tools: true } });
    await h.flush();
    expect(h.sent.at(-1)).toMatchObject({ id: 'need-tools', error: { code: 'unsupported' } });
    h.post({ type: 'llm.select', id: 'bad-requirement', requirements: { tools: 'yes' } });
    await h.flush();
    expect(h.sent.at(-1)).toMatchObject({ id: 'bad-requirement', error: { code: 'invalid-request' } });
    h.host.selection = TOOL_MODEL;
    h.post({ type: 'llm.select', id: 'tools-ok', requirements: { tools: true } });
    await h.flush();
    expect(h.sent.at(-1)).toMatchObject({ id: 'tools-ok', model: { tools: true, toolChoiceModes: [...ALL_MODES] } });
  });

  it('LLM-C03: images in tool results follow the connection image capability, ahead of consent', async () => {
    const h = harness();
    const noImages = await h.select(NO_IMAGES);
    const withImage = [
      ...ANSWERED.slice(0, 2),
      { role: 'toolResult', toolCallId: 'call_1', toolName: 'get_weather', content: [{ type: 'image', mimeType: 'image/png', data: PNG }] },
    ];
    expect(h.terminal(await h.generate(noImages, { messages: withImage }))).toMatchObject({ error: { code: 'unsupported' } });
    expect(h.host.consentRequests).toHaveLength(0);
    const imaging = await h.select(TOOL_MODEL);
    h.host.result = G3_RESULT;
    expect(h.terminal(await h.generate(imaging, { messages: withImage }))).toMatchObject({ result: { finish: 'stop' } });
  });

  it('LLM-C19: an unlisted tool-choice mode is unsupported with no consent, no substitution and no generation', async () => {
    const h = harness();
    const handle = await h.select(AUTO_ONLY);
    for (const toolChoice of ['required', { type: 'tool', name: 'get_weather' }]) {
      expect(h.terminal(await h.generate(handle, withTools({ toolChoice })))).toMatchObject({ error: { code: 'unsupported' } });
    }
    expect(h.host.consentRequests).toHaveLength(0);
    expect(h.host.generations).toHaveLength(0);
    h.host.result = G2_RESULT;
    expect(h.terminal(await h.generate(handle, withTools({ toolChoice: 'auto' })))).toMatchObject({ result: { finish: 'toolUse' } });
    expect(h.terminal(await h.generate(handle, withTools()))).toMatchObject({ result: { finish: 'toolUse' } });
    h.host.result = { content: [{ type: 'text', text: 'plain' }], finish: 'stop' };
    expect(h.terminal(await h.generate(handle, withTools({ toolChoice: 'none' })))).toMatchObject({ result: { finish: 'stop' } });
  });

  it('spec g2 and g3: a tool call, its answer and the continuation round-trip through the service', async () => {
    const h = harness();
    const handle = await h.select();
    h.host.result = G2_RESULT;
    expect(h.terminal(await h.generate(handle, withTools({ toolChoice: 'auto' })))).toMatchObject({ result: G2_RESULT });
    h.host.result = G3_RESULT;
    expect(h.terminal(await h.generate(handle, { messages: ANSWERED, tools: [WEATHER], toolChoice: 'auto' }))).toMatchObject({ result: G3_RESULT });
    expect(h.host.generations).toHaveLength(2);
    expect(h.host.generations[1]!.messages).toEqual(ANSWERED);
  });

  it('LLM-C12: an assistant turn with several calls and a missing result is invalid-request with no generation', async () => {
    const h = harness();
    const handle = await h.select();
    const second = { type: 'toolCall', toolCallId: 'call_2', name: 'get_time', arguments: {} };
    const messages = [
      ...ASK,
      { role: 'assistant', content: [CALL, second] },
      { role: 'toolResult', toolCallId: 'call_1', toolName: 'get_weather', content: [{ type: 'text', text: '18°C' }] },
    ];
    expect(h.terminal(await h.generate(handle, { messages, tools: [WEATHER, CLOCK] }))).toMatchObject({ error: { code: 'invalid-request' } });
    expect(h.host.generations).toHaveLength(0);
    // Both answered, in either order, is valid.
    const answered = [
      ...messages,
      { role: 'toolResult', toolCallId: 'call_2', toolName: 'get_time', content: [{ type: 'text', text: '10:00' }] },
    ];
    h.host.result = G3_RESULT;
    expect(h.terminal(await h.generate(handle, { messages: answered, tools: [WEATHER, CLOCK] }))).toMatchObject({ result: { finish: 'stop' } });
    const reversed = [...answered.slice(0, 2), answered[3], answered[2]];
    expect(h.terminal(await h.generate(handle, { messages: reversed, tools: [WEATHER, CLOCK] }))).toMatchObject({ result: { finish: 'stop' } });
  });

  it('LLM-C21: misplaced, duplicate, orphaned and name-mismatched results and unanswered tails are invalid-request', async () => {
    const h = harness();
    const handle = await h.select();
    const result = ANSWERED[2]!;
    const assistant = ANSWERED[1]!;
    const separated = [...ASK, assistant, { role: 'user', content: [{ type: 'text', text: 'hm' }] }, result];
    const cases: Array<[string, unknown[]]> = [
      ['result first', [result, ...ASK]],
      ['result without a call', [...ASK, result]],
      ['orphaned id', [...ASK, assistant, { ...result, toolCallId: 'call_9' }]],
      ['name mismatch', [...ASK, assistant, { ...result, toolName: 'get_time' }]],
      ['duplicate result', [...ASK, assistant, result, result]],
      ['result separated from its turn', separated],
      ['unanswered tail', [...ASK, assistant]],
      ['duplicate call id across turns', [...ANSWERED, { role: 'assistant', content: [CALL] }, result]],
      ['duplicate call id within a turn', [...ASK, { role: 'assistant', content: [CALL, CALL] }, result, result]],
    ];
    for (const [label, messages] of cases) {
      expect(h.terminal(await h.generate(handle, { messages, tools: [WEATHER] })), label).toMatchObject({ error: { code: 'invalid-request' } });
    }
    expect(h.host.generations).toHaveLength(0);
  });

  it('LLM-C21: completed history is accepted without current tools, and a new call in that response is provider-error', async () => {
    const h = harness();
    const handle = await h.select();
    h.host.result = G3_RESULT;
    expect(h.terminal(await h.generate(handle, { messages: ANSWERED }))).toMatchObject({ result: { finish: 'stop' } });
    h.host.result = G2_RESULT;
    const forged = h.terminal(await h.generate(handle, { messages: ANSWERED }));
    expect(forged).toMatchObject({ error: { code: 'provider-error' } });
    expect(h.host.generations).toHaveLength(2);
  });

  it('LLM-C23: declined consent with tool definitions and results answers user-cancelled; authorize saw both and nothing was submitted', async () => {
    const h = harness();
    const handle = await h.select();
    h.host.consent = false;
    const request = { messages: ANSWERED, tools: [WEATHER], toolChoice: 'auto' };
    expect(h.terminal(await h.generate(handle, request))).toMatchObject({ error: { code: 'user-cancelled' } });
    expect(h.host.generations).toHaveLength(0);
    expect(h.host.consentRequests).toHaveLength(1);
    expect(h.host.consentRequests[0]!.tools).toEqual([WEATHER]);
    expect(h.host.consentRequests[0]!.messages.at(-1)).toMatchObject({ role: 'toolResult', content: [{ text: '18°C and clear' }] });
  });

  it('LLM-C15: completed calls normalise to toolUse; toolUse without a call fails; truncated and refused turns keep their finish and lose their calls', async () => {
    const h = harness();
    const handle = await h.select();
    const run = async (result: unknown) => { h.host.result = result; return h.terminal(await h.generate(handle, withTools())); };
    expect(await run({ ...G2_RESULT, finish: 'stop' })).toMatchObject({ result: { finish: 'toolUse', content: G2_RESULT.content } });
    expect(await run({ content: [{ type: 'text', text: 'no call' }], finish: 'toolUse' })).toMatchObject({ error: { code: 'provider-error' } });
    const partial = [{ type: 'text', text: 'working' }, CALL, { type: 'toolCall', toolCallId: 'call_2', name: 'get_weather', arguments: {} }];
    expect(await run({ content: partial, finish: 'length' })).toMatchObject({ result: { finish: 'length', content: [{ type: 'text', text: 'working' }] } });
    expect(await run({ content: partial, finish: 'refusal' })).toMatchObject({ result: { finish: 'refusal', content: [{ type: 'text', text: 'working' }] } });
    // Incomplete arguments on a truncated turn are discarded, not rejected.
    expect(await run({ content: [{ type: 'toolCall', toolCallId: 'c', name: 'get_weather', arguments: 'half' }], finish: 'length' })).toMatchObject({ result: { finish: 'length', content: [] } });
    const stripped = await run({ content: partial, finish: 'length' });
    expect(JSON.stringify(stripped)).not.toContain('toolCall');
  });

  it('LLM-C16: malformed or non-object arguments and unknown tool names are provider-error and never echo provider data', async () => {
    const h = harness();
    const handle = await h.select();
    const secret = 'sk-planted-secret';
    const cases: Array<[string, unknown]> = [
      ['string arguments', [{ type: 'toolCall', toolCallId: 'c', name: 'get_weather', arguments: secret }]],
      ['array arguments', [{ type: 'toolCall', toolCallId: 'c', name: 'get_weather', arguments: [secret] }]],
      ['null arguments', [{ type: 'toolCall', toolCallId: 'c', name: 'get_weather', arguments: null }]],
      ['unknown tool name', [{ type: 'toolCall', toolCallId: 'c', name: `${secret}_tool`, arguments: {} }]],
      ['missing id', [{ type: 'toolCall', name: 'get_weather', arguments: { city: secret } }]],
    ];
    for (const [label, content] of cases) {
      h.host.result = { content, finish: 'toolUse' };
      const reply = h.terminal(await h.generate(handle, withTools()));
      expect(reply, label).toMatchObject({ error: { code: 'provider-error' } });
      expect(JSON.stringify(reply), label).not.toContain(secret);
    }
  });

  it('LLM-C16: a call to any tool is provider-error when no tools were sent', async () => {
    const h = harness();
    const handle = await h.select();
    h.host.result = G2_RESULT;
    expect(h.terminal(await h.generate(handle, { messages: ASK }))).toMatchObject({ error: { code: 'provider-error' } });
  });

  it('LLM-C16: duplicate call ids in a result, or reusing a history id, are provider-error', async () => {
    const h = harness();
    const handle = await h.select();
    const twin = { type: 'toolCall', toolCallId: 'call_1', name: 'get_weather', arguments: {} };
    h.host.result = { content: [CALL, twin], finish: 'toolUse' };
    expect(h.terminal(await h.generate(handle, withTools()))).toMatchObject({ error: { code: 'provider-error' } });
    h.host.result = G2_RESULT;
    expect(h.terminal(await h.generate(handle, { messages: ANSWERED, tools: [WEATHER] }))).toMatchObject({ error: { code: 'provider-error' } });
  });

  it('LLM-C13: a forced tool the provider ignores is provider-error, never a fallback; honouring it succeeds (spec g4)', async () => {
    const h = harness();
    const handle = await h.select();
    const g4 = { messages: [{ role: 'user', content: [{ type: 'text', text: 'Check the weather.' }] }], tools: [WEATHER, CLOCK], toolChoice: { type: 'tool', name: 'get_weather' } };
    const run = async (result: unknown) => { h.host.result = result; return h.terminal(await h.generate(handle, g4)); };
    expect(await run({ content: [{ type: 'text', text: 'It is sunny.' }], finish: 'stop' })).toMatchObject({ error: { code: 'provider-error' } });
    expect(await run({ content: [{ type: 'toolCall', toolCallId: 'c', name: 'get_time', arguments: {} }], finish: 'toolUse' })).toMatchObject({ error: { code: 'provider-error' } });
    expect(await run({ content: [CALL, { type: 'toolCall', toolCallId: 'c2', name: 'get_time', arguments: {} }], finish: 'toolUse' })).toMatchObject({ error: { code: 'provider-error' } });
    expect(await run(G2_RESULT)).toMatchObject({ result: { finish: 'toolUse' } });
    // required needs a call; none forbids one; length stays partial whatever the mode.
    h.host.result = { content: [{ type: 'text', text: 'plain' }], finish: 'stop' };
    expect(h.terminal(await h.generate(handle, withTools({ toolChoice: 'required' })))).toMatchObject({ error: { code: 'provider-error' } });
    h.host.result = G2_RESULT;
    expect(h.terminal(await h.generate(handle, withTools({ toolChoice: 'none' })))).toMatchObject({ error: { code: 'provider-error' } });
    h.host.result = { content: [{ type: 'text', text: 'cut' }], finish: 'length' };
    expect(h.terminal(await h.generate(handle, withTools({ toolChoice: 'required' })))).toMatchObject({ result: { finish: 'length' } });
  });

  it('LLM-C14: a synthesized id is identical in deltas and the terminal result, and its toolResult round-trips', async () => {
    const h = harness();
    const handle = await h.select();
    const id = 'synth-3f2a';
    const call = { type: 'toolCall', toolCallId: id, name: 'get_weather', arguments: { city: 'Berlin' } };
    h.host.result = async (hooks: LlmGenerateHooks) => {
      hooks.onDelta({ event: 'start', block: 'toolCall', blockIndex: 0, toolCallId: id, name: 'get_weather' });
      hooks.onDelta({ event: 'delta', block: 'toolCall', blockIndex: 0, text: '{"city":"Berlin"}' });
      hooks.onDelta({ event: 'end', block: 'toolCall', blockIndex: 0 });
      return { content: [call], finish: 'toolUse' };
    };
    const first = await h.generate(handle, withTools());
    expect(h.deltas(first)[0]).toMatchObject({ toolCallId: id });
    expect(h.terminal(first)).toMatchObject({ result: { content: [{ toolCallId: id }] } });
    h.host.result = G3_RESULT;
    const history = [...ASK, { role: 'assistant', content: [call] }, { role: 'toolResult', toolCallId: id, toolName: 'get_weather', content: [{ type: 'text', text: 'sunny' }] }];
    expect(h.terminal(await h.generate(handle, { messages: history, tools: [WEATHER] }))).toMatchObject({ result: { finish: 'stop' } });
  });

  it('LLM-C18: interleaved tool and text blocks relay as an ordered lifecycle and the provider is contacted exactly once', async () => {
    const h = harness();
    const handle = await h.select();
    const events: LlmBlockEvent[] = [
      { event: 'start', block: 'thinking', blockIndex: 0 },
      { event: 'delta', block: 'thinking', blockIndex: 0, text: 'Let me check.' },
      { event: 'end', block: 'thinking', blockIndex: 0 },
      { event: 'start', block: 'toolCall', blockIndex: 1, toolCallId: 'call_1', name: 'get_weather' },
      { event: 'start', block: 'toolCall', blockIndex: 2, toolCallId: 'call_2', name: 'get_time' },
      { event: 'delta', block: 'toolCall', blockIndex: 1, text: '{"city":' },
      { event: 'delta', block: 'toolCall', blockIndex: 2, text: '{}' },
      { event: 'delta', block: 'toolCall', blockIndex: 1, text: '"Berlin"}' },
      { event: 'end', block: 'toolCall', blockIndex: 2 },
      { event: 'end', block: 'toolCall', blockIndex: 1 },
    ];
    const content = [
      { type: 'thinking', text: 'Let me check.' },
      { type: 'toolCall', toolCallId: 'call_1', name: 'get_weather', arguments: { city: 'Berlin' } },
      { type: 'toolCall', toolCallId: 'call_2', name: 'get_time', arguments: {} },
    ];
    h.host.result = async (hooks: LlmGenerateHooks) => { for (const event of events) hooks.onDelta(event); return { content, finish: 'toolUse' }; };
    const messages = await h.generate(handle, { messages: ASK, tools: [WEATHER, CLOCK] });
    expect(h.deltas(messages).map((delta) => delta.sequence)).toEqual(events.map((_, index) => index));
    expect(h.deltas(messages).map(({ event, block, blockIndex, text, toolCallId, name }) => ({ event, block, blockIndex, ...(text === undefined ? {} : { text }), ...(toolCallId === undefined ? {} : { toolCallId, name }) }))).toEqual(events);
    expect(h.terminal(messages)).toMatchObject({ result: { finish: 'toolUse', content } });
    expect(h.host.generations).toHaveLength(1);
  });

  it('LLM-C09: sequence is contiguous across blocks, there is one terminal, and deltas stop after it', async () => {
    const h = harness();
    const handle = await h.select();
    h.host.result = async (hooks: LlmGenerateHooks) => {
      hooks.onDelta({ event: 'start', block: 'text', blockIndex: 0 });
      hooks.onDelta({ event: 'delta', block: 'text', blockIndex: 0, text: 'a' });
      hooks.onDelta({ event: 'end', block: 'text', blockIndex: 0 });
      hooks.onDelta({ event: 'start', block: 'text', blockIndex: 1 });
      hooks.onDelta({ event: 'delta', block: 'text', blockIndex: 1, text: 'b' });
      hooks.onDelta({ event: 'end', block: 'text', blockIndex: 1 });
      return { content: [{ type: 'text', text: 'a' }, { type: 'text', text: 'b' }], finish: 'stop' };
    };
    const messages = await h.generate(handle, { messages: ASK });
    expect(h.deltas(messages).map((delta) => delta.sequence)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(messages.filter((message) => message.type === 'llm.generate.result')).toHaveLength(1);
    h.host.hooks.at(-1)!.onDelta({ event: 'delta', block: 'text', blockIndex: 1, text: 'late' });
    expect(h.deltas(h.sent as Sent[]).length).toBe(6);
  });

  it('LLM-C09: a lifecycle violation fails the generation with provider-error and sends no further deltas', async () => {
    const h = harness();
    const handle = await h.select();
    const start: LlmBlockEvent = { event: 'start', block: 'text', blockIndex: 0 };
    const part: LlmBlockEvent = { event: 'delta', block: 'text', blockIndex: 0, text: 'x' };
    const end: LlmBlockEvent = { event: 'end', block: 'text', blockIndex: 0 };
    const cases: Array<[string, LlmBlockEvent[]]> = [
      ['second start', [start, start]],
      ['delta before start', [part]],
      ['end before start', [end]],
      ['kind change', [start, { ...part, block: 'thinking' }]],
      ['delta after end', [start, end, part]],
      ['end after end', [start, end, end]],
      ['text on start', [{ ...start, text: 'x' }]],
      ['text on end', [start, { ...end, text: 'x' }]],
      ['delta without text', [start, { event: 'delta', block: 'text', blockIndex: 0 }]],
      ['id on a text start', [{ ...start, toolCallId: 'c' }]],
      ['toolCall start without an id', [{ event: 'start', block: 'toolCall', blockIndex: 0, name: 'get_weather' }]],
      ['toolCall start without a name', [{ event: 'start', block: 'toolCall', blockIndex: 0, toolCallId: 'c' }]],
      ['negative index', [{ ...start, blockIndex: -1 }]],
      ['fractional index', [{ ...start, blockIndex: 0.5 }]],
    ];
    for (const [label, events] of cases) {
      h.host.result = async (hooks: LlmGenerateHooks) => {
        for (const event of events) hooks.onDelta(event);
        hooks.onDelta({ ...part, text: 'after the failure' });
        return { content: [{ type: 'text', text: 'x' }], finish: 'stop' };
      };
      const before = h.sent.length;
      const messages = await h.generate(handle, { messages: ASK });
      expect(h.terminal(messages), label).toMatchObject({ error: { code: 'provider-error' } });
      expect(h.sent.length - before, label).toBe(messages.length);
      expect(JSON.stringify(h.deltas(messages)), label).not.toContain('after the failure');
    }
  });

  it('LLM-C09: a block still open at a stop or toolUse terminal fails, and streamed blocks must match the result', async () => {
    const h = harness();
    const handle = await h.select();
    const stream = (events: LlmBlockEvent[], result: unknown) => {
      h.host.result = async (hooks: LlmGenerateHooks) => { for (const event of events) hooks.onDelta(event); return result; };
      return h.generate(handle, withTools());
    };
    const textBlock = (text: string): LlmBlockEvent[] => [
      { event: 'start', block: 'text', blockIndex: 0 }, { event: 'delta', block: 'text', blockIndex: 0, text }, { event: 'end', block: 'text', blockIndex: 0 },
    ];
    const callBlock = (id: string, name: string, args: string): LlmBlockEvent[] => [
      { event: 'start', block: 'toolCall', blockIndex: 0, toolCallId: id, name }, { event: 'delta', block: 'toolCall', blockIndex: 0, text: args }, { event: 'end', block: 'toolCall', blockIndex: 0 },
    ];
    const text = (value: string) => ({ content: [{ type: 'text', text: value }], finish: 'stop' });
    const call = (id: string, name: string, args: unknown) => ({ content: [{ type: 'toolCall', toolCallId: id, name, arguments: args }], finish: 'toolUse' });
    const failing: Array<[string, LlmBlockEvent[], unknown]> = [
      ['open at stop', textBlock('hi').slice(0, 2), text('hi')],
      ['different text', textBlock('hi'), text('ho')],
      ['different kind', textBlock('hi'), { content: [{ type: 'thinking', text: 'hi' }], finish: 'stop' }],
      ['index beyond the result', [{ event: 'start', block: 'text', blockIndex: 1 }, { event: 'delta', block: 'text', blockIndex: 1, text: 'hi' }, { event: 'end', block: 'text', blockIndex: 1 }], text('hi')],
      ['different id', callBlock('call_1', 'get_weather', '{}'), call('call_9', 'get_weather', {})],
      ['different name', callBlock('call_1', 'get_weather', '{}'), call('call_1', 'get_weather_x', {})],
      ['different arguments', callBlock('call_1', 'get_weather', '{"city":"Berlin"}'), call('call_1', 'get_weather', { city: 'Paris' })],
      ['fragments that do not parse', callBlock('call_1', 'get_weather', '{"city":'), call('call_1', 'get_weather', {})],
    ];
    for (const [label, events, result] of failing) {
      expect(h.terminal(await stream(events, result)), label).toMatchObject({ error: { code: 'provider-error' } });
    }
    // Key order of arguments is not significant.
    expect(h.terminal(await stream(callBlock('call_1', 'get_weather', '{"b":1,"a":{"y":2,"x":1}}'), { content: [{ type: 'toolCall', toolCallId: 'call_1', name: 'get_weather', arguments: { a: { x: 1, y: 2 }, b: 1 } }], finish: 'toolUse' }))).toMatchObject({ result: { finish: 'toolUse' } });
    // Length and refusal skip the match: the provisional blocks are simply discarded.
    expect(h.terminal(await stream(textBlock('hi').slice(0, 2), { content: [{ type: 'text', text: 'hi there' }], finish: 'length' }))).toMatchObject({ result: { finish: 'length' } });
    expect(h.terminal(await stream(callBlock('call_1', 'get_weather', '{"c'), { content: [], finish: 'refusal' }))).toMatchObject({ result: { finish: 'refusal' } });
  });

  it('LLM-C10: format json checks the concatenated text parts of a stop result, and partial results stay partial', async () => {
    const h = harness();
    const handle = await h.select();
    const run = async (content: unknown, finish: string) => { h.host.result = { content, finish }; return h.terminal(await h.generate(handle, { messages: ASK, format: 'json' })); };
    expect(await run([{ type: 'thinking', text: 'not json' }, { type: 'text', text: '{"a":' }, { type: 'text', text: '1}' }], 'stop')).toMatchObject({ result: { finish: 'stop' } });
    expect(await run([{ type: 'text', text: '[1]' }], 'stop')).toMatchObject({ error: { code: 'provider-error' } });
    expect(await run([{ type: 'text', text: '{"a":' }], 'length')).toMatchObject({ result: { finish: 'length' } });
    expect(await run([], 'refusal')).toMatchObject({ result: { finish: 'refusal' } });
    // A tool turn is not a JSON completion.
    h.host.result = G2_RESULT;
    expect(h.terminal(await h.generate(handle, { ...withTools(), format: 'json' }))).toMatchObject({ result: { finish: 'toolUse' } });
  });

  it('keeps thinking and usage extras in the terminal result', async () => {
    const h = harness();
    const handle = await h.select();
    const result = { content: [{ type: 'thinking', text: 'hm' }, { type: 'text', text: 'answer' }], finish: 'stop', usage: { inputTokens: 3, outputTokens: 4, cacheReadTokens: 1, cacheWriteTokens: 2, reasoningTokens: 3 } };
    h.host.result = result;
    expect(h.terminal(await h.generate(handle, { messages: ASK }))).toMatchObject({ result });
    h.host.result = { ...result, usage: { inputTokens: 3, outputTokens: 4, cacheReadTokens: -1 } };
    expect(h.terminal(await h.generate(handle, { messages: ASK }))).toMatchObject({ error: { code: 'provider-error' } });
  });

  it('models report tools and canonical toolChoiceModes, and an empty list when tools are off', async () => {
    const h = harness();
    await h.select(TOOL_MODEL);
    expect(h.sent.at(-1)).toMatchObject({ model: { tools: true, toolChoiceModes: ['auto', 'none', 'required', 'tool'] } });
    await h.select(BASIC_MODEL);
    expect(h.sent.at(-1)).toMatchObject({ model: { tools: false, toolChoiceModes: [] } });
    const stale: LlmConnection = { ...BASIC_MODEL, id: 'c-stale', toolChoiceModes: ['auto'] };
    await h.select(stale);
    expect(h.sent.at(-1)).toMatchObject({ model: { tools: false, toolChoiceModes: [] } });
  });

  it('refuses a host connection whose tool-choice modes break the Model rules', async () => {
    const invalid: Array<LlmConnection['toolChoiceModes']> = [['auto'], ['none'], ['auto', 'none', 'auto'], []];
    for (const [position, toolChoiceModes] of invalid.entries()) {
      const h = harness();
      h.host.selection = { ...TOOL_MODEL, id: `c-bad-${position}`, toolChoiceModes };
      h.post({ type: 'llm.select', id: 'bad-modes' });
      await h.flush();
      expect(h.sent.at(-1)).toMatchObject({ id: 'bad-modes', error: { code: 'unsupported' } });
    }
  });

  it('passes an empty completed turn through, and still fails it for json output or a required call (spec gap)', async () => {
    const h = harness();
    const handle = await h.select();
    const empty: LlmGeneration = { content: [], finish: 'stop' };
    h.host.result = empty;
    expect(h.terminal(await h.generate(handle, { messages: ASK }))).toMatchObject({ result: empty });
    expect(h.terminal(await h.generate(handle, { messages: ASK, format: 'json' }))).toMatchObject({ error: { code: 'provider-error' } });
    expect(h.terminal(await h.generate(handle, { messages: ASK, tools: [WEATHER], toolChoice: 'required' }))).toMatchObject({ error: { code: 'provider-error' } });
  });

  it('revalidation fails when the connection changes its tool support', async () => {
    const h = harness();
    const handle = await h.select(TOOL_MODEL);
    h.host.connections.set(TOOL_MODEL.id, { ...TOOL_MODEL, toolChoiceModes: ['auto', 'none'] });
    h.post({ type: 'llm.describe', id: 'd1', handle });
    await h.flush();
    expect(h.sent.at(-1)).toMatchObject({ id: 'd1', error: { code: 'selection-expired' } });
  });

  it('never gives the host a tool call to run: settle waits for the host promise and relays calls verbatim', async () => {
    const h = harness();
    const handle = await h.select();
    const gate = deferred<unknown>();
    h.host.result = () => gate.promise;
    h.post({ type: 'llm.generate', id: 'slow', request: { handle, ...withTools() } });
    await h.flush();
    expect(h.sent.some((message) => message.id === 'slow')).toBe(false);
    gate.resolve(G2_RESULT);
    await h.flush();
    expect(h.sent.at(-1)).toEqual({ type: 'llm.generate.result', id: 'slow', result: G2_RESULT });
    expect(h.host.generations).toHaveLength(1);
  });
});
