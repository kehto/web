import { describe, expect, it, vi } from 'vitest';
import { finalizeEvent, getPublicKey } from 'nostr-tools/pure';
import { createRelayPoolOutboxRouter, type RelayListEntry } from './relay-pool-outbox-router.js';
import { createOutboxService } from './outbox-service.js';
import type { NappletMessage } from '@napplet/core';
import type { ServiceRuntimeContext } from '@kehto/runtime';

const secret = Uint8Array.from([...Array(31).fill(0), 7]);
const recipient = getPublicKey(Uint8Array.from([...Array(31).fill(0), 9]));
const template = { kind: 1, content: 'complete approved fanout', tags: [['p', recipient]], created_at: 1 };
const signed = finalizeEvent(template, secret);
const own = 'wss://own.example';
const inbox = 'wss://inbox.example';
const hint = 'wss://hint.example';
const fallback = 'wss://fallback.example';

function fixture(options: { missingOwn?: boolean; missingInbox?: boolean; denyInbox?: boolean } = {}) {
  const lists = new Map<string, RelayListEntry>();
  if (!options.missingOwn) lists.set(signed.pubkey, { read: [], write: [own] });
  if (!options.missingInbox) lists.set(recipient, { read: [inbox], write: [] });
  const signEvent = vi.fn(async () => signed);
  const publish = vi.fn(async () => ({ [own]: true, [inbox]: true, [hint]: true, [fallback]: true }));
  const router = createRelayPoolOutboxRouter({
    relayPool: { subscribe: vi.fn(), publish, isAvailable: () => true },
    fallbackRelays: [fallback], loadRelayLists: () => lists,
    getSignerPubkey: () => signed.pubkey, signEvent,
    ...(options.denyInbox ? { isRelayAllowed: (url: string) => url !== inbox } : {}),
  });
  return { router, signEvent, publish, lists };
}

