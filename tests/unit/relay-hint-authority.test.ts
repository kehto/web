import { afterEach, describe, expect, it, vi } from 'vitest';
import type { NappletMessage, NostrEvent, NostrFilter } from '@napplet/core';
import { createRuntime } from '../../packages/runtime/src/runtime.js';
import { createMockRuntimeAdapter, createNip5dSessionEntry } from '../../packages/runtime/src/test-utils.js';
import type { ApprovalAnswer, ApprovalPrompt } from '../../packages/runtime/src/approval-coordinator.js';
import type { RelayOperationPlan, RelayPlanningServiceHandler } from '../../packages/runtime/src/service-types.js';
import { createRelayPoolService } from '../../packages/services/src/relay-pool-service.js';
import { createCoordinatedRelay } from '../../packages/services/src/coordinated-relay.js';

const HINT = 'wss://hint.example/group';
const cleanups: Array<() => void> = [];
afterEach(() => { cleanups.splice(0).forEach((cleanup) => cleanup()); });

async function fixture(kind: 'fallback' | 'pool' | 'coordinated', prompt?: (request: ApprovalPrompt) => Promise<ApprovalAnswer>) {
  const subscribe = vi.fn((_urls: readonly string[], _filters: NostrFilter[], _callback: (item: NostrEvent | 'EOSE') => void) => ({ unsubscribe: vi.fn() }));
  const selectRelayTier = vi.fn(() => ['wss://configured.example']);
  const signEvent = vi.fn();
  const permissionPrompt = prompt && vi.fn(prompt);
  const ctx = createMockRuntimeAdapter({
    ...(permissionPrompt ? { permissions: {
      now: Date.now, prompt: permissionPrompt, createCancellation: () => new AbortController(),
      schedule: (callback, delay) => { const timer = setTimeout(callback, delay); return () => clearTimeout(timer); },
    } } : {}),
    auth: { getUserPubkey: () => 'b'.repeat(64), getSigner: () => ({ signEvent }) },
  });
  const pool = ctx.hooks.relayPool!;
  pool.isAvailable = () => true;
  pool.selectRelayTier = selectRelayTier;
  pool.subscribeToRelays = (urls, filters, callback) => subscribe(urls, filters, callback);
  const servicePool = {
    subscribe: (filters, callback, urls) => subscribe(urls, filters, callback),
    publish: vi.fn(), selectRelayTier, isAvailable: () => true,
  } satisfies Parameters<typeof createRelayPoolService>[0];
  const service = kind === 'pool' ? createRelayPoolService(servicePool)
    : kind === 'coordinated' ? createCoordinatedRelay({ relayPool: servicePool,
      cache: { query: async () => [], store() {}, isAvailable: () => false } }) : undefined;
  const runtime = createRuntime(ctx.hooks);
  cleanups.push(() => runtime.destroy());
  if (service) runtime.registerService('relay', service);
  const entry = { ...createNip5dSessionEntry('window', 'app', 'a'.repeat(64)),
    permissionPrincipal: { kind: 'development' as const, target: 'http://localhost:5173', artifactHash: 'a'.repeat(64) } };
  runtime.sessionRegistry.register('window', entry);
  if (permissionPrompt) await runtime.permissions!.admit('window', { required: ['relay'], optional: [], available: ['relay'] });
  const send = (type: 'relay.subscribe' | 'relay.query', relay = HINT) => runtime.handleMessage('window', {
    type, id: 'request', subId: 'subscription', filters: [{ kinds: [1] }], relay,
  } as NappletMessage);
  return { runtime, ctx, subscribe, selectRelayTier, signEvent, permissionPrompt, send, service, entry };
}

