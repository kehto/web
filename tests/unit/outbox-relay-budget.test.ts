/**
 * kehto/web#455: large outbox plans stay approvable within the Firewall's
 * requirement cap, and are never reported as a denial.
 *
 * Authority: NAP-OUTBOX draft napplet/naps#32 at
 * `8865f73d52a4864afee145f28d26520476273927`.
 * - Shell Behavior: "The shell MAY use NIP-66 or other relay intelligence to
 *   choose among candidate relays."
 * - Security Considerations: "Unbounded author sets, missing limits, and broad
 *   subscriptions can exhaust shell and relay resources. Shells SHOULD enforce
 *   limits, timeouts, and maximum subscription counts."
 * - Error Handling: "If the shell returns partial results because some relay
 *   lists or relay connections failed, it SHOULD set `incomplete: true`".
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { finalizeEvent } from 'nostr-tools/pure';
import type { NappletMessage, NostrEvent, NostrFilter } from '@napplet/core';
import { MAX_PERMISSION_REQUIREMENTS } from '../../packages/firewall/src/index.js';
import { createRuntime } from '../../packages/runtime/src/runtime.js';
import { createMockRuntimeAdapter, createNip5dSessionEntry } from '../../packages/runtime/src/test-utils.js';
import type { ApprovalAnswer, ApprovalPrompt } from '../../packages/runtime/src/approval-coordinator.js';
import { createOutboxService } from '../../packages/services/src/outbox-service.js';
import { createRelayPoolOutboxRouter } from '../../packages/services/src/relay-pool-outbox-router.js';
import type { RelayListEntry } from '../../packages/services/src/relay-pool-outbox-types.js';

const secret = Uint8Array.from([...Array(31).fill(0), 9]);
const signed = finalizeEvent({ kind: 1, created_at: 1, tags: [], content: 'budget' }, secret);
const BUDGET = MAX_PERMISSION_REQUIREMENTS - 1;
const cleanups: Array<() => void> = [];
afterEach(() => { cleanups.splice(0).forEach((cleanup) => cleanup()); });

const author = (index: number): string => index.toString(16).padStart(64, '0');
const origin = (url: string): string => new URL(url).origin;

interface Harness {
  readonly messages: () => NappletMessage[];
  readonly subscribedRelays: () => string[];
  readonly publish: ReturnType<typeof vi.fn>;
  readonly signEvent: ReturnType<typeof vi.fn>;
  readonly prompt: ReturnType<typeof vi.fn>;
  send(message: Record<string, unknown>): void;
}

async function harness(lists: Map<string, RelayListEntry>, options: {
  readonly decision?: 'allow' | 'ask';
  readonly isRelayAllowed?: (url: string) => boolean;
} = {}): Promise<Harness> {
  const prompt = vi.fn(async (_prompt: ApprovalPrompt): Promise<ApprovalAnswer> => ({ effect: 'allow', lifetime: 'session' }));
  const decision = options.decision ?? 'allow';
  const ctx = createMockRuntimeAdapter({ permissions: {
    now: Date.now, prompt, createCancellation: () => new AbortController(),
    defaultDecision: (_request, missing) => decision === 'allow' || missing.every((item) => item.category === 'interface') ? 'allow' : 'ask',
    schedule: (callback, delay) => { const timer = setTimeout(callback, delay); return () => clearTimeout(timer); },
  } });
  const runtime = createRuntime(ctx.hooks);
  cleanups.push(() => runtime.destroy());
  const relays: string[] = [];
  const subscribe = vi.fn((_filters: NostrFilter[], urls: string[], callback: (item: NostrEvent | 'EOSE') => void) => {
    relays.push(...urls);
    queueMicrotask(() => callback('EOSE'));
    return { unsubscribe: vi.fn() };
  });
  const publish = vi.fn(async (_event: NostrEvent, urls: string[]) => Object.fromEntries(urls.map((url) => [url, true])));
  const signEvent = vi.fn(async () => signed);
  const router = createRelayPoolOutboxRouter({
    relayPool: { subscribe, publish, isAvailable: () => true },
    fallbackRelays: [], loadRelayLists: () => lists,
    getSignerPubkey: () => signed.pubkey, signEvent,
    ...(options.isRelayAllowed ? { isRelayAllowed: options.isRelayAllowed } : {}),
  });
  runtime.registerService('outbox', createOutboxService({ router }));
  runtime.sessionRegistry.register('window', { ...createNip5dSessionEntry('window', 'app', 'b'.repeat(64)),
    permissionPrincipal: { kind: 'development', target: 'http://localhost:5173', artifactHash: 'b'.repeat(64) } });
  await runtime.permissions!.admit('window', { required: ['outbox'], optional: [], available: ['outbox'] });
  return {
    messages: () => ctx.sent.map((entry) => entry.message as NappletMessage),
    subscribedRelays: () => [...relays],
    publish, signEvent, prompt,
    send: (message) => runtime.handleMessage('window', message as NappletMessage),
  };
}

const messages = (h: Harness): NappletMessage[] => h.messages();

/** `count` authors, each writing only to its own relay. */
function distinctRelays(count: number, extra: (index: number) => string[] = () => []): Map<string, RelayListEntry> {
  return new Map(Array.from({ length: count }, (_, index) => [author(index), { read: [], write: [`wss://r${index}.example`, ...extra(index)] }]));
}

