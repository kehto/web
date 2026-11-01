import type { NappletMessage, NostrEvent, NostrFilter } from '@napplet/core';
import type { ServiceHandler } from '@kehto/runtime';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { finalizeEvent, generateSecretKey, getPublicKey } from 'nostr-tools/pure';
import * as nip44 from 'nostr-tools/nip44';
import { createPajaAdapter, type PajaConfirmationRequest } from './browser-adapter.js';
import { createPajaRuntimeHostConfig } from './options.js';
import { normalizePajaSimulation } from './simulation.js';
import { PAJA_DEV_SIGNER_PUBKEY } from './browser-dev-runtime.js';

const network = vi.hoisted(() => ({
  publish: vi.fn<(relays: string[], event: NostrEvent) => Promise<string>[]>(),
  subscriptions: [] as { filters: NostrFilter[]; next: (item: NostrEvent | 'EOSE') => void; closed: boolean }[],
}));
vi.mock('nostr-tools/pool', () => ({
  SimplePool: class {
    publish(relays: string[], event: NostrEvent) { return network.publish(relays, event); }
    destroy() {}
  },
}));
vi.mock('./browser-relay-transport.js', () => ({
  queryPajaLive: async () => [],
  subscribePajaLive: (_pool: unknown, _relays: string[], filters: NostrFilter[], next: (item: NostrEvent | 'EOSE') => void) => {
    const entry = { filters, next, closed: false };
    network.subscriptions.push(entry);
    return { unsubscribe() { entry.closed = true; } };
  },
}));

const RELAYS = ['wss://relay-one.example', 'wss://relay-two.example'];
const template = { kind: 1, content: 'publish proof', tags: [], created_at: 1 };
const adapters: ReturnType<typeof createPajaAdapter>[] = [];

function adapter(confirm: (request: PajaConfirmationRequest) => boolean | Promise<boolean>) {
  const simulation = normalizePajaSimulation({ relay: { mode: 'live', urls: RELAYS }, cvm: { enabled: true } });
  const instance = createPajaAdapter(createPajaRuntimeHostConfig({ simulation }), () => simulation,
    () => {}, () => {}, confirm,
    { getMethod: () => 'dev', getPubkey: () => PAJA_DEV_SIGNER_PUBKEY, getSigner: () => null },
    (windowId) => ({ dTag: windowId ?? 'host', aggregateHash: `artifact-${windowId}` }));
  adapters.push(instance);
  return instance;
}

function send(service: ServiceHandler, windowId: string, message: { type: string; [key: string]: unknown }) {
  const replies: NappletMessage[] = [];
  service.handleMessage(windowId, message as NappletMessage, reply => replies.push(reply));
  return replies;
}

beforeEach(() => {
  network.publish.mockReset().mockImplementation(relays => relays.map(() => Promise.resolve('accepted')));
  network.subscriptions.length = 0;
});
afterEach(() => {
  for (const instance of adapters.splice(0)) {
    for (const service of Object.values(instance.services ?? {})) service.onUnregistered?.();
    (instance.relayPool.getRelayPool() as unknown as { close(): void }).close();
  }
});

