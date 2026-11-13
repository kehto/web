import { describe, expect, it } from 'vitest';
import type { NappletMessage } from '@kehto/runtime';

import type { MockScheduler } from '../core/types.js';
import { LLM_MOCK_ENTRY, LLM_SPEC_REF, LLM_TOOLS_SPEC_REF, MOCK_LLM_CONNECTIONS, createMockLlmService, splitDeltas } from './llm.js';

type Msg = NappletMessage & Record<string, unknown>;

function manualScheduler() {
  const queue: Array<() => void> = [];
  const scheduler: MockScheduler = {
    schedule: (_ms, fn) => {
      queue.push(fn);
      return () => { const index = queue.indexOf(fn); if (index >= 0) queue.splice(index, 1); };
    },
  };
  const drain = (): void => { while (queue.length > 0) (queue.shift() as () => void)(); };
  return { scheduler, queue, drain };
}

function sink() {
  const sent: Msg[] = [];
  return { sent, send: (msg: NappletMessage) => { sent.push(msg as Msg); } };
}

function setup() {
  const timers = manualScheduler();
  const service = createMockLlmService({ scheduler: timers.scheduler });
  const out = sink();
  const call = (message: Record<string, unknown>, windowId = 'w1') => service.handleMessage(windowId, message as unknown as NappletMessage, out.send);
  const select = (windowId = 'w1', requirements?: Record<string, unknown>): string => {
    call({ type: 'llm.select', id: `sel-${windowId}`, ...(requirements ? { requirements } : {}) }, windowId);
    const model = out.sent.at(-1)?.model as { handle: string };
    return model.handle;
  };
  const user = (text: string) => ({ role: 'user', content: [{ type: 'text', text }] });
  return { service, out, call, select, user, ...timers };
}

const PROMPT = 'What is Debian?';
const ANSWER = 'You asked: "What is Debian?". This is a deterministic mock completion; no provider was contacted.';
const TOOL = {
  name: 'get_weather',
  description: 'Look up current weather',
  parameters: { type: 'object', properties: { city: { type: 'string' } }, required: ['city'] },
};