describe('NAP-OUTBOX complete immutable publish fanout', () => {
  it('keeps required targets host-owned and detached while approval waits', async () => {
    const f = fixture();
    const plan = { relays: [own, inbox, hint], requiredRelays: [own, inbox], source: 'policy' as const, author: signed.pubkey };
    const planning = vi.spyOn(f.router, 'planPublish').mockResolvedValue(plan);
    f.publish.mockResolvedValue({ [own]: true, [inbox]: false, [hint]: true, [fallback]: true });
    let approve!: () => void;
    const gate = new Promise<void>((resolve) => { approve = resolve; });
    let authorizationCount = 0;
    const authorizeOperation: NonNullable<ServiceRuntimeContext['authorizeOperation']> = async (_window, _operation, _requirements, execute) => {
      authorizationCount++;
      await gate;
      return { status: 'executed', value: await execute(new AbortController().signal) };
    };
    const service = createOutboxService({ router: f.router });
    service.onRegistered?.({ authorizeOperation,
      resolveDTag: () => undefined, listWindowIds: () => [], hasCapability: () => false, sendToEligibleNapplet: () => false });
    const send = vi.fn();
    service.handleMessage('window', { type: 'outbox.publish', id: 'held', event: template,
      options: { toInboxes: [recipient], relays: [hint], requiredRelays: [hint], author: recipient },
    } as NappletMessage, send);
    await vi.waitFor(() => expect(authorizationCount).toBe(1));
    expect(planning).toHaveBeenCalledWith({ toInboxes: [recipient], relays: [hint] });
    plan.requiredRelays[1] = hint;
    approve();
    await vi.waitFor(() => expect(send).toHaveBeenCalledTimes(1));
    // A required inbox that did not accept is a relay outcome, not a denial:
    // NAP-OUTBOX draft napplet/naps#32 `8865f73d` Error Handling has no
    // "relay refused" code, so the closest network code applies (kehto/web#467).
    expect(send).toHaveBeenCalledWith(expect.objectContaining({ ok: false, error: 'relay timeout' }));
    expect(f.publish).toHaveBeenCalledWith(signed, [own, inbox, hint]);
  });

  it('rejects old required-fanout plans lacking required target metadata before authorization or transport', async () => {
    const f = fixture();
    vi.spyOn(f.router, 'planPublish').mockResolvedValue({ relays: [hint], source: 'policy' });
    const service = createOutboxService({ router: f.router });
    const authorizeOperation = vi.fn(async () => ({ status: 'denied' as const }));
    const context: ServiceRuntimeContext = { authorizeOperation,
      resolveDTag: () => undefined, listWindowIds: () => [], hasCapability: () => false, sendToEligibleNapplet: () => false };
    service.onRegistered?.(context);
    const send = vi.fn();
    service.handleMessage('window', { type: 'outbox.publish', id: 'incomplete', event: template,
      options: { relays: [hint], toInboxes: [recipient] } } as NappletMessage, send);
    await vi.waitFor(() => expect(send).toHaveBeenCalledTimes(1));
    expect(send).toHaveBeenCalledWith(expect.objectContaining({ ok: false, error: expect.stringContaining('required relay destinations') }));
    expect(authorizeOperation).not.toHaveBeenCalled();
    expect(f.signEvent).not.toHaveBeenCalled();
    expect(f.publish).not.toHaveBeenCalled();
  });

  it('keeps trusted two-argument host calls valid when no required-fanout intent is available', async () => {
    const f = fixture();
    expect((await f.router.publishWithPlan!(template, { relays: [hint], source: 'policy', author: signed.pubkey })).ok).toBe(true);
    expect(f.publish).toHaveBeenCalledWith(signed, [hint]);
  });

  it('plans own outbox, required inbox and validated hint before signing', async () => {
    const f = fixture();
    const plan = await f.router.planPublish!({ toInboxes: [recipient], relays: [hint] });
    expect(plan.relays).toEqual([own, inbox, hint]);
    expect(plan.requiredRelays).toEqual([own, inbox]);
    expect(f.signEvent).not.toHaveBeenCalled();
    expect(f.publish).not.toHaveBeenCalled();
    f.lists.get(recipient)!.read.splice(0, 1, 'wss://unapproved.example');
    expect((await f.router.publishWithPlan!(template, plan, new AbortController().signal)).ok).toBe(true);
    expect(f.publish).toHaveBeenCalledWith(signed, [own, inbox, hint]);
  });

  it('does not let successful explicit fanout hide failure of a required inbox', async () => {
    const f = fixture();
    f.publish.mockResolvedValue({ [own]: true, [inbox]: false, [hint]: true, [fallback]: true });
    const plan = await f.router.planPublish!({ toInboxes: [recipient], relays: [hint] });
    // Network outcome, never a denial (NAP-OUTBOX #32 `8865f73d` Error Handling; kehto/web#467).
    expect(await f.router.publishWithPlan!(template, plan)).toMatchObject({ ok: false, error: 'relay timeout' });
  });

  it.each([{ missingInbox: true }, { denyInbox: true }])('fails required inbox planning before signing for %j', async (options) => {
    const f = fixture(options);
    await expect(f.router.planPublish!({ toInboxes: [recipient], relays: [hint] })).rejects.toThrow();
    expect(f.signEvent).not.toHaveBeenCalled();
    expect(f.publish).not.toHaveBeenCalled();
  });

  it('honors toOutbox false and does not replace required inboxes with fallback', async () => {
    const f = fixture({ missingOwn: true });
    const plan = await f.router.planPublish!({ toOutbox: false, toInboxes: [recipient], relays: [hint] });
    expect(plan.relays).toEqual([inbox, hint]);
    expect(plan.requiredRelays).toEqual([inbox]);
    expect((await f.router.publishWithPlan!(template, plan)).ok).toBe(true);
  });

  it('uses host fallback for a missing own write list and honors pre-sign cancellation', async () => {
    const f = fixture({ missingOwn: true });
    const plan = await f.router.planPublish!({ relays: [hint] });
    expect(plan.relays).toEqual([fallback, hint]);
    expect(plan.requiredRelays).toEqual([fallback]);
    const controller = new AbortController();
    controller.abort();
    expect(await f.router.publishWithPlan!(template, plan, controller.signal)).toEqual({ ok: false, error: 'policy denied' });
    expect(f.signEvent).not.toHaveBeenCalled();
    expect(f.publish).not.toHaveBeenCalled();
  });
});

