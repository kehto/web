import { afterEach, describe, expect, it, vi } from 'vitest';
import type { NappletMessage, NostrEvent } from '@napplet/core';
import { createRuntime } from './runtime.js';
import { createMockRuntimeAdapter, createNip5dSessionEntry } from './test-utils.js';
import type { ApprovalAnswer, ApprovalCancellation, ApprovalPrompt, ApprovalSignal } from './approval-coordinator.js';
import type { PermissionAdapter } from './permission-runtime.js';
import type { RelayOperationPlan, RelayPlanningServiceHandler } from './service-types.js';
import { defaultRateLimitConfig } from './rate-limit.js';

declare const console: { warn(message: string): void };
declare const AbortController: { new(): ApprovalCancellation };
declare function setTimeout(callback: () => void, ms: number): unknown;
declare function clearTimeout(handle: unknown): void;

const event: NostrEvent = { id: 'b'.repeat(64), pubkey: 'c'.repeat(64), created_at: 1,
  kind: 1, tags: [], content: 'approved', sig: 'd'.repeat(128) };
const cleanups: Array<() => void> = [];
afterEach(() => { for (const cleanup of cleanups.splice(0)) cleanup(); vi.restoreAllMocks(); });

async function fixture(overrides: Partial<PermissionAdapter> = {}) {
  const prompt = vi.fn(async (_request: ApprovalPrompt): Promise<ApprovalAnswer> => ({ effect: 'allow', lifetime: 'session' }));
  const ctx = createMockRuntimeAdapter({ permissions: {
    now: () => 0, prompt, createCancellation: () => new AbortController(),
    schedule: (callback, delay) => { const timer = setTimeout(callback, delay); return () => clearTimeout(timer); },
    ...overrides,
  } });
  const runtime = createRuntime(ctx.hooks);
  cleanups.push(() => runtime.destroy());
  const entry = { ...createNip5dSessionEntry('window', 'app', 'a'.repeat(64)),
    permissionPrincipal: { kind: 'development' as const, target: 'http://localhost:5173', artifactHash: 'a'.repeat(64) } };
  runtime.sessionRegistry.register('window', entry);
  await runtime.permissions!.admit('window', { required: ['relay'], optional: [], available: ['relay'] });
  const query = (id = 'query') => runtime.handleMessage('window', { type: 'relay.query', id, filters: [{ kinds: [1] }] });
  const results = () => ctx.sent.filter(({ message }) => !Array.isArray(message) && message.type === 'relay.query.result').map(({ message }) => message);
  return { runtime, ctx, prompt, query, results, entry };
}

function plannedService() {
  let collect!: (message: NappletMessage) => void;
  let signal!: ApprovalSignal;
  let subId = '';
  const relayUrls = ['wss://approved.example'];
  const plan = vi.fn((): RelayOperationPlan => Object.freeze({ operation: 'query', relayUrls: Object.freeze([...relayUrls]), localOnly: false }));
  const execute = vi.fn((_windowId: string, message: NappletMessage, _plan: RelayOperationPlan, operationSignal: ApprovalSignal,
    send: (message: NappletMessage) => void) => {
    collect = send; signal = operationSignal;
    subId = (message as NappletMessage & { subId: string }).subId;
  });
  const legacy = vi.fn();
  const service: RelayPlanningServiceHandler = { descriptor: { name: 'relay', version: '1' },
    planRelayOperation: plan, executeRelayOperation: execute, handleMessage: legacy };
  return { service, plan, execute, legacy, relayUrls,
    signal: () => signal,
    event: () => collect({ type: 'relay.event', subId, result: { event } } as NappletMessage),
    eose: () => collect({ type: 'relay.eose', subId } as NappletMessage),
  };
}

