import { afterEach, describe, expect, it } from 'vitest';
import { finalizeEvent, getPublicKey } from 'nostr-tools';
import type { NappletMessage, NostrEvent } from '@napplet/core';
import { createRuntime, type Runtime, type Signer } from '@kehto/runtime';
import { MOCK_RELAYS, createMockNapEnvironment, type MockClassService } from '@kehto/mocks';
import { createMockRuntimeAdapter, createNip5dSessionEntry } from '../../packages/runtime/src/test-utils.js';

/**
 * Regression for the kehto/web#376 review: mocks must deliver through the real
 * runtime (`Runtime.handleMessage`, `ServiceRuntimeContext.sendToEligibleNapplet`)
 * with its capability checks and subscription scope intact.
 *
 * Spec refs: NAP-RELAY @ napplet/naps PR #2 head 9f30b3505335 (relay.event per
 * matching subscription, `relay` scope); NAP-CLASS @ PR #16 head 4828279800dc
 * (`class.assigned` shell -> napplet, at most once per lifecycle).
 */
const SECRET = Uint8Array.from([...Array(31).fill(0), 7]);
const AUTHOR = getPublicKey(SECRET);
const HASH = 'e'.repeat(64);
const WINDOWS = ['w1', 'w2', 'w3'] as const;
const runtimes: Runtime[] = [];
const flush = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

type Wire = NappletMessage & { subId?: string; id?: string; ok?: boolean; result?: { event: NostrEvent; sidecar?: { relayHints?: string[] } } };

afterEach(() => {
  for (const runtime of runtimes.splice(0)) runtime.destroy();
});

function setup(classExposedTo: (windowId: string) => boolean = () => true) {
  const env = createMockNapEnvironment({ only: ['relay', 'class'], seed: 3 });
  const signer: Signer = { signEvent: async (template) => finalizeEvent(template as Parameters<typeof finalizeEvent>[0], SECRET) };
  const ctx = createMockRuntimeAdapter({
    services: env.services,
    isDomainAllowed: (windowId, domain) => domain !== 'class' || classExposedTo(windowId),
    auth: { getUserPubkey: () => AUTHOR, getSigner: () => signer },
  });
  const runtime = createRuntime(ctx.hooks);
  runtimes.push(runtime);
  for (const windowId of WINDOWS) {
    runtime.sessionRegistry.register(windowId, createNip5dSessionEntry(windowId, `napp-${windowId}`, HASH));
  }
  const envelopes = (type: string) => ctx.sent
    .filter(({ message }) => !Array.isArray(message) && (message as NappletMessage).type === type)
    .map(({ windowId, message }) => ({ windowId, message: message as Wire }));
  const subscribe = (windowId: string, subId: string, relay?: string): void => {
    runtime.handleMessage(windowId, {
      type: 'relay.subscribe', id: `req-${subId}`, subId, filters: [{ kinds: [1], authors: [AUTHOR] }], ...(relay ? { relay } : {}),
    } as NappletMessage);
  };
  const publish = async (windowId: string, id: string, content: string): Promise<void> => {
    // The runtime's replay detector only admits templates stamped within its window.
    runtime.handleMessage(windowId, { type: 'relay.publish', id, event: { kind: 1, content, tags: [], created_at: Math.floor(Date.now() / 1000) } } as NappletMessage);
    await flush();
    await flush();
  };
  return { ...ctx, env, runtime, envelopes, subscribe, publish };
}

describe('@kehto/mocks through the real runtime', () => {
  it('relay: a publish reaches the publisher and every scoped subscriber exactly once, with no buffer copies', async () => {
    const { sent, subscribe, publish, envelopes } = setup();
    subscribe('w1', 'mine');
    subscribe('w2', 'scoped-hit', MOCK_RELAYS.primary);
    subscribe('w3', 'scoped-miss', MOCK_RELAYS.tertiary);
    expect(envelopes('relay.eose').map(({ windowId }) => windowId)).toEqual(['w1', 'w2', 'w3']);
    sent.length = 0;

    await publish('w1', 'p1', 'Netinst image verified.');
    const result = envelopes('relay.publish.result');
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ windowId: 'w1', message: { id: 'p1', ok: true } });
    const published = (result[0]!.message as Wire & { event: NostrEvent }).event;
    expect(published.pubkey).toBe(AUTHOR);

    const events = envelopes('relay.event');
    expect(events.map(({ windowId, message }) => [windowId, message.subId, message.result?.event.id])).toEqual([
      ['w1', 'mine', published.id],
      ['w2', 'scoped-hit', published.id],
    ]);
    expect(events[1]!.message.result?.sidecar).toEqual({ relayHints: [MOCK_RELAYS.primary] });
    expect(sent.filter(({ message }) => Array.isArray(message))).toEqual([]);

    // Late subscriber: one copy from the mock's store, none from the runtime ring buffer.
    sent.length = 0;
    subscribe('w3', 'late');
    expect(sent.map(({ message }) => (message as NappletMessage).type)).toEqual(['relay.event', 'relay.eose']);
    expect(envelopes('relay.event')[0]!.message.result?.event.id).toBe(published.id);
  });

  it('relay: revoking relay:read retires a window from fan-out through the runtime', async () => {
    const { runtime, sent, subscribe, publish, envelopes } = setup();
    subscribe('w1', 'mine');
    subscribe('w2', 'theirs');
    sent.length = 0;

    runtime.aclState.revoke('', 'napp-w2', HASH, 'relay:read');
    expect(envelopes('relay.closed')).toEqual([{ windowId: 'w2', message: { type: 'relay.closed', subId: 'theirs', reason: 'denied: relay:read' } }]);
    sent.length = 0;

    await publish('w1', 'p2', 'After revocation');
    expect(envelopes('relay.event').map(({ windowId, message }) => [windowId, message.subId])).toEqual([['w1', 'mine']]);
    expect(sent.filter(({ windowId }) => windowId === 'w2')).toEqual([]);
  });

  it('class: assign() delivers class.assigned once per exposed window and records nothing when the runtime refuses', () => {
    const { env, runtime, sent } = setup((windowId) => windowId !== 'w2');
    const service = env.get('class') as MockClassService;

    expect(service.assign('w1')).toBe(true);
    expect(sent).toEqual([{ windowId: 'w1', message: { type: 'class.assigned', id: 'c1', class: 1 } }]);
    expect(service.assign('w1', 2)).toBe(false);

    // The shell does not expose `class` to w2: the runtime refuses the push and
    // the mock must not record an assignment or a sent envelope.
    expect(service.assign('w2')).toBe(false);
    expect(service.assign('ghost')).toBe(false);
    expect(service.mock.state().assigned.has('w2')).toBe(false);
    expect(service.mock.sent.map(({ windowId }) => windowId)).toEqual(['w1']);
    expect(sent).toHaveLength(1);

    // A new iframe lifecycle owes a fresh envelope.
    runtime.destroyWindow('w1');
    expect(service.assign('w1', 2)).toBe(true);
    expect(sent.at(-1)).toEqual({ windowId: 'w1', message: { type: 'class.assigned', id: 'c2', class: 2 } });
  });
});