describe('NAP-OUTBOX publish planning reasons through the approved service path', () => {
  function serve(f: ReturnType<typeof fixture>, authorize: unknown) {
    const authorizeOperation = authorize as NonNullable<ServiceRuntimeContext['authorizeOperation']>;
    const service = createOutboxService({ router: f.router });
    service.onRegistered?.({ authorizeOperation,
      resolveDTag: () => undefined, listWindowIds: () => [], hasCapability: () => false, sendToEligibleNapplet: () => false });
    const send = vi.fn();
    return { service, send };
  }
  const run: NonNullable<ServiceRuntimeContext['authorizeOperation']> = async (_w, _o, _r, execute) =>
    ({ status: 'executed', value: await execute(new AbortController().signal) });

  // NAP-OUTBOX #32 `8865f73d` Error Handling: a recipient's relays refused by
  // shell relay policy is `policy denied`; a missing relay list is a network
  // outcome (`relay list unavailable`), per kehto/web#467.
  it.each([
    [{ denyInbox: true }, 'policy denied'],
    [{ missingInbox: true }, 'relay list unavailable'],
  ] as const)('reports %j toInboxes planning as %s before approval or signing', async (options, error) => {
    const f = fixture(options);
    const authorizeOperation = vi.fn(run);
    const { service, send } = serve(f, authorizeOperation);
    service.handleMessage('window', { type: 'outbox.publish', id: 'p', event: template,
      options: { toInboxes: [recipient] } } as NappletMessage, send);
    await vi.waitFor(() => expect(send).toHaveBeenCalledTimes(1));
    expect(send).toHaveBeenCalledWith(expect.objectContaining({ ok: false, error }));
    expect(authorizeOperation).not.toHaveBeenCalled();
    expect(f.signEvent).not.toHaveBeenCalled();
    expect(f.publish).not.toHaveBeenCalled();
  });

  it('resolves toInboxes recipients into the approved network requirements (kehto/web#470)', async () => {
    const f = fixture();
    const authorizeOperation = vi.fn(run);
    const { service, send } = serve(f, authorizeOperation);
    service.handleMessage('window', { type: 'outbox.publish', id: 'p', event: template,
      options: { toInboxes: [recipient] } } as NappletMessage, send);
    await vi.waitFor(() => expect(send).toHaveBeenCalledTimes(1));
    const requirements = authorizeOperation.mock.calls[0][2] as readonly { category: string; scope: { value: string } }[];
    const origins = requirements.filter((item) => item.category === 'network').map((item) => item.scope.value);
    expect(origins).toEqual([own, inbox]);
    expect(f.publish).toHaveBeenCalledWith(signed, [own, inbox]);
    expect(send).toHaveBeenCalledWith(expect.objectContaining({ ok: true }));
  });

  it('reports a plan naming an unusable relay URL as relay list unavailable, without approval', async () => {
    const f = fixture();
    vi.spyOn(f.router, 'planPublish').mockResolvedValue({ relays: ['https://not-a-relay.example'],
      requiredRelays: ['https://not-a-relay.example'], source: 'policy', author: signed.pubkey });
    const authorizeOperation = vi.fn(run);
    const { service, send } = serve(f, authorizeOperation);
    service.handleMessage('window', { type: 'outbox.publish', id: 'p', event: template } as NappletMessage, send);
    await vi.waitFor(() => expect(send).toHaveBeenCalledTimes(1));
    expect(send).toHaveBeenCalledWith(expect.objectContaining({ ok: false, error: 'relay list unavailable' }));
    expect(authorizeOperation).not.toHaveBeenCalled();
    expect(f.signEvent).not.toHaveBeenCalled();
  });

  it('threads the approval signal so cancellation during signing stops transport', async () => {
    const f = fixture();
    const controller = new AbortController();
    f.signEvent.mockImplementation(async () => { controller.abort(); return signed; });
    const cancelling: NonNullable<ServiceRuntimeContext['authorizeOperation']> = async (_w, _o, _r, execute) =>
      ({ status: 'executed', value: await execute(controller.signal) });
    const { service, send } = serve(f, cancelling);
    service.handleMessage('window', { type: 'outbox.publish', id: 'p', event: template } as NappletMessage, send);
    await vi.waitFor(() => expect(send).toHaveBeenCalledTimes(1));
    expect(send).toHaveBeenCalledWith(expect.objectContaining({ ok: false, error: 'policy denied' }));
    expect(f.signEvent).toHaveBeenCalledTimes(1);
    expect(f.publish).not.toHaveBeenCalled();
  });
});