const timeline = (count: number) => [{ kinds: [1, 1111], authors: Array.from({ length: count }, (_, index) => author(index)), limit: 50 }];

describe('outbox read plans larger than the Firewall requirement cap (#455)', () => {
  it('opens a 200-relay subscription under a default allow instead of denying it', async () => {
    const h = await harness(distinctRelays(200));
    h.send({ type: 'outbox.subscribe', id: 's', subId: 'timeline', filters: timeline(200) });
    await vi.waitFor(() => expect(h.subscribedRelays().length).toBeGreaterThan(0));
    expect(messages(h).filter((message) => message.type === 'outbox.closed')).toEqual([]);
    const origins = new Set(h.subscribedRelays().map(origin));
    expect(origins.size).toBe(BUDGET);
  });

  it('answers a 200-relay query as incomplete, never as policy denied', async () => {
    const h = await harness(distinctRelays(200));
    h.send({ type: 'outbox.query', id: 'q', filters: timeline(200) });
    await vi.waitFor(() => expect(messages(h).some((message) => message.type === 'outbox.query.result')).toBe(true));
    const result = messages(h).find((message) => message.type === 'outbox.query.result') as NappletMessage & Record<string, unknown>;
    expect(result.error).toBeUndefined();
    expect(result.incomplete).toBe(true);
    expect(new Set(h.subscribedRelays().map(origin)).size).toBe(BUDGET);
  });

  it('keeps every author covered by choosing relays by author coverage', async () => {
    // Every author also writes to one shared relay, listed last.
    const h = await harness(distinctRelays(200, () => ['wss://shared.example']));
    h.send({ type: 'outbox.query', id: 'q', filters: timeline(200) });
    await vi.waitFor(() => expect(messages(h).some((message) => message.type === 'outbox.query.result')).toBe(true));
    expect(h.subscribedRelays()[0]).toBe('wss://shared.example');
    expect(new Set(h.subscribedRelays().map(origin)).size).toBe(BUDGET);
    // The shared relay reaches every author, so trimming redundant relays is not partial.
    expect(messages(h).find((message) => message.type === 'outbox.query.result')).not.toHaveProperty('incomplete');
  });

  it('chooses the same relays for the same timeline, so a reload does not prompt again', async () => {
    const first = await harness(distinctRelays(200));
    first.send({ type: 'outbox.query', id: 'q', filters: timeline(200) });
    const second = await harness(distinctRelays(200));
    second.send({ type: 'outbox.query', id: 'q', filters: timeline(200) });
    await vi.waitFor(() => expect(messages(second).some((message) => message.type === 'outbox.query.result')).toBe(true));
    await vi.waitFor(() => expect(messages(first).some((message) => message.type === 'outbox.query.result')).toBe(true));
    expect(second.subscribedRelays()).toEqual(first.subscribedRelays());
  });

  it('drops napplet relay hints before host-planned NIP-65 relays', async () => {
    const h = await harness(distinctRelays(BUDGET));
    const hints = Array.from({ length: 20 }, (_, index) => `wss://hint${index}.example`);
    h.send({ type: 'outbox.query', id: 'q', filters: timeline(BUDGET), options: { relays: hints } });
    await vi.waitFor(() => expect(messages(h).some((message) => message.type === 'outbox.query.result')).toBe(true));
    expect(h.subscribedRelays().some((url) => url.startsWith('wss://hint'))).toBe(false);
    expect(new Set(h.subscribedRelays().map(origin)).size).toBe(BUDGET);
  });

  it('counts one requirement per origin, not per relay URL', async () => {
    const lists = new Map(Array.from({ length: 200 }, (_, index) => [author(index), { read: [], write: [`wss://same.example/r${index}`] }]));
    const h = await harness(lists, { decision: 'ask' });
    h.send({ type: 'outbox.subscribe', id: 's', subId: 'paths', filters: timeline(200) });
    await vi.waitFor(() => expect(h.subscribedRelays()).toHaveLength(200));
    const network = h.prompt.mock.calls.flatMap(([call]) => call.missing).filter((item) => item.category === 'network');
    expect(network).toEqual([{ category: 'network', domain: 'outbox', operation: 'outbox.subscribe', scope: { kind: 'origin', value: 'wss://same.example' } }]);
  });

  it('asks once, for at most the budget of exact origins, when no rule allows the plan', async () => {
    const h = await harness(distinctRelays(300), { decision: 'ask' });
    h.send({ type: 'outbox.subscribe', id: 's', subId: 'timeline', filters: timeline(300) });
    await vi.waitFor(() => expect(h.subscribedRelays().length).toBeGreaterThan(0));
    const networkPrompts = h.prompt.mock.calls.filter(([call]) => call.missing.some((item) => item.category === 'network'));
    expect(networkPrompts).toHaveLength(1);
    const shown = networkPrompts[0]![0].missing.filter((item) => item.category === 'network').map((item) => item.scope.value);
    expect(shown).toHaveLength(BUDGET);
    // Only approved origins are contacted.
    expect(new Set(h.subscribedRelays().map(origin))).toEqual(new Set(shown));
  });
});