describe.each(['fallback', 'pool', 'coordinated'] as const)('%s relay hint authority', (kind) => {
  it.each(['relay.subscribe', 'relay.query'] as const)('denies %s hints without an operation authority', async (type) => {
    const f = await fixture(kind);
    f.send(type);
    await vi.waitFor(() => expect(f.ctx.sent).toHaveLength(1));
    expect(f.subscribe).not.toHaveBeenCalled();
    expect(f.signEvent).not.toHaveBeenCalled();
    expect(f.ctx.sent[0].message).toMatchObject(type === 'relay.query'
      ? { type: 'relay.query.result', id: 'request', error: expect.any(String) }
      : { type: 'relay.closed', subId: 'subscription', reason: expect.any(String) });
  });

  it.each(['relay.subscribe', 'relay.query'] as const)('presents the exact %s hint origin and denies before I/O', async (type) => {
    const f = await fixture(kind, async ({ missing }) => ({
      effect: missing.some((item) => item.category === 'network') ? 'deny' : 'allow', lifetime: 'session',
    }));
    f.send(type);
    await vi.waitFor(() => expect(f.ctx.sent).toHaveLength(1));
    expect(f.permissionPrompt!.mock.calls.at(-1)![0].missing).toContainEqual({
      category: 'network', domain: 'relay', operation: 'relay.network',
      scope: { kind: 'origin', value: 'wss://hint.example' },
    });
    expect(f.subscribe).not.toHaveBeenCalled();
    expect(f.signEvent).not.toHaveBeenCalled();
  });

  it('keeps the approved subscribe destination and filters detached while approval waits', async () => {
    let answer!: (value: ApprovalAnswer) => void;
    const f = await fixture(kind, ({ missing }) => missing.some((item) => item.category === 'network')
      ? new Promise((resolve) => { answer = resolve; }) : Promise.resolve({ effect: 'allow', lifetime: 'session' }));
    const message = { type: 'relay.subscribe', id: 'request', subId: 'subscription', filters: [{ kinds: [1] }], relay: HINT };
    const mutablePlan: RelayOperationPlan = { operation: 'subscribe', relayUrls: [HINT], localOnly: false };
    if (f.service) vi.spyOn(f.service, 'planRelayOperation').mockReturnValue(mutablePlan);
    f.runtime.handleMessage('window', message as NappletMessage);
    await vi.waitFor(() => expect(answer).toBeTypeOf('function'));
    message.relay = 'wss://unapproved.example';
    message.filters[0].kinds[0] = 4;
    (mutablePlan.relayUrls as string[])[0] = 'wss://unapproved.example';
    answer({ effect: 'allow', lifetime: 'session' });
    await vi.waitFor(() => expect(f.subscribe).toHaveBeenCalledTimes(1));
    expect(f.subscribe).toHaveBeenCalledWith([HINT], [{ kinds: [1] }], expect.any(Function));
  });

  it.each(['wss://user:secret@relay.example', 'wss://relay.example:invalid', 'wss://relay.example/#fragment', 'wss://relay.example/#'])('rejects malformed or credential-bearing hint %s before transport', async (hint) => {
    const f = await fixture(kind, async () => ({ effect: 'allow', lifetime: 'session' }));
    f.send('relay.subscribe', hint);
    await vi.waitFor(() => expect(f.ctx.sent).toHaveLength(1));
    expect(f.subscribe).not.toHaveBeenCalled();
    expect(f.permissionPrompt).toHaveBeenCalledTimes(1);
  });

  it('does not execute or reply into a replacement source after an old approval settles', async () => {
    let answer!: (value: ApprovalAnswer) => void;
    const f = await fixture(kind, ({ missing }) => missing.some((item) => item.category === 'network')
      ? new Promise((resolve) => { answer = resolve; }) : Promise.resolve({ effect: 'allow', lifetime: 'session' }));
    f.send('relay.subscribe');
    await vi.waitFor(() => expect(answer).toBeTypeOf('function'));
    f.runtime.sessionRegistry.register('window', { ...f.entry });
    answer({ effect: 'allow', lifetime: 'session' });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(f.subscribe).not.toHaveBeenCalled();
    expect(f.ctx.sent).toEqual([]);
  });

  it('stops hinted subscriptions on origin revocation and ignores late callbacks', async () => {
    const f = await fixture(kind, async () => ({ effect: 'allow', lifetime: 'session' }));
    f.send('relay.subscribe');
    await vi.waitFor(() => expect(f.subscribe).toHaveBeenCalledTimes(1));
    const network = f.runtime.permissions!.grants.find((grant) => grant.permission.category === 'network')!;
    f.runtime.permissions!.revoke(network.id);
    const count = f.ctx.sent.length;
    const receive = f.subscribe.mock.calls[0][2] as (message: 'EOSE') => void;
    receive('EOSE');
    expect(f.subscribe.mock.results[0].value.unsubscribe).toHaveBeenCalledTimes(1);
    expect(f.ctx.sent).toHaveLength(count);
  });
});
