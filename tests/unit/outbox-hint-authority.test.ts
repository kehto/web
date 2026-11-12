import { afterEach, describe, expect, it, vi } from 'vitest';
import { finalizeEvent } from 'nostr-tools/pure';
import type { NappletMessage, NostrEvent, NostrFilter } from '@napplet/core';
import { createRuntime } from '../../packages/runtime/src/runtime.js';
import { createMockRuntimeAdapter, createNip5dSessionEntry } from '../../packages/runtime/src/test-utils.js';
import { createOutboxService } from '../../packages/services/src/outbox-service.js';
import { createRelayPoolOutboxRouter } from '../../packages/services/src/relay-pool-outbox-router.js';
import type { ApprovalAnswer, ApprovalPrompt } from '../../packages/runtime/src/approval-coordinator.js';

const secret = Uint8Array.from([...Array(31).fill(0), 7]);
const event = finalizeEvent({ kind: 1, created_at: 1, tags: [], content: 'authorized relay hint' }, secret);
const hint = 'wss://hint.example/group';
const cleanups: Array<() => void> = [];
afterEach(() => { cleanups.splice(0).forEach((cleanup) => cleanup()); });

describe.each(['getEvent', 'query', 'subscribe', 'publish'] as const)('outbox.%s hint approval', (operation) => {
  it.each(['allow', 'deny'] as const)('%s encloses the real hinted transport and signer', async (effect) => {
    let answer!: (answer: ApprovalAnswer) => void;
    const prompt = vi.fn(({ missing }: ApprovalPrompt): Promise<ApprovalAnswer> => missing.some((item) => item.category === 'network')
      ? new Promise((resolve) => { answer = resolve; }) : Promise.resolve({ effect: 'allow', lifetime: 'session' }));
    const ctx = createMockRuntimeAdapter({ permissions: {
      now: Date.now, prompt, createCancellation: () => new AbortController(),
      schedule: (callback, delay) => { const timer = setTimeout(callback, delay); return () => clearTimeout(timer); },
    } });
    const runtime = createRuntime(ctx.hooks);
    cleanups.push(() => runtime.destroy());
    const subscribe = vi.fn((_filters: NostrFilter[], _relays: string[], callback: (item: NostrEvent | 'EOSE') => void) => {
      queueMicrotask(() => callback('EOSE'));
      return { unsubscribe: vi.fn() };
    });
    const publish = vi.fn(async () => undefined);
    const signEvent = vi.fn(async () => event);
    const router = createRelayPoolOutboxRouter({ relayPool: { subscribe, publish, isAvailable: () => true },
      fallbackRelays: [], loadRelayLists: () => new Map(), getSignerPubkey: () => event.pubkey, signEvent });
    runtime.registerService('outbox', createOutboxService({ router }));
    runtime.sessionRegistry.register('window', { ...createNip5dSessionEntry('window', 'app', 'a'.repeat(64)),
      permissionPrincipal: { kind: 'development', target: 'http://localhost:5173', artifactHash: 'a'.repeat(64) } });
    await runtime.permissions!.admit('window', { required: ['outbox'], optional: [], available: ['outbox'] });
    runtime.handleMessage('window', { type: `outbox.${operation}`, id: 'request', subId: 'stream',
      eventId: event.id, filters: [{ kinds: [1] }], event: { kind: 1, created_at: 1, tags: [], content: event.content },
      options: { relays: [hint], toOutbox: false },
    } as NappletMessage);
    await vi.waitFor(() => expect(answer).toBeTypeOf('function'));
    expect(prompt.mock.calls.at(-1)![0].missing).toContainEqual({ category: 'network', domain: 'outbox',
      operation: `outbox.${operation}`, scope: { kind: 'origin', value: 'wss://hint.example' } });
    expect(subscribe).not.toHaveBeenCalled();
    expect(publish).not.toHaveBeenCalled();
    expect(signEvent).not.toHaveBeenCalled();
    answer({ effect, lifetime: 'session' });
    if (effect === 'deny') {
      await vi.waitFor(() => expect(ctx.sent).toHaveLength(1));
      expect(ctx.sent[0].message).toMatchObject(operation === 'subscribe'
        ? { type: 'outbox.closed', subId: 'stream', reason: expect.any(String) }
        : { type: `outbox.${operation}.result`, id: 'request', error: expect.any(String) });
      expect(subscribe).not.toHaveBeenCalled();
      expect(publish).not.toHaveBeenCalled();
      expect(signEvent).not.toHaveBeenCalled();
    } else if (operation === 'publish') {
      await vi.waitFor(() => expect(ctx.sent).toHaveLength(1));
      expect(signEvent).toHaveBeenCalledTimes(1);
      expect(publish).toHaveBeenCalledWith(event, [hint]);
    } else {
      await vi.waitFor(() => expect(subscribe).toHaveBeenCalledTimes(1));
      expect(subscribe.mock.calls[0][1]).toEqual([hint]);
      expect(signEvent).not.toHaveBeenCalled();
    }
  });
});