describe('unusable relay URLs in a plan (#455)', () => {
  const permissive = (): boolean => true;
  const withBad = () => new Map([
    [author(1), { read: [], write: ['wss://good.example', 'not a relay url'] }],
    [author(2), { read: [], write: ['https://wrong-scheme.example', 'wss://also-good.example'] }],
  ]);

  it('skips them and still opens the subscription on the usable relays', async () => {
    const h = await harness(withBad(), { isRelayAllowed: permissive });
    h.send({ type: 'outbox.subscribe', id: 's', subId: 'mixed', filters: [{ kinds: [1], authors: [author(1), author(2)] }] });
    await vi.waitFor(() => expect(h.subscribedRelays()).toHaveLength(2));
    expect(h.subscribedRelays()).toEqual(['wss://good.example', 'wss://also-good.example']);
    expect(messages(h).filter((message) => message.type === 'outbox.closed')).toEqual([]);
  });

  it('is complete when every author keeps a usable relay', async () => {
    const h = await harness(withBad(), { isRelayAllowed: permissive });
    h.send({ type: 'outbox.query', id: 'q', filters: [{ kinds: [1], authors: [author(1), author(2)] }] });
    await vi.waitFor(() => expect(messages(h).some((message) => message.type === 'outbox.query.result')).toBe(true));
    expect(messages(h).find((message) => message.type === 'outbox.query.result')).toEqual({ type: 'outbox.query.result', id: 'q', events: [] });
  });

  it('reports a query as incomplete when skipping unusable URLs leaves an author without relays', async () => {
    const lists = withBad();
    lists.set(author(3), { read: [], write: ['wss://bad host.example'] });
    const h = await harness(lists, { isRelayAllowed: permissive });
    h.send({ type: 'outbox.query', id: 'q', filters: [{ kinds: [1], authors: [author(1), author(2), author(3)] }] });
    await vi.waitFor(() => expect(messages(h).some((message) => message.type === 'outbox.query.result')).toBe(true));
    expect(messages(h).find((message) => message.type === 'outbox.query.result')).toMatchObject({ events: [], incomplete: true });
    expect(messages(h).find((message) => message.type === 'outbox.query.result')).not.toHaveProperty('error');
  });

  it('is still relay list unavailable when no planned relay is usable', async () => {
    const h = await harness(new Map([[author(1), { read: [], write: ['not a relay url'] }]]), { isRelayAllowed: permissive });
    h.send({ type: 'outbox.query', id: 'q', filters: [{ kinds: [1], authors: [author(1)] }] });
    await vi.waitFor(() => expect(messages(h).some((message) => message.type === 'outbox.query.result')).toBe(true));
    expect(messages(h).find((message) => message.type === 'outbox.query.result')).toMatchObject({ error: 'relay list unavailable', incomplete: true });
  });
});

describe('outbox publish plans larger than the Firewall requirement cap (#455)', () => {
  it('fails before signing with a non-denial reason when required inboxes exceed the cap', async () => {
    const lists = new Map(Array.from({ length: 200 }, (_, index) => [author(index), { read: [`wss://inbox${index}.example`], write: [] }]));
    lists.set(signed.pubkey, { read: [], write: ['wss://own.example'] });
    const h = await harness(lists);
    h.send({ type: 'outbox.publish', id: 'p', event: { kind: 1, created_at: 1, tags: [], content: 'budget' },
      options: { toInboxes: Array.from({ length: 200 }, (_, index) => author(index)) } });
    await vi.waitFor(() => expect(messages(h).some((message) => message.type === 'outbox.publish.result')).toBe(true));
    expect(messages(h).find((message) => message.type === 'outbox.publish.result')).toMatchObject({ ok: false, error: 'too many relays' });
    expect(h.signEvent).not.toHaveBeenCalled();
    expect(h.publish).not.toHaveBeenCalled();
  });

  it('keeps every required relay and trims only best-effort explicit relays', async () => {
    const h = await harness(new Map([[signed.pubkey, { read: [], write: ['wss://own.example'] }]]));
    const extras = Array.from({ length: 200 }, (_, index) => `wss://extra${index}.example`);
    h.send({ type: 'outbox.publish', id: 'p', event: { kind: 1, created_at: 1, tags: [], content: 'budget' }, options: { relays: extras } });
    await vi.waitFor(() => expect(messages(h).some((message) => message.type === 'outbox.publish.result')).toBe(true));
    expect(messages(h).find((message) => message.type === 'outbox.publish.result')).toMatchObject({ ok: true });
    const targets = h.publish.mock.calls[0]![1] as string[];
    expect(targets[0]).toBe('wss://own.example');
    expect(new Set(targets.map(origin)).size).toBe(BUDGET);
  });
});
