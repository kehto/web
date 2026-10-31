/**
 * NAP-LLM reference service conformance.
 * Authority: napplet/naps PR #134 at 3e10939cf788878bbdcc022c101f0ac6193f316c,
 * cases LLM-C01..C11 exercised against a controllable host fixture.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { NappletMessage } from '@napplet/core';
import { createLlmService, type LlmConnection, type LlmConnectionHost, type LlmGenerateHooks, type LlmPromptOptions, type LlmService } from './llm-service.js';
import { LlmServiceError, type LlmGeneration, type LlmGenerationRequest } from './llm-types.js';

type Sent = Record<string, unknown> & { type: string };

const TEXT_MODEL: LlmConnection = { id: 'c-text', name: 'Text only', model: 'text-1', route: 'Paja → Example provider', images: false, json: true };
const VISION_MODEL: LlmConnection = { id: 'c-vision', name: 'Vision', model: 'vision-1', route: 'Paja → Example provider', images: true, json: false };
const PNG = 'iVBORw0KGgo=';

function deferred<T>() {
  let resolve!: (value: T) => void; let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

class Fixture implements LlmConnectionHost {
  connections = new Map<string, LlmConnection>([[TEXT_MODEL.id, TEXT_MODEL], [VISION_MODEL.id, VISION_MODEL]]);
  selection: LlmConnection | null | Error | Promise<LlmConnection | null> = TEXT_MODEL;
  selectPrompts: LlmPromptOptions[] = [];
  consentPrompts: LlmPromptOptions[] = [];
  consent: boolean | Promise<boolean> = true;
  generations: LlmGenerationRequest[] = [];
  result: LlmGeneration | Error | (() => Promise<LlmGeneration>) = { text: '{"greeting":"Hello"}', finish: 'stop', usage: { inputTokens: 12, outputTokens: 7 } };
  hooks: LlmGenerateHooks[] = [];
  listeners = new Set<() => void>();
  select(_ctx: unknown, _req: unknown, options?: LlmPromptOptions) {
    if (options) this.selectPrompts.push(options);
    if (this.selection instanceof Error) throw this.selection;
    return this.selection;
  }
  describe(_ctx: unknown, id: string) { return this.connections.get(id) ?? null; }
  authorize(_ctx: unknown, _c: unknown, _r: unknown, options?: LlmPromptOptions) {
    if (options) this.consentPrompts.push(options);
    return this.consent;
  }
  async generate(_ctx: unknown, _c: LlmConnection, request: LlmGenerationRequest, hooks: LlmGenerateHooks) {
    this.generations.push(request); this.hooks.push(hooks);
    if (this.result instanceof Error) throw this.result;
    if (typeof this.result === 'function') return this.result();
    return this.result;
  }
  subscribe(listener: () => void) { this.listeners.add(listener); return () => this.listeners.delete(listener); }
  change() { for (const listener of this.listeners) listener(); }
}

function harness(options: Partial<Parameters<typeof createLlmService>[0]> = {}) {
  const host = new Fixture();
  const service: LlmService = createLlmService({ host, createHandle: (() => { let n = 0; return () => `h${++n}`; })(), ...options });
  service.onRegistered?.({} as never);
  const sent = new Map<string, Sent[]>();
  const send = (windowId: string) => (message: NappletMessage) => { sent.set(windowId, [...(sent.get(windowId) ?? []), message as Sent]); };
  const post = (windowId: string, message: Record<string, unknown> & { type: string }) => service.handleMessage(windowId, message, send(windowId));
  const last = (windowId = 'w1') => sent.get(windowId)?.at(-1);
  const all = (windowId = 'w1') => sent.get(windowId) ?? [];
  const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
  const select = async (windowId = 'w1', requirements?: unknown) => {
    post(windowId, { type: 'llm.select', id: `s-${Math.random()}`, ...(requirements === undefined ? {} : { requirements }) });
    await flush();
    return (last(windowId)?.model as { handle: string } | undefined)?.handle;
  };
  const userMessage = (text = 'hi') => ({ role: 'user', content: [{ type: 'text', text }] });
  return { host, service, post, last, all, flush, select, userMessage };
}

describe('NAP-LLM service', () => {
  beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }));
  afterEach(() => vi.useRealTimers());

  it('C01: select, describe and generate correlate by id with one terminal result', async () => {
    const h = harness();
    const handle = await h.select();
    expect(h.last()).toEqual({ type: 'llm.select.result', id: expect.any(String), model: { handle: 'h1', name: 'Text only', model: 'text-1', route: 'Paja → Example provider', images: false, json: true } });
    h.post('w1', { type: 'llm.describe', id: 'd1', handle });
    await h.flush();
    expect(h.last()).toMatchObject({ type: 'llm.describe.result', id: 'd1', model: { handle: 'h1' } });
    h.post('w1', { type: 'llm.generate', id: 'g1', request: { handle, messages: [h.userMessage()], format: 'json' } });
    await h.flush();
    expect(h.last()).toEqual({ type: 'llm.generate.result', id: 'g1', result: { text: '{"greeting":"Hello"}', finish: 'stop', usage: { inputTokens: 12, outputTokens: 7 } } });
    expect(h.all().filter((m) => m.id === 'g1')).toHaveLength(1);
    expect(h.service.activeGenerations()).toBe(0);
  });

  it('C02: malformed records, bad base64, enums and explicit null are invalid-request without provider generation', async () => {
    const h = harness();
    const handle = await h.select();
    const bad = [
      { handle, messages: [] },
      { handle, messages: [h.userMessage()], format: 'xml' },
      { handle, messages: [h.userMessage()], extra: true },
      { handle, messages: [{ role: 'tool', content: [{ type: 'text', text: 'x' }] }] },
      { handle, messages: [{ role: 'user', content: [{ type: 'image', mimeType: 'image/png', data: 'not base64!' }] }] },
      { handle, messages: [{ role: 'user', content: [{ type: 'image', mimeType: 'image/gif', data: PNG }] }] },
      { handle, messages: [h.userMessage()], format: null },
      null,
    ];
    for (const [index, request] of bad.entries()) {
      h.post('w1', { type: 'llm.generate', id: `bad-${index}`, request });
      await h.flush();
      expect(h.last()).toMatchObject({ type: 'llm.generate.result', id: `bad-${index}`, error: { code: 'invalid-request' } });
    }
    h.post('w1', { type: 'llm.select', id: 's-null', requirements: null });
    await h.flush();
    expect(h.last()).toMatchObject({ type: 'llm.select.result', id: 's-null', error: { code: 'invalid-request' } });
    h.post('w1', { type: 'llm.cancel', id: 'c-bad', requestId: '' });
    expect(h.last()).toMatchObject({ type: 'llm.cancel.result', id: 'c-bad', error: { code: 'invalid-request' } });
    h.post('w1', { type: 'llm.generate', id: '', request: { handle, messages: [h.userMessage()] } });
    h.post('w1', { type: 'llm.generate.result', id: 'forged', result: { text: '', finish: 'stop' } });
    expect(h.host.generations).toHaveLength(0);
  });

  it('C03: unsupported images, JSON, exact model and provider restrictions fail explicitly without downgrade', async () => {
    const h = harness();
    const handle = await h.select();
    h.post('w1', { type: 'llm.generate', id: 'img', request: { handle, messages: [{ role: 'user', content: [{ type: 'image', mimeType: 'image/png', data: PNG }] }] } });
    await h.flush();
    expect(h.last()).toMatchObject({ id: 'img', error: { code: 'unsupported' } });
    h.host.selection = VISION_MODEL;
    const vision = await h.select();
    h.post('w1', { type: 'llm.generate', id: 'json', request: { handle: vision, messages: [h.userMessage()], format: 'json' } });
    await h.flush();
    expect(h.last()).toMatchObject({ id: 'json', error: { code: 'unsupported' } });
    await h.select('w1', { model: 'other-model' });
    expect(h.last()).toMatchObject({ type: 'llm.select.result', error: { code: 'unsupported' } });
    await h.select('w1', { json: true });
    expect(h.last()).toMatchObject({ type: 'llm.select.result', error: { code: 'unsupported' } });
    h.host.selection = new LlmServiceError('unsupported', 'No compatible connection is configured.');
    await h.select();
    expect(h.last()).toMatchObject({ error: { code: 'unsupported', message: 'No compatible connection is configured.' } });
    h.host.selection = TEXT_MODEL;
    h.host.result = new LlmServiceError('unsupported', 'This provider rejects assistant-first conversations.');
    h.post('w1', { type: 'llm.generate', id: 'prov', request: { handle, messages: [h.userMessage()] } });
    await h.flush();
    expect(h.last()).toMatchObject({ id: 'prov', error: { code: 'unsupported', message: 'This provider rejects assistant-first conversations.' } });
  });

  it('C04: declining disclosure consent is user-cancelled with zero provider generations', async () => {
    const h = harness();
    const handle = await h.select();
    h.host.consent = false;
    h.post('w1', { type: 'llm.generate', id: 'g1', request: { handle, messages: [h.userMessage()] } });
    await h.flush();
    expect(h.last()).toMatchObject({ id: 'g1', error: { code: 'user-cancelled' } });
    expect(h.host.generations).toHaveLength(0);
    h.host.selection = null;
    await h.select();
    expect(h.last()).toMatchObject({ type: 'llm.select.result', error: { code: 'user-cancelled' } });
  });

  it('C05: endpoints cannot use each other\'s handles, ids or cancellations', async () => {
    const h = harness();
    const handle = await h.select('w1');
    await h.select('w2');
    h.post('w2', { type: 'llm.describe', id: 'd', handle });
    await h.flush();
    expect(h.last('w2')).toMatchObject({ id: 'd', error: { code: 'selection-expired' } });
    h.host.result = () => new Promise(() => undefined);
    h.post('w1', { type: 'llm.generate', id: 'shared', request: { handle, messages: [h.userMessage()] } });
    h.post('w2', { type: 'llm.generate', id: 'shared', request: { handle: 'h2', messages: [h.userMessage()] } });
    await h.flush();
    h.post('w2', { type: 'llm.cancel', id: 'c', requestId: 'shared' });
    expect(h.last('w2')).toMatchObject({ type: 'llm.cancel.result', id: 'c', cancelled: true });
    expect(h.all('w1').some((m) => m.type === 'llm.generate.result')).toBe(false);
    h.post('w2', { type: 'llm.cancel', id: 'c2', requestId: 'shared' });
    expect(h.last('w2')).toMatchObject({ cancelled: false });
    expect(h.all('w2').filter((m) => m.type === 'llm.generate.result')).toEqual([expect.objectContaining({ id: 'shared', error: { code: 'cancelled', message: expect.any(String) } })]);
    expect(h.all('w1').filter((m) => m.type === 'llm.generate.result')).toHaveLength(0);
  });

  it('C06: an active duplicate generation id is rejected without a second provider request', async () => {
    const h = harness();
    const handle = await h.select();
    const pending = deferred<LlmGeneration>();
    h.host.result = () => pending.promise;
    h.post('w1', { type: 'llm.generate', id: 'g1', request: { handle, messages: [h.userMessage()] } });
    await h.flush();
    h.post('w1', { type: 'llm.generate', id: 'g1', request: { handle, messages: [h.userMessage()] } });
    expect(h.last()).toMatchObject({ id: 'g1', error: { code: 'invalid-request' } });
    expect(h.host.generations).toHaveLength(1);
    pending.resolve({ text: 'done', finish: 'stop' });
    await h.flush();
    expect(h.last()).toMatchObject({ id: 'g1', result: { text: 'done' } });
    expect(h.all().filter((m) => m.type === 'llm.generate.result')).toHaveLength(2);
  });

  it('C07: cancel during consent prevents submission; timeout settles a stalled provider and suppresses late output', async () => {
    const h = harness({ deadlineMs: 1000 });
    const handle = await h.select();
    const consent = deferred<boolean>();
    h.host.consent = consent.promise;
    h.post('w1', { type: 'llm.generate', id: 'g1', request: { handle, messages: [h.userMessage()] } });
    await h.flush();
    h.post('w1', { type: 'llm.cancel', id: 'c1', requestId: 'g1' });
    expect(h.last()).toMatchObject({ type: 'llm.cancel.result', cancelled: true });
    expect(h.all().find((m) => m.type === 'llm.generate.result')).toMatchObject({ id: 'g1', error: { code: 'cancelled' } });
    consent.resolve(true);
    await h.flush();
    expect(h.host.generations).toHaveLength(0);

    h.host.consent = true;
    const stalled = deferred<LlmGeneration>();
    h.host.result = () => stalled.promise;
    h.post('w1', { type: 'llm.generate', id: 'g2', request: { handle, messages: [h.userMessage()] } });
    await h.flush();
    await vi.advanceTimersByTimeAsync(1001);
    expect(h.last()).toMatchObject({ id: 'g2', error: { code: 'timeout' } });
    expect(h.host.hooks.at(-1)?.signal.aborted).toBe(true);
    h.host.hooks.at(-1)?.onDelta('late');
    stalled.resolve({ text: 'late', finish: 'stop' });
    await h.flush();
    expect(h.all().filter((m) => m.id === 'g2' || m.requestId === 'g2')).toHaveLength(1);
  });

  it('C08: connection or account changes during consent cancel work and expire every handle', async () => {
    const h = harness();
    const handle = await h.select();
    const consent = deferred<boolean>();
    h.host.consent = consent.promise;
    h.post('w1', { type: 'llm.generate', id: 'g1', request: { handle, messages: [h.userMessage()] } });
    await h.flush();
    h.host.change();
    expect(h.last()).toMatchObject({ id: 'g1', error: { code: 'cancelled' } });
    consent.resolve(true);
    await h.flush();
    expect(h.host.generations).toHaveLength(0);
    h.post('w1', { type: 'llm.describe', id: 'd1', handle });
    await h.flush();
    expect(h.last()).toMatchObject({ id: 'd1', error: { code: 'selection-expired' } });

    const again = await h.select();
    h.host.connections.set(TEXT_MODEL.id, { ...TEXT_MODEL, model: 'text-2' });
    h.post('w1', { type: 'llm.describe', id: 'd2', handle: again });
    await h.flush();
    expect(h.last()).toMatchObject({ id: 'd2', error: { code: 'selection-expired' } });
    h.service.onCapabilityRevoked?.('w1', 'llm:generate');
    expect(h.service.activeGenerations()).toBe(0);
  });

  it('C09: deltas are zero-based and ordered, one terminal result follows, none after termination', async () => {
    const h = harness();
    const handle = await h.select();
    h.host.result = async () => {
      const hooks = h.host.hooks.at(-1)!;
      hooks.onDelta('{"greeting":'); hooks.onDelta('"Hello"}');
      return { text: '{"greeting":"Hello"}', finish: 'stop' };
    };
    h.post('w1', { type: 'llm.generate', id: 'g1', request: { handle, messages: [h.userMessage()], format: 'json' } });
    await h.flush();
    const deltas = h.all().filter((m) => m.type === 'llm.delta');
    expect(deltas).toEqual([
      { type: 'llm.delta', requestId: 'g1', sequence: 0, text: '{"greeting":' },
      { type: 'llm.delta', requestId: 'g1', sequence: 1, text: '"Hello"}' },
    ]);
    expect(deltas.every((d) => !('id' in d))).toBe(true);
    expect(h.last()).toMatchObject({ type: 'llm.generate.result', id: 'g1', result: { finish: 'stop' } });
    h.host.hooks.at(-1)!.onDelta('after');
    expect(h.all().filter((m) => m.type === 'llm.delta')).toHaveLength(2);

    const race = deferred<LlmGeneration>();
    h.host.result = () => race.promise;
    h.post('w1', { type: 'llm.generate', id: 'g2', request: { handle, messages: [h.userMessage()] } });
    await h.flush();
    race.resolve({ text: 'won', finish: 'stop' });
    await h.flush();
    h.post('w1', { type: 'llm.cancel', id: 'c', requestId: 'g2' });
    expect(h.last()).toMatchObject({ cancelled: false });
    expect(h.all().filter((m) => m.id === 'g2')).toEqual([expect.objectContaining({ result: { text: 'won', finish: 'stop' } })]);
  });

  it('C10: length and refusal stay partial; missing markers and invalid JSON completions are provider-error', async () => {
    const h = harness();
    const handle = await h.select();
    const run = async (id: string, result: unknown, format?: string) => {
      h.host.result = () => Promise.resolve(result as LlmGeneration);
      h.post('w1', { type: 'llm.generate', id, request: { handle, messages: [h.userMessage()], ...(format ? { format } : {}) } });
      await h.flush();
      return h.last();
    };
    expect(await run('len', { text: 'Incomplete', finish: 'length' })).toMatchObject({ result: { text: 'Incomplete', finish: 'length' } });
    expect(await run('ref', { text: '', finish: 'refusal' })).toMatchObject({ result: { finish: 'refusal' } });
    expect(await run('nofinish', { text: 'x' })).toMatchObject({ error: { code: 'provider-error' } });
    expect(await run('badusage', { text: 'x', finish: 'stop', usage: { inputTokens: -1, outputTokens: 0 } })).toMatchObject({ error: { code: 'provider-error' } });
    expect(await run('array', { text: '[1]', finish: 'stop' }, 'json')).toMatchObject({ error: { code: 'provider-error' } });
    expect(await run('partialjson', { text: '{"a":', finish: 'length' }, 'json')).toMatchObject({ result: { finish: 'length' } });
  });

  it('C11: provider failures never leak bodies, inputs or credentials', async () => {
    const h = harness();
    const handle = await h.select();
    h.host.result = new Error('401 {"error":"invalid api key sk-secret-123"} prompt: hi');
    h.post('w1', { type: 'llm.generate', id: 'g1', request: { handle, messages: [h.userMessage('my private prompt')] } });
    await h.flush();
    const result = h.last()!;
    expect(result).toEqual({ type: 'llm.generate.result', id: 'g1', error: { code: 'provider-error', message: 'The provider request failed.' } });
    expect(JSON.stringify(result)).not.toMatch(/sk-secret|private prompt|invalid api key/);
  });

  it('enforces concurrency and size policy as quota-exceeded and cleans up on window destruction', async () => {
    const h = harness({ maxConcurrentPerWindow: 1, maxRequestChars: 200 });
    const handle = await h.select();
    const pending = deferred<LlmGeneration>();
    h.host.result = () => pending.promise;
    h.post('w1', { type: 'llm.generate', id: 'g1', request: { handle, messages: [h.userMessage()] } });
    await h.flush();
    h.post('w1', { type: 'llm.generate', id: 'g2', request: { handle, messages: [h.userMessage()] } });
    expect(h.last()).toMatchObject({ id: 'g2', error: { code: 'quota-exceeded' } });
    h.service.onWindowDestroyed?.('w1');
    expect(h.service.activeGenerations()).toBe(0);
    pending.resolve({ text: 'x', finish: 'stop' });
    await h.flush();
    expect(h.all().filter((m) => m.id === 'g1')).toHaveLength(0);
    h.post('w1', { type: 'llm.generate', id: 'g3', request: { handle, messages: [h.userMessage('x'.repeat(400))] } });
    expect(h.last()).toMatchObject({ id: 'g3', error: { code: 'quota-exceeded' } });
    h.post('w1', { type: 'llm.describe', id: 'd', handle });
    await h.flush();
    expect(h.last()).toMatchObject({ id: 'd', error: { code: 'selection-expired' } });
  });

  it('#368: bounds live handles per window, evicting the least recently used handle', async () => {
    const h = harness();
    const handles: string[] = [];
    for (let index = 0; index < 33; index++) handles.push((await h.select())!);
    h.post('w1', { type: 'llm.describe', id: 'd-first', handle: handles[0] });
    await h.flush();
    expect(h.last()).toMatchObject({ id: 'd-first', error: { code: 'selection-expired' } });
    h.post('w1', { type: 'llm.describe', id: 'd-last', handle: handles[32] });
    await h.flush();
    expect(h.last()).toMatchObject({ id: 'd-last', model: { handle: handles[32] } });

    const lru = harness({ maxHandlesPerWindow: 2 });
    const first = await lru.select();
    const second = await lru.select();
    lru.post('w1', { type: 'llm.describe', id: 'touch', handle: first });
    await lru.flush();
    const third = await lru.select();
    for (const [id, handle, code] of [['d1', first, null], ['d2', second, 'selection-expired'], ['d3', third, null]] as const) {
      lru.post('w1', { type: 'llm.describe', id, handle });
      await lru.flush();
      if (code) expect(lru.last()).toMatchObject({ id, error: { code } });
      else expect(lru.last()).toMatchObject({ id, model: { handle } });
    }
    const other = await lru.select('w2');
    lru.post('w2', { type: 'llm.describe', id: 'd-w2', handle: other });
    await lru.flush();
    expect(lru.last('w2')).toMatchObject({ id: 'd-w2', model: { handle: other } });
  });

  it('#368: evicting a handle while its consent prompt is open expires the generation and withdraws the prompt', async () => {
    const h = harness({ maxHandlesPerWindow: 1 });
    const handle = await h.select();
    const consent = deferred<boolean>();
    h.host.consent = consent.promise;
    h.post('w1', { type: 'llm.generate', id: 'g1', request: { handle, messages: [h.userMessage()] } });
    await h.flush();
    expect(h.host.consentPrompts[0]?.signal.aborted).toBe(false);
    await h.select();
    expect(h.all().find((m) => m.id === 'g1')).toMatchObject({ type: 'llm.generate.result', error: { code: 'selection-expired' } });
    expect(h.host.consentPrompts[0]?.signal.aborted).toBe(true);
    consent.resolve(true);
    await h.flush();
    expect(h.host.generations).toHaveLength(0);
    expect(h.all().filter((m) => m.id === 'g1')).toHaveLength(1);
  });

  it('#369: the consent prompt signal aborts only when the generation settles without the host answer', async () => {
    const h = harness({ deadlineMs: 1000 });
    const handle = await h.select();
    const open = async (id: string) => {
      const consent = deferred<boolean>();
      h.host.consent = consent.promise;
      h.post('w1', { type: 'llm.generate', id, request: { handle, messages: [h.userMessage()] } });
      await h.flush();
      const prompt = h.host.consentPrompts.at(-1)!;
      expect(prompt.signal.aborted).toBe(false);
      return { consent, prompt };
    };

    const cancelled = await open('g-cancel');
    h.post('w1', { type: 'llm.cancel', id: 'c', requestId: 'g-cancel' });
    expect(cancelled.prompt.signal.aborted).toBe(true);

    const timedOut = await open('g-timeout');
    await vi.advanceTimersByTimeAsync(1001);
    expect(h.all().find((m) => m.id === 'g-timeout')).toMatchObject({ error: { code: 'timeout' } });
    expect(timedOut.prompt.signal.aborted).toBe(true);

    const invalidated = await open('g-invalidate');
    h.service.invalidateHandles();
    expect(h.all().find((m) => m.id === 'g-invalidate')).toMatchObject({ error: { code: 'selection-expired' } });
    expect(invalidated.prompt.signal.aborted).toBe(true);

    const fresh = await h.select();
    for (const [id, end] of [
      ['g-revoke', () => h.service.revokeWindow('w1')],
      ['g-destroy', () => h.service.onWindowDestroyed?.('w1')],
      ['g-unregister', () => h.service.onUnregistered?.()],
    ] as const) {
      h.service.onRegistered?.({} as never);
      const live = await h.select();
      const consent = deferred<boolean>();
      h.host.consent = consent.promise;
      h.post('w1', { type: 'llm.generate', id, request: { handle: live ?? fresh, messages: [h.userMessage()] } });
      await h.flush();
      const prompt = h.host.consentPrompts.at(-1)!;
      end();
      expect(prompt.signal.aborted, id).toBe(true);
      consent.resolve(true);
    }
    await h.flush();
    expect(h.host.generations).toHaveLength(0);

    h.service.onRegistered?.({} as never);
    const answered = await h.select();
    for (const [id, answer] of [['g-yes', true], ['g-no', false]] as const) {
      h.host.consent = answer;
      h.post('w1', { type: 'llm.generate', id, request: { handle: answered, messages: [h.userMessage()] } });
      await h.flush();
      expect(h.host.consentPrompts.at(-1)?.signal.aborted, id).toBe(false);
    }
    expect(h.all().find((m) => m.id === 'g-yes')).toMatchObject({ result: { finish: 'stop' } });
    expect(h.all().find((m) => m.id === 'g-no')).toMatchObject({ error: { code: 'user-cancelled' } });
  });

  it('#369: a pending selection prompt is withdrawn and settled on invalidation, revocation, destruction and unregistration', async () => {
    const h = harness();
    const pendingSelect = async (windowId: string, id: string) => {
      const choice = deferred<LlmConnection | null>();
      h.host.selection = choice.promise;
      h.post(windowId, { type: 'llm.select', id });
      await h.flush();
      const prompt = h.host.selectPrompts.at(-1)!;
      expect(prompt.signal.aborted).toBe(false);
      return { choice, prompt };
    };

    const invalidated = await pendingSelect('w1', 's-invalidate');
    h.service.invalidateHandles();
    expect(h.last()).toMatchObject({ type: 'llm.select.result', id: 's-invalidate', error: { code: 'selection-expired' } });
    expect(invalidated.prompt.signal.aborted).toBe(true);
    invalidated.choice.resolve(TEXT_MODEL);
    await h.flush();
    expect(h.all().filter((m) => m.id === 's-invalidate')).toHaveLength(1);

    const revoked = await pendingSelect('w1', 's-revoke');
    h.service.revokeWindow('w1');
    expect(h.last()).toMatchObject({ id: 's-revoke', error: { code: 'cancelled' } });
    expect(revoked.prompt.signal.aborted).toBe(true);
    revoked.choice.resolve(TEXT_MODEL);
    await h.flush();
    expect(h.all().filter((m) => m.id === 's-revoke')).toHaveLength(1);

    const destroyed = await pendingSelect('w2', 's-destroy');
    h.service.onWindowDestroyed?.('w2');
    expect(destroyed.prompt.signal.aborted).toBe(true);
    destroyed.choice.resolve(TEXT_MODEL);
    await h.flush();
    expect(h.all('w2')).toHaveLength(0);

    const unregistered = await pendingSelect('w3', 's-unregister');
    h.service.onUnregistered?.();
    expect(unregistered.prompt.signal.aborted).toBe(true);
    unregistered.choice.resolve(TEXT_MODEL);
    await h.flush();
    expect(h.all('w3')).toHaveLength(0);

    h.service.onRegistered?.({} as never);
    h.host.selection = TEXT_MODEL;
    await h.select('w4');
    expect(h.host.selectPrompts.at(-1)?.signal.aborted).toBe(false);
    expect(h.last('w4')).toMatchObject({ model: { name: 'Text only' } });
  });

  it('stops answering after unregistration and requires a host', () => {
    const h = harness();
    h.service.onUnregistered?.();
    h.post('w1', { type: 'llm.select', id: 's1' });
    expect(h.all()).toHaveLength(0);
    expect(() => createLlmService({} as never)).toThrow(/host/);
  });
});