describe('relay.query operation authority', () => {
  it('denies registered transport before any relay I/O and returns a correlated error', async () => {
    const f = await fixture({ prompt: async ({ missing }) => ({ effect: missing.some((p) => p.category === 'network') ? 'deny' : 'allow', lifetime: 'session' }) });
    const service = plannedService();
    f.runtime.registerService('relay', service.service);
    f.query();
    await vi.waitFor(() => expect(f.results()).toEqual([{ type: 'relay.query.result', id: 'query', error: expect.any(String) }]));
    expect(service.execute).not.toHaveBeenCalled();
    expect(service.legacy).not.toHaveBeenCalled();
  });

  it('executes the approved service plan once and retains its signal through EOSE', async () => {
    const f = await fixture();
    const service = plannedService();
    f.runtime.registerService('relay', service.service);
    f.query();
    await vi.waitFor(() => expect(service.execute).toHaveBeenCalledTimes(1));
    expect(service.plan).toHaveBeenCalledWith('window', expect.objectContaining({ type: 'relay.query' }));
    expect(service.execute.mock.calls[0][2]).toEqual({ operation: 'query', relayUrls: ['wss://approved.example'], localOnly: false });
    expect(f.prompt.mock.calls[1][0].missing).toContainEqual({ category: 'network', domain: 'relay', operation: 'relay.network', scope: { kind: 'origin', value: 'wss://approved.example' } });
    service.event(); service.event(); service.eose();
    await vi.waitFor(() => expect(f.results()).toEqual([{ type: 'relay.query.result', id: 'query', events: [{ event }] }]));
    expect(service.legacy).toHaveBeenCalledWith('window', expect.objectContaining({ type: 'relay.close' }), expect.any(Function));
    service.event(); service.eose();
    expect(f.results()).toHaveLength(1);
  });

  it('cancels an active planned query on revoke and suppresses late results', async () => {
    const f = await fixture();
    const service = plannedService();
    f.runtime.registerService('relay', service.service);
    f.query();
    await vi.waitFor(() => expect(service.execute).toHaveBeenCalledTimes(1));
    service.event();
    const network = f.runtime.permissions!.grants.find((grant) => grant.permission.category === 'network')!;
    f.runtime.permissions!.revoke(network.id);
    expect(service.signal().aborted).toBe(true);
    await vi.waitFor(() => expect(f.results()).toEqual([{ type: 'relay.query.result', id: 'query', error: expect.any(String) }]));
    service.event(); service.eose();
    expect(f.results()).toHaveLength(1);
    expect(service.legacy).toHaveBeenCalledWith('window', expect.objectContaining({ type: 'relay.close' }), expect.any(Function));
  });

  it('holds a copied destination plan while approval waits', async () => {
    let answer!: (value: ApprovalAnswer) => void;
    const f = await fixture({ prompt: ({ missing }) => missing.some((p) => p.category === 'network')
      ? new Promise((resolve) => { answer = resolve; }) : Promise.resolve({ effect: 'allow', lifetime: 'session' }) });
    const service = plannedService();
    f.runtime.registerService('relay', service.service);
    f.query();
    await vi.waitFor(() => expect(answer).toBeTypeOf('function'));
    service.relayUrls[0] = 'wss://unapproved.example';
    answer({ effect: 'allow', lifetime: 'once' });
    await vi.waitFor(() => expect(service.execute).toHaveBeenCalledTimes(1));
    expect(service.execute.mock.calls[0][2].relayUrls).toEqual(['wss://approved.example']);
    service.eose();
  });

  it('uses only the fallback adapter planned destination and unsubscribes synchronous EOSE', async () => {
    const f = await fixture();
    const pool = f.ctx.hooks.relayPool!;
    pool.isAvailable = () => true;
    pool.selectRelayTier = () => ['wss://approved.example'];
    const unsubscribe = vi.fn();
    const legacy = vi.spyOn(pool, 'subscribe');
    pool.subscribeToRelays = vi.fn((_urls, _filters, receive) => {
      receive(event); receive('EOSE'); return { unsubscribe };
    });
    f.query();
    await vi.waitFor(() => expect(f.results()).toHaveLength(1));
    expect(pool.subscribeToRelays).toHaveBeenCalledWith(['wss://approved.example'], [{ kinds: [1] }], expect.any(Function));
    expect(legacy).not.toHaveBeenCalled();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
    expect(f.results()[0]).toMatchObject({ events: [{ event, sidecar: { relayHints: ['wss://approved.example'] } }] });
  });

  it('aborts the fallback query on revocation and ignores late transport callbacks', async () => {
    const f = await fixture();
    const pool = f.ctx.hooks.relayPool!;
    pool.isAvailable = () => true;
    pool.selectRelayTier = () => ['wss://approved.example'];
    const unsubscribe = vi.fn();
    let receive!: (item: NostrEvent | 'EOSE') => void;
    pool.subscribeToRelays = vi.fn((_urls, _filters, callback) => {
      receive = callback; return { unsubscribe };
    });
    f.query();
    await vi.waitFor(() => expect(receive).toBeTypeOf('function'));
    receive(event);
    f.runtime.permissions!.revoke(f.runtime.permissions!.grants.find((grant) => grant.permission.category === 'network')!.id);
    await vi.waitFor(() => expect(f.results()).toEqual([{ type: 'relay.query.result', id: 'query', error: expect.any(String) }]));
    expect(unsubscribe).toHaveBeenCalledTimes(1);
    receive(event); receive('EOSE');
    expect(f.results()).toHaveLength(1);
  });

  it('denies fallback transport before execution and rejects legacy adapters with one diagnostic', async () => {
    const f = await fixture({ prompt: async ({ missing }) => ({ effect: missing.some((p) => p.category === 'network') ? 'deny' : 'allow', lifetime: 'session' }) });
    const pool = f.ctx.hooks.relayPool!;
    pool.isAvailable = () => true;
    pool.selectRelayTier = () => ['wss://approved.example'];
    const subscribe = vi.spyOn(pool, 'subscribeToRelays');
    f.query('denied');
    await vi.waitFor(() => expect(f.results()).toHaveLength(1));
    expect(subscribe).not.toHaveBeenCalled();
    pool.subscribeToRelays = undefined;
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});
    f.query('legacy-one'); f.query('legacy-two');
    await vi.waitFor(() => expect(f.results()).toHaveLength(3));
    expect(warning.mock.calls).toEqual([['FW-RELAY-ADAPTER-LEGACY-001: relay adapter must implement subscribeToRelays/publishToRelays; legacy adapter was denied (warns once per adapter instance).']]);
  });

  it('rejects legacy services with one diagnostic and no transport', async () => {
    const f = await fixture();
    const handleMessage = vi.fn();
    f.runtime.registerService('relay', { descriptor: { name: 'relay', version: '1' }, handleMessage });
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});
    f.query('one'); f.query('two');
    await vi.waitFor(() => expect(f.results()).toHaveLength(2));
    expect(handleMessage).not.toHaveBeenCalled();
    expect(warning.mock.calls).toEqual([['FW-RELAY-SERVICE-LEGACY-001: relay service must implement planRelayOperation and executeRelayOperation; legacy service was denied (warns once per service instance).']]);
  });

  it('charges one operation for a query even when it reads only local shell events', async () => {
    const onRateLimit = vi.fn();
    const base = defaultRateLimitConfig();
    const f = await fixture({ onRateLimit, rateLimit: { ...base, burst: { ...base.burst, maxOperations: 2 } } });
    for (let i = 0; i < 3; i++) f.runtime.handleMessage('window', { type: 'relay.query', id: `local-${i}`, filters: [{ kinds: [29000] }] });
    await vi.waitFor(() => expect(f.results()).toHaveLength(3));
    expect(f.results().filter((result) => 'events' in result)).toHaveLength(2);
    expect(onRateLimit).toHaveBeenCalledTimes(1);
    expect(onRateLimit).toHaveBeenCalledWith({ windowId: 'window', operation: 'relay.query', action: 'block', reason: 'burst-exceeded' });
  });

  it('does not deliver a retired query into a replacement source', async () => {
    const f = await fixture();
    const service = plannedService();
    f.runtime.registerService('relay', service.service);
    f.query();
    await vi.waitFor(() => expect(service.execute).toHaveBeenCalledTimes(1));
    f.runtime.sessionRegistry.register('window', { ...f.entry });
    service.event(); service.eose();
    await Promise.resolve();
    expect(service.signal().aborted).toBe(true);
    expect(f.results()).toEqual([]);
  });
});