// Checked draft NAP-OUTBOX 8865f73d and NAP-CVM 28cf1bdb. Attribution is a
// host-owned implementation detail, never a field trusted from a wire message.
describe('Paja adapter publication authority', () => {
  it('keeps interleaved outbox sources separate and invalidates queued signing on teardown', async () => {
    const requests: PajaConfirmationRequest[] = [];
    const approvals = new Map<string, (approved: boolean) => void>();
    const instance = adapter(request => {
      requests.push(request);
      if (request.action !== 'sign') return true;
      return new Promise(resolve => approvals.set(request.signerContext!.windowId, resolve));
    });
    const outbox = instance.services!.outbox!;
    const publish = (windowId: string) => send(outbox, windowId, {
      type: 'outbox.publish', id: windowId, event: template,
      options: { toOutbox: false, relays: RELAYS },
      signerContext: { windowId: 'forged' },
    });
    const one = publish('one'), two = publish('two');
    approvals.get('two')!(true);
    await vi.waitFor(() => expect(two[0]).toMatchObject({ ok: true }));
    approvals.get('one')!(true);
    await vi.waitFor(() => expect(one[0]).toMatchObject({ ok: true }));
    expect(requests.flatMap(request => request.action === 'publish' ? [request.signerContext?.windowId] : [])).toEqual(['two', 'one']);
    expect(requests.flatMap(request => request.action === 'publish' ? [request.signerContext?.napplet.aggregateHash] : [])).toEqual(['artifact-two', 'artifact-one']);

    const retired = publish('one');
    outbox.onWindowDestroyed?.('one');
    approvals.get('one')!(true);
    await vi.waitFor(() => expect(retired[0]).toMatchObject({ ok: false, error: 'Paja signing source changed' }));
    expect(network.publish).toHaveBeenCalledTimes(2);
    // A new endpoint gets fresh authority, not the retired scope.
    const reloaded = publish('one');
    approvals.get('one')!(true);
    await vi.waitFor(() => expect(reloaded[0]).toMatchObject({ ok: true }));
  });

  it('retains actual relay rejection reasons through outbox results instead of publish denied', async () => {
    network.publish.mockImplementation(relays => relays.map((_, index) => Promise.reject(
      index === 0 ? new Error('auth-required: sign in') : 'rate-limited: retry later',
    )));
    const instance = adapter(() => true);
    const replies = send(instance.services!.outbox!, 'one', {
      type: 'outbox.publish', id: 'failed', event: template, options: { toOutbox: false, relays: RELAYS },
    });
    await vi.waitFor(() => expect(replies[0]).toMatchObject({
      type: 'outbox.publish.result', id: 'failed', ok: false,
      error: `relay publish failed (${RELAYS[0]}: auth-required: sign in; ${RELAYS[1]}: rate-limited: retry later)`,
    }));
  });

  it('keeps transport rejection details in CVM results', async () => {
    network.publish.mockImplementation(relays => relays.map(() => Promise.reject(new Error('blocked: kind 21059'))));
    const instance = adapter(() => true);
    const replies = send(instance.services!.cvm!, 'one', {
      type: 'cvm.request', id: 'failed', server: { pubkey: getPublicKey(generateSecretKey()), relays: RELAYS },
      message: { jsonrpc: '2.0', id: 1, method: 'tools/list' }, options: { timeoutMs: 1000 },
    });
    await vi.waitFor(() => expect(replies[0]).toMatchObject({
      type: 'cvm.request.result', id: 'failed',
      error: `relay publish failed (${RELAYS[0]}: blocked: kind 21059; ${RELAYS[1]}: blocked: kind 21059)`,
    }));
  });

  it('preserves partial-success outcomes and never sends a consent denial to the relay', async () => {
    network.publish.mockImplementation(() => [Promise.resolve('accepted'), Promise.reject(new Error('blocked: policy'))]);
    const instance = adapter(request => request.action !== 'publish' || request.signerContext?.windowId !== 'denied');
    const message = { type: 'outbox.publish', id: 'partial', event: template, options: { toOutbox: false, relays: RELAYS } };
    const partial = send(instance.services!.outbox!, 'allowed', message);
    await vi.waitFor(() => expect(partial[0]).toMatchObject({ ok: true, relays: { [RELAYS[0]!]: true, [RELAYS[1]!]: false } }));
    expect(partial[0]).not.toHaveProperty('error');
    const denied = send(instance.services!.outbox!, 'denied', message);
    await vi.waitFor(() => expect(denied[0]).toMatchObject({ ok: false, error: 'publish denied' }));
    expect(network.publish).toHaveBeenCalledOnce();
  });

  it('scopes encrypted CVM handshakes, concurrent requests and stream pongs to each owning endpoint', async () => {
    const serverKey = generateSecretKey();
    const server = { pubkey: getPublicKey(serverKey), relays: RELAYS };
    const prompts: PajaConfirmationRequest[] = [];
    const instance = adapter(request => { prompts.push(request); return true; });
    const cvm = instance.services!.cvm!;
    const published: { client: string; message: {
      id?: string | number; method?: string;
      params?: { _meta?: { progressToken?: string | number }; cvm?: { frameType?: string; nonce?: string } };
    }; windowId?: string }[] = [];
    function deliver(client: string, message: Record<string, unknown>) {
      const inner = finalizeEvent({ kind: 25910, created_at: Math.floor(Date.now() / 1000), tags: [['p', client]], content: JSON.stringify(message) }, serverKey);
      const wrapKey = generateSecretKey();
      const wrap = finalizeEvent({ kind: 21059, created_at: inner.created_at, tags: [['p', client]], content: nip44.encrypt(JSON.stringify(inner), nip44.getConversationKey(wrapKey, client)) }, wrapKey);
      for (const subscription of network.subscriptions) {
        if (!subscription.closed && subscription.filters.some(filter => filter['#p']?.includes(client))) subscription.next(wrap);
      }
    }
    network.publish.mockImplementation((relays, event) => {
      const inner = JSON.parse(nip44.decrypt(event.content, nip44.getConversationKey(serverKey, event.pubkey))) as NostrEvent;
      const message = JSON.parse(inner.content);
      const prompt = prompts.find(request => request.action === 'publish' && request.event.id === event.id);
      published.push({ client: inner.pubkey, message, windowId: prompt && 'signerContext' in prompt ? prompt.signerContext?.windowId : undefined });
      if (message.method === 'initialize') queueMicrotask(() => deliver(inner.pubkey, { jsonrpc: '2.0', id: message.id,
        result: { protocolVersion: '2025-11-25', capabilities: {}, serverInfo: { name: 'test' } } }));
      return relays.map(() => Promise.resolve('accepted'));
    });
    const request = (windowId: string) => send(cvm, windowId, {
      type: 'cvm.request', id: windowId, server,
      message: { jsonrpc: '2.0', id: 'same-caller-id', method: 'tools/call', params: { name: 'stream' } },
      options: { initialize: true, timeoutMs: 3000 }, sourceWindowId: 'forged',
    });
    const one = request('one'), two = request('two');
    await vi.waitFor(() => expect(published.filter(entry => entry.message.method === 'tools/call')).toHaveLength(2));
    for (const windowId of ['one', 'two']) {
      expect(published.filter(entry => entry.windowId === windowId).map(entry => entry.message.method))
        .toEqual(['initialize', 'notifications/initialized', 'tools/call']);
    }
    const first = published.find(entry => entry.windowId === 'one' && entry.message.method === 'tools/call')!;
    const second = published.find(entry => entry.windowId === 'two' && entry.message.method === 'tools/call')!;
    expect(first.client).not.toBe(second.client);
    function ping(entry: typeof first, nonce: string) {
      deliver(entry.client, { jsonrpc: '2.0', method: 'notifications/progress', params: {
        progressToken: entry.message.params!._meta!.progressToken, progress: 1,
        cvm: { type: 'open-stream', frameType: 'ping', nonce },
      } });
    }
    for (const entry of [first, second]) deliver(entry.client, {
      jsonrpc: '2.0', method: 'notifications/progress', params: {
        progressToken: entry.message.params!._meta!.progressToken, progress: 0,
        cvm: { type: 'open-stream', frameType: 'start' },
      },
    });
    ping(second, 'two-ping');
    ping(first, 'one-ping');
    await vi.waitFor(() => expect(published.filter(entry => entry.message.params?.cvm?.frameType === 'pong')).toHaveLength(2));
    expect(published.filter(entry => entry.message.params?.cvm?.frameType === 'pong').map(entry => [entry.windowId, entry.message.params!.cvm!.nonce]))
      .toEqual([['two', 'two-ping'], ['one', 'one-ping']]);
    cvm.onWindowDestroyed?.('one');
    await vi.waitFor(() => expect(one.some(reply => reply.type === 'cvm.request.result' && 'error' in reply)).toBe(true));
    const count = published.length;
    ping(first, 'retired');
    deliver(second.client, { jsonrpc: '2.0', id: second.message.id, result: { content: [] } });
    await vi.waitFor(() => expect(two).toContainEqual(expect.objectContaining({ type: 'cvm.request.result', id: 'two', message: expect.objectContaining({ id: 'same-caller-id' }) })));
    expect(published).toHaveLength(count);
    expect(prompts.filter(prompt => prompt.action === 'publish')).toHaveLength(8);
    expect(network.subscriptions.filter(subscription => subscription.filters.some(filter => filter['#p']?.includes(first.client))))
      .toSatisfy((subscriptions: typeof network.subscriptions) => subscriptions.length > 0 && subscriptions.every(subscription => subscription.closed));
  });
});