describe('createMockLlmService', () => {
  it('exposes descriptor, routes, and spec refs', () => {
    const { service } = setup();
    expect(service.descriptor).toEqual({
      name: 'llm',
      version: '1.0.0',
      description: 'Mock NAP-LLM: two seeded connections, deterministic streamed answers',
    });
    expect(service.mock.routes).toEqual(['llm.select', 'llm.describe', 'llm.generate', 'llm.cancel']);
    expect(service.messageCapabilities).toBeUndefined();
    expect(LLM_MOCK_ENTRY).toMatchObject({ domain: 'llm', kind: 'service', spec: LLM_SPEC_REF });
    expect(LLM_SPEC_REF).toEqual({ nap: 'NAP-LLM', status: 'draft', source: 'pr', pr: 134, sha: '3e10939cf788', path: 'naps/NAP-LLM.md' });
    expect(LLM_TOOLS_SPEC_REF.pr).toBe(138);
  });

  it('llm.select returns the first seeded model meeting requirements; describe revalidates it', () => {
    const { call, out } = setup();
    call({ type: 'llm.select', id: 's1', requirements: { json: true } });
    const result = out.sent[0] as Msg;
    expect(result.type).toBe('llm.select.result');
    expect(result.id).toBe('s1');
    const model = result.model as Record<string, unknown>;
    expect(model.handle).toMatch(/^h-[0-9a-f]{12}$/);
    expect(model).toMatchObject({
      name: 'Local llama.cpp',
      model: 'llama-3.1-8b-instruct-q4',
      route: 'Mock shell → llama.cpp on this device',
      images: false,
      json: true,
      tools: true,
    });
    call({ type: 'llm.describe', id: 'd1', handle: model.handle });
    expect(out.sent[1]).toEqual({ type: 'llm.describe.result', id: 'd1', model });

    call({ type: 'llm.select', id: 's2', requirements: { images: true } });
    expect((out.sent[2]?.model as Record<string, unknown>).model).toBe(MOCK_LLM_CONNECTIONS[1]?.model);
  });

  it('select is deterministic per seed', () => {
    const a = setup();
    const b = setup();
    expect(a.select()).toBe(b.select());
  });

  it('select errors: unsupported requirements, invalid record, missing id ignored', () => {
    const { call, out } = setup();
    call({ type: 'llm.select', id: 's1', requirements: { images: true, tools: true } });
    expect(out.sent[0]).toEqual({
      type: 'llm.select.result',
      id: 's1',
      error: { code: 'unsupported', message: 'No connection meets the requested model or capabilities.' },
    });
    call({ type: 'llm.select', id: 's2', requirements: null });
    expect(out.sent[1]).toEqual({ type: 'llm.select.result', id: 's2', error: { code: 'invalid-request', message: 'requirements must be a Requirements record.' } });
    call({ type: 'llm.select', id: 's3', requirements: { model: 'x', extra: 1 } });
    expect((out.sent[2]?.error as { code: string }).code).toBe('invalid-request');
    call({ type: 'llm.select' });
    expect(out.sent).toHaveLength(3);
  });

  it('describe rejects unknown, foreign and malformed handles', () => {
    const { call, out, select } = setup();
    const handle = select('w1');
    call({ type: 'llm.describe', id: 'd1', handle: 'h-000000000000' });
    expect(out.sent.at(-1)).toEqual({ type: 'llm.describe.result', id: 'd1', error: { code: 'selection-expired', message: 'Unknown or expired model handle; select again.' } });
    call({ type: 'llm.describe', id: 'd2', handle }, 'w2');
    expect((out.sent.at(-1)?.error as { code: string }).code).toBe('selection-expired');
    call({ type: 'llm.describe', id: 'd3', handle: '' });
    expect(out.sent.at(-1)).toEqual({ type: 'llm.describe.result', id: 'd3', error: { code: 'invalid-request', message: 'handle must be non-empty text.' } });
  });

  it('llm.generate streams ordered deltas through the scheduler, then one terminal result', () => {
    const { service, call, out, select, user, queue, drain } = setup();
    const handle = select();
    out.sent.length = 0;
    call({ type: 'llm.generate', id: 'g1', request: { handle, messages: [user(PROMPT)] } });
    expect(out.sent).toEqual([]);
    expect(queue).toHaveLength(1);
    drain();
    const deltas = out.sent.filter((msg) => msg.type === 'llm.delta');
    expect(deltas.map((msg) => msg.sequence)).toEqual([0, 1, 2, 3, 4]);
    expect(deltas[0]).toEqual({ type: 'llm.delta', requestId: 'g1', sequence: 0, block: 'text', blockIndex: 0, text: 'You asked: "What' });
    expect(deltas.map((msg) => msg.text).join('')).toBe(ANSWER);
    expect(splitDeltas(ANSWER)).toEqual(['You asked: "What', ' is Debian?". This', ' is a deterministic', ' mock completion; no', ' provider was contacted.']);
    expect(out.sent.at(-1)).toEqual({
      type: 'llm.generate.result',
      id: 'g1',
      result: {
        text: ANSWER,
        content: [{ type: 'text', text: ANSWER }],
        finish: 'stop',
        usage: { inputTokens: 4, outputTokens: Math.ceil(ANSWER.length / 4) },
      },
    });
    expect(out.sent.indexOf(out.sent.at(-1) as Msg)).toBe(5);
    expect(queue).toHaveLength(0);
    expect(service.mock.state().active.size).toBe(0);
  });

  it('format json yields a JSON object; samplingParams and maxTokens are accepted', () => {
    const { call, out, select, user, drain } = setup();
    const handle = select();
    call({ type: 'llm.generate', id: 'g1', request: { handle, messages: [user('Return a greeting.')], format: 'json', maxTokens: 64, temperature: 0.5, samplingParams: { top_p: 0.9 } } });
    drain();
    const result = out.sent.at(-1)?.result as { text: string; finish: string };
    expect(result.finish).toBe('stop');
    expect(JSON.parse(result.text)).toEqual({ answer: 'This is a deterministic mock completion; no provider was contacted.', prompt: 'Return a greeting.' });
  });

  it('answers with a deterministic tool call when tools are offered, then uses the tool result (pr138)', () => {
    const { call, out, select, user, drain } = setup();
    const handle = select();
    const question = user('What is the weather in Berlin?');
    call({ type: 'llm.generate', id: 'g2', request: { handle, messages: [question], tools: [TOOL], toolChoice: 'auto' } });
    drain();
    const first = out.sent.filter((msg) => msg.type === 'llm.delta')[0] as Msg;
    expect(first.block).toBe('toolcall');
    const result = out.sent.at(-1)?.result as { content: Array<Record<string, unknown>>; finish: string; text: string };
    expect(result.finish).toBe('toolUse');
    expect(result.text).toBe('');
    const callPart = result.content[0] as { type: string; toolCallId: string; name: string; arguments: Record<string, unknown> };
    expect(callPart.type).toBe('toolCall');
    expect(callPart.toolCallId).toMatch(/^call_[0-9a-f]{8}$/);
    expect(callPart.name).toBe('get_weather');
    expect(callPart.arguments).toEqual({ city: 'What is the weather in Berlin?' });

    const messages = [
      question,
      { role: 'assistant', content: [callPart] },
      { role: 'toolResult', toolCallId: callPart.toolCallId, toolName: 'get_weather', content: [{ type: 'text', text: '18°C and clear' }] },
    ];
    call({ type: 'llm.generate', id: 'g3', request: { handle, messages, tools: [TOOL] } });
    drain();
    expect((out.sent.at(-1)?.result as { text: string }).text).toBe('Using get_weather: 18°C and clear');

    call({ type: 'llm.generate', id: 'g4', request: { handle, messages: [user('Check the weather.')], tools: [TOOL], toolChoice: { type: 'tool', name: 'get_weather' } } });
    drain();
    expect((out.sent.at(-1)?.result as { finish: string }).finish).toBe('toolUse');
  });

  it('rejects an unanswered toolCall, unsupported inputs, malformed records and duplicate ids', () => {
    const { service, call, out, select, user } = setup();
    const handle = select();
    const callPart = { type: 'toolCall', toolCallId: 'call_1', name: 'get_weather', arguments: {} };
    call({ type: 'llm.generate', id: 'e1', request: { handle, messages: [user('x'), { role: 'assistant', content: [callPart] }], tools: [TOOL] } });
    expect(out.sent.at(-1)).toEqual({ type: 'llm.generate.result', id: 'e1', error: { code: 'invalid-request', message: 'Every toolCall part must be answered by exactly one toolResult message.' } });

    call({ type: 'llm.generate', id: 'e2', request: { handle, messages: [{ role: 'user', content: [{ type: 'image', mimeType: 'image/png', data: 'AAAA' }] }] } });
    expect(out.sent.at(-1)).toEqual({ type: 'llm.generate.result', id: 'e2', error: { code: 'unsupported', message: 'This connection does not accept image input.' } });

    const vision = select('w1', { images: true });
    call({ type: 'llm.generate', id: 'e3', request: { handle: vision, messages: [user('x')], tools: [TOOL] } });
    expect(out.sent.at(-1)).toEqual({ type: 'llm.generate.result', id: 'e3', error: { code: 'unsupported', message: 'This connection does not support tool calling.' } });

    call({ type: 'llm.generate', id: 'e4', request: { handle, messages: [{ role: 'user', content: [{ type: 'text', text: 'x' }], extra: null }] } });
    expect((out.sent.at(-1)?.error as { code: string }).code).toBe('invalid-request');
    call({ type: 'llm.generate', id: 'e5', request: { handle, messages: [{ role: 'user', content: [{ type: 'image', mimeType: 'image/png', data: 'not base64!' }] }] } });
    expect((out.sent.at(-1)?.error as { code: string }).code).toBe('invalid-request');
    call({ type: 'llm.generate', id: 'e6', request: { handle, messages: [user('x')], temperature: 9 } });
    expect((out.sent.at(-1)?.error as { code: string }).code).toBe('unsupported');

    call({ type: 'llm.generate', id: 'dup', request: { handle, messages: [user('x')] } });
    call({ type: 'llm.generate', id: 'dup', request: { handle, messages: [user('x')] } });
    expect(out.sent.at(-1)).toEqual({ type: 'llm.generate.result', id: 'dup', error: { code: 'invalid-request', message: 'A generation with this id is already active.' } });
    expect(service.mock.state().generations).toBe(1);
  });

  it('enforces the per-window concurrency quota', () => {
    const { call, out, select, user } = setup();
    const handle = select();
    for (const id of ['a', 'b', 'c', 'd']) call({ type: 'llm.generate', id, request: { handle, messages: [user('x')] } });
    call({ type: 'llm.generate', id: 'e', request: { handle, messages: [user('x')] } });
    expect(out.sent.at(-1)).toEqual({ type: 'llm.generate.result', id: 'e', error: { code: 'quota-exceeded', message: 'Too many active generations for this napplet.' } });
  });

  it('llm.cancel aborts an active generation; later and foreign cancels return false', () => {
    const { call, out, select, user, queue } = setup();
    const handle = select();
    call({ type: 'llm.generate', id: 'g1', request: { handle, messages: [user(PROMPT)] } });
    (queue.shift() as () => void)();
    expect(out.sent.filter((msg) => msg.type === 'llm.delta')).toHaveLength(1);
    call({ type: 'llm.cancel', id: 'c1', requestId: 'g1' }, 'w2');
    expect(out.sent.at(-1)).toEqual({ type: 'llm.cancel.result', id: 'c1', cancelled: false });
    call({ type: 'llm.cancel', id: 'c2', requestId: 'g1' });
    expect(out.sent.slice(-2)).toEqual([
      { type: 'llm.generate.result', id: 'g1', error: { code: 'cancelled', message: 'Generation cancelled; provider charges may still apply.' } },
      { type: 'llm.cancel.result', id: 'c2', cancelled: true },
    ]);
    expect(queue).toHaveLength(0);
    call({ type: 'llm.cancel', id: 'c3', requestId: 'g1' });
    expect(out.sent.at(-1)).toEqual({ type: 'llm.cancel.result', id: 'c3', cancelled: false });
    call({ type: 'llm.cancel', id: 'c4', requestId: '' });
    expect(out.sent.at(-1)).toEqual({ type: 'llm.cancel.result', id: 'c4', error: { code: 'invalid-request', message: 'requestId must be non-empty text.' } });
  });

  it('respondWith scripts the next answer and finish', () => {
    const { service, call, out, select, user, drain } = setup();
    const handle = select();
    service.respondWith('Incomplete answer', 'length');
    call({ type: 'llm.generate', id: 'g1', request: { handle, messages: [user('anything')] } });
    drain();
    expect(out.sent.at(-1)?.result).toEqual({
      text: 'Incomplete answer',
      content: [{ type: 'text', text: 'Incomplete answer' }],
      finish: 'length',
      usage: { inputTokens: 2, outputTokens: 5 },
    });
  });

  it('invalidateHandles expires selections and cancels active work', () => {
    const { service, call, out, select, user, queue } = setup();
    const handle = select();
    call({ type: 'llm.generate', id: 'g1', request: { handle, messages: [user('x')] } });
    service.invalidateHandles();
    expect(out.sent.at(-1)).toEqual({ type: 'llm.generate.result', id: 'g1', error: { code: 'cancelled', message: 'Generation cancelled; provider charges may still apply.' } });
    expect(queue).toHaveLength(0);
    call({ type: 'llm.describe', id: 'd1', handle });
    expect((out.sent.at(-1)?.error as { code: string }).code).toBe('selection-expired');
  });

  it('reset cancels timers and clears state; destroy and revoke clean per-window work', () => {
    const { service, call, out, select, user, queue } = setup();
    const handle = select();
    call({ type: 'llm.generate', id: 'g1', request: { handle, messages: [user('x')] } });
    service.mock.reset();
    expect(queue).toHaveLength(0);
    expect(service.mock.sent).toEqual([]);
    expect(service.mock.state().handles.size).toBe(0);

    const again = select();
    call({ type: 'llm.generate', id: 'g2', request: { handle: again, messages: [user('x')] } });
    out.sent.length = 0;
    service.onWindowDestroyed?.('w1');
    expect(out.sent).toEqual([]);
    expect(queue).toHaveLength(0);
    expect(service.mock.state().active.size).toBe(0);
    expect(service.mock.state().handles.has('w1')).toBe(false);

    const third = select('w3');
    call({ type: 'llm.generate', id: 'g3', request: { handle: third, messages: [user('x')] } }, 'w3');
    service.onCapabilityRevoked?.('w3', 'llm:generate');
    expect(out.sent.at(-1)).toEqual({ type: 'llm.generate.result', id: 'g3', error: { code: 'cancelled', message: 'Generation cancelled; provider charges may still apply.' } });
    expect(service.mock.state().handles.has('w3')).toBe(false);
  });
});
