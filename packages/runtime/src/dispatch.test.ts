/**
 * dispatch.test.ts — Unit tests for @kehto/runtime NIP-5D NAP domain dispatch.
 *
 * Tests NappletMessage envelope dispatch, domain routing, ACL enforcement,
 * and domain handler implementations (relay, identity, storage, inc, …).
 * All tests run in Node.js without browser globals.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createRuntime } from './runtime.js';
import type { Runtime } from './runtime.js';
import { createMockRuntimeAdapter, createNip5dSessionEntry, findEnvelopeResponse } from './test-utils.js';
import type { MockRuntimeContext, SentMessage } from './test-utils.js';
import type { NappletMessage } from '@napplet/core';
import type { RelayPoolAdapter } from './types.js';

// ─── Constants ────────────────────────────────────────────────────────────────

const WINDOW_ID = 'win-test-1';
const WINDOW_ID_2 = 'win-test-2';
const TEST_DTAG = 'test-napp';
const TEST_HASH = 'b'.repeat(64);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeSessionEntry(windowId: string = WINDOW_ID) {
  return createNip5dSessionEntry(windowId, TEST_DTAG, TEST_HASH);
}

// ─── Envelope Guard Tests ──────────────────────────────────────────────────────

describe('runtime NAP dispatch — envelope guard', () => {
  let mock: MockRuntimeContext;
  let runtime: Runtime;

  beforeEach(() => {
    mock = createMockRuntimeAdapter();
    runtime = createRuntime(mock.hooks);
  });

  it('drops null', () => {
    runtime.handleMessage(WINDOW_ID, null);
    expect(mock.sent).toHaveLength(0);
  });

  it('drops non-object primitives', () => {
    runtime.handleMessage(WINDOW_ID, 'hello');
    runtime.handleMessage(WINDOW_ID, 42);
    runtime.handleMessage(WINDOW_ID, true);
    expect(mock.sent).toHaveLength(0);
  });

  it('drops legacy NIP-01 arrays (clean break — no dual-mode)', () => {
    runtime.handleMessage(WINDOW_ID, ['REQ', 'sub-1', { kinds: [1] }]);
    runtime.handleMessage(WINDOW_ID, ['EVENT', { id: 'x', kind: 1 }]);
    runtime.handleMessage(WINDOW_ID, ['AUTH', 'challenge']);
    expect(mock.sent).toHaveLength(0);
  });

  it('drops objects without a "type" field', () => {
    runtime.handleMessage(WINDOW_ID, { action: 'relay.req' });
    runtime.handleMessage(WINDOW_ID, {});
    expect(mock.sent).toHaveLength(0);
  });

  it('drops envelopes with no domain separator (no dot in type)', () => {
    runtime.handleMessage(WINDOW_ID, { type: 'noDot' } as NappletMessage);
    expect(mock.sent).toHaveLength(0);
  });

  it('drops envelopes with unknown domain — silently per NIP-5D spec', () => {
    runtime.handleMessage(WINDOW_ID, { type: 'unknown.action' } as NappletMessage);
    expect(mock.sent).toHaveLength(0);
  });

  it('drops a valid storage envelope before ACL, firewall, or domain dispatch when no session exists', () => {
    const firewallEvents = vi.fn();
    const unregisteredCtx = createMockRuntimeAdapter({ onFirewallEvent: firewallEvents });
    const unregistered = createRuntime(unregisteredCtx.hooks);
    // Make a firewall traversal externally observable if the ingress guard is absent.
    unregistered.firewallState.setPolicy('', 'deny');

    unregistered.handleMessage(WINDOW_ID, {
      type: 'storage.get',
      id: 'pre-session-storage',
      key: 'secret',
    } as NappletMessage);

    expect(unregistered.sessionRegistry.getEntryByWindowId(WINDOW_ID)).toBeUndefined();
    expect(unregisteredCtx.sent).toHaveLength(0);
    expect(unregisteredCtx.aclChecks).toHaveLength(0);
    expect(firewallEvents).not.toHaveBeenCalled();
  });

  it('drops a session-established envelope excluded by the shell environment before ACL, firewall, or dispatch', () => {
    const firewallEvents = vi.fn();
    const restrictedCtx = createMockRuntimeAdapter({
      onFirewallEvent: firewallEvents,
      isDomainAllowed: () => false,
    });
    const restricted = createRuntime(restrictedCtx.hooks);
    restricted.sessionRegistry.register(WINDOW_ID, makeSessionEntry(WINDOW_ID));
    restricted.firewallState.setPolicy('', 'deny');

    restricted.handleMessage(WINDOW_ID, {
      type: 'storage.get',
      id: 'excluded-storage',
      key: 'secret',
    } as NappletMessage);

    expect(restrictedCtx.sent).toHaveLength(0);
    expect(restrictedCtx.aclChecks).toHaveLength(0);
    expect(firewallEvents).not.toHaveBeenCalled();
  });

  it('keeps a registered service inert before session creation, then dispatches it after registration', () => {
    const serviceCalls = vi.fn();
    const firewallEvents = vi.fn();
    const ctx = createMockRuntimeAdapter({ onFirewallEvent: firewallEvents });
    const runtimeWithService = createRuntime(ctx.hooks);
    runtimeWithService.registerService('keys', {
      descriptor: { name: 'keys', version: '1.0.0' },
      handleMessage: serviceCalls,
    });
    runtimeWithService.firewallState.setPolicy('', 'deny');

    const envelope = {
      type: 'keys.registerAction',
      id: 'pre-session-service',
      action: { id: 'shortcut' },
    } as NappletMessage;
    runtimeWithService.handleMessage(WINDOW_ID, envelope);

    expect(ctx.sent).toHaveLength(0);
    expect(ctx.aclChecks).toHaveLength(0);
    expect(firewallEvents).not.toHaveBeenCalled();
    expect(serviceCalls).not.toHaveBeenCalled();

    runtimeWithService.sessionRegistry.register(WINDOW_ID, makeSessionEntry(WINDOW_ID));
    runtimeWithService.firewallState.setPolicy(TEST_DTAG, 'allow');
    runtimeWithService.handleMessage(WINDOW_ID, envelope);

    expect(serviceCalls).toHaveBeenCalledWith(WINDOW_ID, envelope, expect.any(Function));
  });
});

// ─── NIP-5D Envelope Dispatch ──────────────────────────────────────────────────

describe('NIP-5D Envelope Dispatch', () => {
  let ctx: MockRuntimeContext;
  let runtime: Runtime;

  beforeEach(() => {
    ctx = createMockRuntimeAdapter();
    runtime = createRuntime(ctx.hooks);
    // Register a NIP-5D session
    runtime.sessionRegistry.register(WINDOW_ID, makeSessionEntry(WINDOW_ID));
  });

  // ─── Message Routing ────────────────────────────────────────────────────────

  describe('message routing', () => {
    it('drops legacy NIP-01 array messages silently', () => {
      runtime.handleMessage(WINDOW_ID, ['REQ', 'sub-1', { kinds: [1] }]);
      expect(ctx.sent).toHaveLength(0);
    });

    it('drops non-object messages', () => {
      runtime.handleMessage(WINDOW_ID, 'string message');
      runtime.handleMessage(WINDOW_ID, 12345);
      expect(ctx.sent).toHaveLength(0);
    });

    it('drops objects without type field', () => {
      runtime.handleMessage(WINDOW_ID, { id: 'req-1' });
      expect(ctx.sent).toHaveLength(0);
    });

    it('drops unknown domains silently', () => {
      runtime.handleMessage(WINDOW_ID, { type: 'foo.bar' } as NappletMessage);
      expect(ctx.sent).toHaveLength(0);
    });

    it('routes relay.* to relay handler', () => {
      runtime.handleMessage(WINDOW_ID, { type: 'relay.subscribe', subId: 'sub-1', filters: [] } as NappletMessage);
      // Should get relay.eose back (no relay pool available, sends eose immediately)
      const eose = findEnvelopeResponse(ctx.sent, 'relay.eose');
      expect(eose).toBeDefined();
    });

    it('routes identity.* to identity handler', () => {
      runtime.handleMessage(WINDOW_ID, { type: 'identity.getPublicKey', id: 'req-1' } as NappletMessage);
      const result = findEnvelopeResponse(ctx.sent, 'identity.getPublicKey.result');
      expect(result).toBeDefined();
      expect((result as any).pubkey).toBe('');
    });

    it('routes storage.* to storage handler', () => {
      runtime.handleMessage(WINDOW_ID, { type: 'storage.get', id: 'req-1', key: 'test-key' } as NappletMessage);
      const result = findEnvelopeResponse(ctx.sent, 'storage.get.result');
      expect(result).toBeDefined();
    });

    it('routes inc.* to inc handler — subscribe emits inc.subscribe.result (Plan 12-04 / NAP-04)', () => {
      runtime.handleMessage(WINDOW_ID, { type: 'inc.subscribe', id: 'req-1', topic: 'test-topic' } as NappletMessage);
      // Canonical @napplet/nap/inc contract: inc.subscribe emits inc.subscribe.result.
      const result = findEnvelopeResponse(ctx.sent, 'inc.subscribe.result');
      expect(result).toBeDefined();
      expect((result as any).id).toBe('req-1');
      expect((result as any).error).toBeUndefined();
    });
  });

  // ─── Relay Handler ─────────────────────────────────────────────────────────

  describe('relay handler', () => {
    it('relay.subscribe sends relay.eose when no relay pool available and filters are non-bus', () => {
      runtime.handleMessage(WINDOW_ID, {
        type: 'relay.subscribe',
        subId: 'sub-1',
        filters: [{ kinds: [1] }],
      } as NappletMessage);

      const eose = findEnvelopeResponse(ctx.sent, 'relay.eose');
      expect(eose).toBeDefined();
      expect((eose as any).subId).toBe('sub-1');
    });

    it('relay.subscribe with empty filters array sends relay.eose', () => {
      runtime.handleMessage(WINDOW_ID, {
        type: 'relay.subscribe',
        subId: 'sub-empty',
        filters: [],
      } as NappletMessage);

      // Empty filters: the shell-kind fast path is false (no filters.every succeeds with empty), sends eose
      const eose = findEnvelopeResponse(ctx.sent, 'relay.eose');
      expect(eose).toBeDefined();
    });

    it('relay.subscribe honors the canonical relay hint', () => {
      let selected = false;
      let subscribedRelays: string[] | undefined;
      const relayPool: RelayPoolAdapter = {
        subscribe: (_filters, _cb, relayUrls) => {
          subscribedRelays = relayUrls;
          return { unsubscribe() { /* no-op */ } };
        },
        publish: () => { /* no-op */ },
        selectRelayTier: () => {
          selected = true;
          return ['wss://selected.test'];
        },
        trackSubscription: () => { /* no-op */ },
        untrackSubscription: () => { /* no-op */ },
        openScopedRelay: () => { /* no-op */ },
        closeScopedRelay: () => { /* no-op */ },
        publishToScopedRelay: () => false,
        isAvailable: () => true,
      };
      const ctxWithRelay = createMockRuntimeAdapter({ relayPool });
      const runtimeWithRelay = createRuntime(ctxWithRelay.hooks);
      runtimeWithRelay.sessionRegistry.register(WINDOW_ID, makeSessionEntry(WINDOW_ID));

      runtimeWithRelay.handleMessage(WINDOW_ID, {
        type: 'relay.subscribe',
        id: 'req-relay-hint',
        subId: 'sub-relay-hint',
        filters: [{ kinds: [1] }],
        relay: 'wss://explicit.test',
      } as NappletMessage);

      expect(subscribedRelays).toEqual(['wss://explicit.test']);
      expect(selected).toBe(false);
    });

    it('relay.close sends relay.closed', () => {
      // Subscribe first
      runtime.handleMessage(WINDOW_ID, {
        type: 'relay.subscribe',
        subId: 'sub-1',
        filters: [{ kinds: [1] }],
      } as NappletMessage);
      ctx.sent.length = 0; // clear

      runtime.handleMessage(WINDOW_ID, {
        type: 'relay.close',
        id: 'req-2',
        subId: 'sub-1',
      } as NappletMessage);

      const closed = findEnvelopeResponse(ctx.sent, 'relay.closed');
      expect(closed).toBeDefined();
      expect((closed as any).subId).toBe('sub-1');
    });

    it('relay.publish sends relay.publish.result with accepted: false when no relay pool', () => {
      const event = {
        id: 'a'.repeat(64),
        pubkey: 'b'.repeat(64),
        created_at: Math.floor(Date.now() / 1000),
        kind: 1,
        tags: [],
        content: 'hello',
        sig: 'c'.repeat(128),
      };
      runtime.handleMessage(WINDOW_ID, {
        type: 'relay.publish',
        id: 'req-pub',
        event,
      } as NappletMessage);

      const result = findEnvelopeResponse(ctx.sent, 'relay.publish.result');
      expect(result).toBeDefined();
      expect((result as any).id).toBe('req-pub');
      expect((result as any).accepted).toBe(false);
    });

    it('relay.publish sends relay.publish.error for missing event', () => {
      runtime.handleMessage(WINDOW_ID, {
        type: 'relay.publish',
        id: 'req-pub-bad',
      } as NappletMessage);

      const err = findEnvelopeResponse(ctx.sent, 'relay.publish.error');
      expect(err).toBeDefined();
      expect((err as any).error).toContain('invalid event');
    });

    it('relay.query sends relay.query.result with events array (no count field)', () => {
      runtime.handleMessage(WINDOW_ID, {
        type: 'relay.query',
        id: 'req-q',
        filters: [{ kinds: [1] }],
      } as NappletMessage);

      const result = findEnvelopeResponse(ctx.sent, 'relay.query.result');
      expect(result).toBeDefined();
      expect((result as any).id).toBe('req-q');
      expect(Array.isArray((result as any).events)).toBe(true);
      expect((result as any).count).toBeUndefined();
    });

    it('relay.query events contains published event after relay.publish', () => {
      const event = {
        id: 'd'.repeat(64),
        pubkey: 'e'.repeat(64),
        created_at: Math.floor(Date.now() / 1000),
        kind: 1,
        tags: [],
        content: 'test',
        sig: 'f'.repeat(128),
      };
      runtime.handleMessage(WINDOW_ID, {
        type: 'relay.publish',
        id: 'req-pub-2',
        event,
      } as NappletMessage);

      ctx.sent.length = 0;
      runtime.handleMessage(WINDOW_ID, {
        type: 'relay.query',
        id: 'req-q-2',
        filters: [{ kinds: [1] }],
      } as NappletMessage);

      const result = findEnvelopeResponse(ctx.sent, 'relay.query.result');
      expect(Array.isArray((result as any).events)).toBe(true);
      expect((result as any).events.length).toBeGreaterThan(0);
      expect((result as any).events.some((e: any) => e.event.id === event.id)).toBe(true);
    });

    it('relay.query with registered relay-pool service: service receives relay.subscribe, emits events, then relay.close is sent', async () => {
      const ctx2 = createMockRuntimeAdapter();
      const runtime2 = createRuntime(ctx2.hooks);
      runtime2.sessionRegistry.register(WINDOW_ID, makeSessionEntry(WINDOW_ID));

      const serviceLog: Array<{ type: string; subId?: string }> = [];
      const fakeEvent = {
        id: 'a1'.repeat(32),
        pubkey: 'b2'.repeat(32),
        created_at: Math.floor(Date.now() / 1000),
        kind: 1,
        tags: [],
        content: 'from-service',
        sig: 'c3'.repeat(64),
      };

      runtime2.registerService('relay-pool', {
        descriptor: { name: 'relay-pool', version: '1.0.0' },
        handleMessage(_wid: string, msg: NappletMessage, send: (m: NappletMessage) => void) {
          const m = msg as NappletMessage & { subId?: string };
          serviceLog.push({ type: msg.type, subId: m.subId });
          if (msg.type === 'relay.subscribe') {
            // emit one event then EOSE
            send({ type: 'relay.event', subId: m.subId, event: fakeEvent } as NappletMessage);
            send({ type: 'relay.eose', subId: m.subId } as NappletMessage);
          }
          if (msg.type === 'relay.close') {
            serviceLog.push({ type: 'relay.close', subId: m.subId });
          }
        },
      });

      runtime2.handleMessage(WINDOW_ID, {
        type: 'relay.query',
        id: 'req-q-svc',
        filters: [{ kinds: [1] }],
      } as NappletMessage);

      // Allow microtasks to settle
      await Promise.resolve();

      const result = findEnvelopeResponse(ctx2.sent, 'relay.query.result');
      expect(result).toBeDefined();
      expect((result as any).id).toBe('req-q-svc');
      expect(Array.isArray((result as any).events)).toBe(true);
      // Service-emitted event must appear in result
      expect((result as any).events.some((e: any) => e.event.id === fakeEvent.id)).toBe(true);
      // relay.subscribe was sent to the service
      expect(serviceLog.some((l) => l.type === 'relay.subscribe')).toBe(true);
      // relay.close was sent to tear down the subscription
      expect(serviceLog.some((l) => l.type === 'relay.close')).toBe(true);
    });

    it('relay.query deduplicates events present in both buffer and service result', async () => {
      const ctx2 = createMockRuntimeAdapter();
      const runtime2 = createRuntime(ctx2.hooks);
      runtime2.sessionRegistry.register(WINDOW_ID, makeSessionEntry(WINDOW_ID));

      const sharedEvent = {
        id: 'dead'.repeat(16),
        pubkey: 'beef'.repeat(16),
        created_at: Math.floor(Date.now() / 1000),
        kind: 1,
        tags: [],
        content: 'shared',
        sig: 'cafe'.repeat(32),
      };

      // Publish the event so it lands in the buffer
      runtime2.handleMessage(WINDOW_ID, {
        type: 'relay.publish',
        id: 'req-pub-dedup',
        event: sharedEvent,
      } as NappletMessage);

      // Register a relay-pool service that also emits the same event
      runtime2.registerService('relay-pool', {
        descriptor: { name: 'relay-pool', version: '1.0.0' },
        handleMessage(_wid: string, msg: NappletMessage, send: (m: NappletMessage) => void) {
          const m = msg as NappletMessage & { subId?: string };
          if (msg.type === 'relay.subscribe') {
            send({ type: 'relay.event', subId: m.subId, event: sharedEvent } as NappletMessage);
            send({ type: 'relay.eose', subId: m.subId } as NappletMessage);
          }
        },
      });

      ctx2.sent.length = 0;
      runtime2.handleMessage(WINDOW_ID, {
        type: 'relay.query',
        id: 'req-q-dedup',
        filters: [{ kinds: [1] }],
      } as NappletMessage);

      await Promise.resolve();

      const result = findEnvelopeResponse(ctx2.sent, 'relay.query.result');
      expect(Array.isArray((result as any).events)).toBe(true);
      // The shared event appears exactly once despite being in both buffer and service
      const matchingEvents = (result as any).events.filter((e: any) => e.event.id === sharedEvent.id);
      expect(matchingEvents).toHaveLength(1);
    });
  });

  // ─── Identity Handler ───────────────────────────────────────────────────────

  describe('identity handler', () => {
    it('identity.getPublicKey returns empty pubkey when no signer configured', () => {
      runtime.handleMessage(WINDOW_ID, { type: 'identity.getPublicKey', id: 'req-1' } as NappletMessage);
      const result = findEnvelopeResponse(ctx.sent, 'identity.getPublicKey.result');
      expect(result).toBeDefined();
      expect((result as any).pubkey).toBe('');
    });

    it('identity.getPublicKey returns pubkey when signer is configured', async () => {
      const ctxWithSigner = createMockRuntimeAdapter({
        auth: {
          getUserPubkey: () => 'user_pubkey_hex',
          getSigner: () => ({
            getPublicKey: () => 'user_pubkey_hex',
            signEvent: async (e: any) => ({ ...e, sig: 'signed' }),
            getRelays: () => ({}),
          }),
        },
      });
      const runtimeWithSigner = createRuntime(ctxWithSigner.hooks);
      runtimeWithSigner.sessionRegistry.register(WINDOW_ID, makeSessionEntry(WINDOW_ID));

      runtimeWithSigner.handleMessage(WINDOW_ID, { type: 'identity.getPublicKey', id: 'req-pk' } as NappletMessage);
      // Flush microtasks for async Promise resolution
      await Promise.resolve();
      await Promise.resolve();

      const result = findEnvelopeResponse(ctxWithSigner.sent, 'identity.getPublicKey.result');
      expect(result).toBeDefined();
      expect((result as any).pubkey).toBe('user_pubkey_hex');
    });

    it('identity.getRelays returns relays map when signer is configured', async () => {
      const ctxWithSigner = createMockRuntimeAdapter({
        auth: {
          getUserPubkey: () => 'user_pubkey_hex',
          getSigner: () => ({
            getPublicKey: () => 'user_pubkey_hex',
            getRelays: () => ({ 'wss://relay.example.com': { read: true, write: true } }),
          }),
        },
      });
      const runtimeWithSigner = createRuntime(ctxWithSigner.hooks);
      runtimeWithSigner.sessionRegistry.register(WINDOW_ID, makeSessionEntry(WINDOW_ID));

      runtimeWithSigner.handleMessage(WINDOW_ID, { type: 'identity.getRelays', id: 'req-relays' } as NappletMessage);
      await Promise.resolve();
      await Promise.resolve();

      const result = findEnvelopeResponse(ctxWithSigner.sent, 'identity.getRelays.result');
      expect(result).toBeDefined();
      expect((result as any).relays).toEqual({
        'wss://relay.example.com': { read: true, write: true },
      });
    });

    it('identity.getProfile returns result with profile: null (stub fallback)', () => {
      runtime.handleMessage(WINDOW_ID, { type: 'identity.getProfile', id: 'req-profile' } as NappletMessage);
      const result = findEnvelopeResponse(ctx.sent, 'identity.getProfile.result');
      expect(result).toBeDefined();
      expect((result as any).profile).toBeNull();
    });

    it('identity.getFollows returns result with pubkeys: [] (stub fallback)', () => {
      runtime.handleMessage(WINDOW_ID, { type: 'identity.getFollows', id: 'req-follows' } as NappletMessage);
      const result = findEnvelopeResponse(ctx.sent, 'identity.getFollows.result');
      expect(result).toBeDefined();
      expect((result as any).pubkeys).toEqual([]);
    });

    it('identity.getPublicKey bypasses ACL and returns the signed-out sentinel', () => {
      // resolveCapabilitiesNap returns { senderCap: null, recipientCap: null } for
      // identity.* pre-Plan-12-10. The envelope therefore reaches the handler even
      // when the napplet is blocked.
      runtime.handleMessage(WINDOW_ID, { type: 'identity.getPublicKey', id: 'req-pk-acl' } as NappletMessage);
      const result = findEnvelopeResponse(ctx.sent, 'identity.getPublicKey.result');
      expect(result).toBeDefined();
      expect((result as any).pubkey).toBe('');
    });
  });

  // ─── Storage Handler ─────────────────────────────────────────────────────────

  describe('storage handler', () => {
    it('storage.get returns value:null for missing key (canonical nap-storage)', () => {
      runtime.handleMessage(WINDOW_ID, {
        type: 'storage.get',
        id: 'req-get-1',
        key: 'nonexistent-key',
      } as NappletMessage);

      const result = findEnvelopeResponse(ctx.sent, 'storage.get.result');
      expect(result).toBeDefined();
      // Plan 12-09: canonical @napplet/nap/storage drops `found` — null ⇔ missing.
      expect((result as any).value).toBeNull();
      expect((result as any).found).toBeUndefined();
    });

    it('storage.set writes and returns ok:true', () => {
      runtime.handleMessage(WINDOW_ID, {
        type: 'storage.set',
        id: 'req-set-1',
        key: 'my-key',
        value: 'my-value',
      } as NappletMessage);

      const result = findEnvelopeResponse(ctx.sent, 'storage.set.result');
      expect(result).toBeDefined();
      expect((result as any).ok).toBe(true);
    });

    it('storage.set + storage.get round-trip', () => {
      runtime.handleMessage(WINDOW_ID, {
        type: 'storage.set',
        id: 'req-set-rt',
        key: 'roundtrip-key',
        value: 'roundtrip-value',
      } as NappletMessage);

      ctx.sent.length = 0;

      runtime.handleMessage(WINDOW_ID, {
        type: 'storage.get',
        id: 'req-get-rt',
        key: 'roundtrip-key',
      } as NappletMessage);

      const result = findEnvelopeResponse(ctx.sent, 'storage.get.result');
      expect(result).toBeDefined();
      // Plan 12-09: `value !== null` is the success signal; `found` was dropped.
      expect((result as any).value).toBe('roundtrip-value');
      expect((result as any).found).toBeUndefined();
    });

    it('storage.keys returns stored keys', () => {
      runtime.handleMessage(WINDOW_ID, { type: 'storage.set', id: 's1', key: 'key-a', value: 'v1' } as NappletMessage);
      runtime.handleMessage(WINDOW_ID, { type: 'storage.set', id: 's2', key: 'key-b', value: 'v2' } as NappletMessage);
      ctx.sent.length = 0;

      runtime.handleMessage(WINDOW_ID, { type: 'storage.keys', id: 'req-keys' } as NappletMessage);

      const result = findEnvelopeResponse(ctx.sent, 'storage.keys.result');
      expect(result).toBeDefined();
      const keys = (result as any).keys as string[];
      expect(keys).toContain('key-a');
      expect(keys).toContain('key-b');
    });

    it('storage.remove deletes key', () => {
      runtime.handleMessage(WINDOW_ID, { type: 'storage.set', id: 's1', key: 'del-key', value: 'del-val' } as NappletMessage);
      ctx.sent.length = 0;

      runtime.handleMessage(WINDOW_ID, { type: 'storage.remove', id: 'req-rm', key: 'del-key' } as NappletMessage);
      const rmResult = findEnvelopeResponse(ctx.sent, 'storage.remove.result');
      expect(rmResult).toBeDefined();
      expect((rmResult as any).ok).toBe(true);

      ctx.sent.length = 0;
      runtime.handleMessage(WINDOW_ID, { type: 'storage.get', id: 'req-get-rm', key: 'del-key' } as NappletMessage);
      const getResult = findEnvelopeResponse(ctx.sent, 'storage.get.result');
      // Plan 12-09: missing key returns `value: null` (not `found: false`).
      expect((getResult as any).value).toBeNull();
    });

    it('storage.clear is rejected — not in @napplet/nap/storage (Plan 12-09)', () => {
      runtime.handleMessage(WINDOW_ID, { type: 'storage.set', id: 's1', key: 'k1', value: 'v1' } as NappletMessage);
      runtime.handleMessage(WINDOW_ID, { type: 'storage.set', id: 's2', key: 'k2', value: 'v2' } as NappletMessage);
      ctx.sent.length = 0;

      runtime.handleMessage(WINDOW_ID, { type: 'storage.clear', id: 'req-clear' } as NappletMessage);
      // Canonical @napplet/nap/storage has no *.error type — errors are delivered as
      // storage.<action>.result with the optional `error` field populated.
      const clearResult = findEnvelopeResponse(ctx.sent, 'storage.clear.result');
      expect(clearResult).toBeDefined();
      expect((clearResult as any).id).toBe('req-clear');
      expect((clearResult as any).error).toMatch(/not (in )?@napplet\/nap\/storage|unknown storage action: clear/i);
      // No non-canonical storage.clear.error envelope was emitted.
      expect(findEnvelopeResponse(ctx.sent, 'storage.clear.error')).toBeUndefined();

      // Prior sets survive (storage.clear never ran).
      ctx.sent.length = 0;
      runtime.handleMessage(WINDOW_ID, { type: 'storage.keys', id: 'req-keys-after' } as NappletMessage);
      const keysResult = findEnvelopeResponse(ctx.sent, 'storage.keys.result');
      const keys = (keysResult as any).keys as string[];
      expect(keys).toContain('k1');
      expect(keys).toContain('k2');
    });

    it('storage.get is silent for an unregistered window before shell.ready', () => {
      // Don't register the window session
      const ctx2 = createMockRuntimeAdapter();
      const runtime2 = createRuntime(ctx2.hooks);

      runtime2.handleMessage(WINDOW_ID, { type: 'storage.get', id: 'req-nr', key: 'k' } as NappletMessage);

      expect(ctx2.sent).toHaveLength(0);
      expect(ctx2.aclChecks).toHaveLength(0);
    });
  });

  // ─── INC Handler ──────────────────────────────────────────────────────────────

  describe('INC handler', () => {
    it('inc.subscribe registers subscription and emits inc.subscribe.result (Plan 12-04 / NAP-04)', () => {
      runtime.handleMessage(WINDOW_ID, {
        type: 'inc.subscribe',
        id: 'req-sub-inc',
        topic: 'chat',
      } as NappletMessage);
      // Canonical @napplet/nap/inc contract: handler must emit inc.subscribe.result.
      const result = findEnvelopeResponse(ctx.sent, 'inc.subscribe.result');
      expect(result).toBeDefined();
      expect((result as any).id).toBe('req-sub-inc');
      expect((result as any).error).toBeUndefined();
    });

    it('inc.subscribe + inc.emit delivers to subscriber', () => {
      // Register second window
      runtime.sessionRegistry.register(WINDOW_ID_2, makeSessionEntry(WINDOW_ID_2));

      // Window 2 subscribes to topic
      runtime.handleMessage(WINDOW_ID_2, {
        type: 'inc.subscribe',
        topic: 'news',
      } as NappletMessage);

      // Window 1 emits to topic
      runtime.handleMessage(WINDOW_ID, {
        type: 'inc.emit',
        topic: 'news',
        payload: { text: 'hello' },
      } as NappletMessage);

      // Window 2 should receive inc.event
      const event = ctx.sent.find(
        (s) => s.windowId === WINDOW_ID_2 &&
          typeof s.message === 'object' &&
          !Array.isArray(s.message) &&
          (s.message as NappletMessage).type === 'inc.event',
      );
      expect(event).toBeDefined();
      expect((event!.message as any).topic).toBe('news');
      expect((event!.message as any).payload).toEqual({ text: 'hello' });
      expect((event!.message as any).sender).toBe(WINDOW_ID);
    });

    it('inc.emit does not echo to sender', () => {
      // Window 1 subscribes
      runtime.handleMessage(WINDOW_ID, {
        type: 'inc.subscribe',
        topic: 'self-test',
      } as NappletMessage);

      // Window 1 emits
      runtime.handleMessage(WINDOW_ID, {
        type: 'inc.emit',
        topic: 'self-test',
        payload: { data: 'echo-check' },
      } as NappletMessage);

      // Window 1 should NOT receive its own message
      const selfEvent = ctx.sent.find(
        (s) => s.windowId === WINDOW_ID &&
          typeof s.message === 'object' &&
          !Array.isArray(s.message) &&
          (s.message as NappletMessage).type === 'inc.event',
      );
      expect(selfEvent).toBeUndefined();
    });

    it('inc.unsubscribe stops delivery', () => {
      runtime.sessionRegistry.register(WINDOW_ID_2, makeSessionEntry(WINDOW_ID_2));

      // Window 2 subscribes
      runtime.handleMessage(WINDOW_ID_2, { type: 'inc.subscribe', topic: 'updates' } as NappletMessage);
      // Window 2 unsubscribes
      runtime.handleMessage(WINDOW_ID_2, { type: 'inc.unsubscribe', topic: 'updates' } as NappletMessage);

      // Window 1 emits
      runtime.handleMessage(WINDOW_ID, {
        type: 'inc.emit',
        topic: 'updates',
        payload: { msg: 'should not arrive' },
      } as NappletMessage);

      // Window 2 should NOT receive event
      const event = ctx.sent.find(
        (s) => s.windowId === WINDOW_ID_2 &&
          typeof s.message === 'object' &&
          !Array.isArray(s.message) &&
          (s.message as NappletMessage).type === 'inc.event',
      );
      expect(event).toBeUndefined();
    });

    // ─── INC vocabulary parallels (D6 / ALIGN-05) ──────────────────────────────

    it('inc.subscribe produces inc.subscribe.result (D6: requester prefix echoed)', () => {
      runtime.handleMessage(WINDOW_ID, {
        type: 'inc.subscribe',
        id: 'req-sub-inc',
        topic: 'chat',
      } as NappletMessage);
      const result = ctx.sent.find(
        (s) => s.windowId === WINDOW_ID &&
          typeof s.message === 'object' &&
          !Array.isArray(s.message) &&
          (s.message as NappletMessage).type === 'inc.subscribe.result',
      );
      expect(result).toBeDefined();
      expect((result!.message as any).id).toBe('req-sub-inc');
      expect((result!.message as any).error).toBeUndefined();
    });

    it('inc.subscribe + inc.emit delivers inc.event to inc subscriber (D6: all-inc roundtrip)', () => {
      runtime.sessionRegistry.register(WINDOW_ID_2, makeSessionEntry(WINDOW_ID_2));

      // Window 2 subscribes via inc
      runtime.handleMessage(WINDOW_ID_2, {
        type: 'inc.subscribe',
        topic: 'inc-news',
      } as NappletMessage);

      // Window 1 emits via inc
      runtime.handleMessage(WINDOW_ID, {
        type: 'inc.emit',
        topic: 'inc-news',
        payload: { text: 'inc hello' },
      } as NappletMessage);

      // Window 2 should receive inc.event.
      const event = ctx.sent.find(
        (s) => s.windowId === WINDOW_ID_2 &&
          typeof s.message === 'object' &&
          !Array.isArray(s.message) &&
          (s.message as NappletMessage).type === 'inc.event',
      );
      expect(event).toBeDefined();
      expect((event!.message as any).topic).toBe('inc-news');
      expect((event!.message as any).payload).toEqual({ text: 'inc hello' });
      expect((event!.message as any).sender).toBe(WINDOW_ID);
    });
  });

  // ─── ACL Enforcement ──────────────────────────────────────────────────────────

  describe('ACL enforcement', () => {
    it('denied capability returns .error type with denial reason', () => {
      // Block the napplet
      runtime.aclState.block('', TEST_DTAG, TEST_HASH);

      runtime.handleMessage(WINDOW_ID, {
        type: 'relay.subscribe',
        id: 'req-blocked',
        subId: 'sub-blocked',
        filters: [{ kinds: [1] }],
      } as NappletMessage);

      const err = findEnvelopeResponse(ctx.sent, 'relay.subscribe.error');
      expect(err).toBeDefined();
      expect((err as any).error).toBeDefined();
    });

    it('identity.getPublicKey bypasses ACL with signed-out sentinel', () => {
      // Even with napplet blocked, getPublicKey should pass ACL (senderCap is null)
      runtime.aclState.block('', TEST_DTAG, TEST_HASH);

      runtime.handleMessage(WINDOW_ID, { type: 'identity.getPublicKey', id: 'req-pk-blocked' } as NappletMessage);

      const result = findEnvelopeResponse(ctx.sent, 'identity.getPublicKey.result');
      expect(result).toBeDefined();
      expect((result as any).pubkey).toBe('');
    });

    it('inc.subscribe bypasses ACL (relay:read required, granted by default)', () => {
      // Default state grants relay:read, so subscribe should work
      runtime.handleMessage(WINDOW_ID, { type: 'inc.subscribe', topic: 'test' } as NappletMessage);
      // No error response
      const err = findEnvelopeResponse(ctx.sent, 'inc.subscribe.error');
      expect(err).toBeUndefined();
    });
  });

  // ─── Lifecycle ────────────────────────────────────────────────────────────────

  describe('lifecycle', () => {
    it('injectEvent does not throw', () => {
      expect(() => {
        runtime.injectEvent('test:topic', { data: 'hello' });
      }).not.toThrow();
    });

    it('destroy() clears INC subscriptions', () => {
      runtime.sessionRegistry.register(WINDOW_ID_2, makeSessionEntry(WINDOW_ID_2));
      runtime.handleMessage(WINDOW_ID_2, { type: 'inc.subscribe', topic: 'cleanup-test' } as NappletMessage);

      runtime.destroy();

      // After destroy, emit should not deliver to anyone
      runtime.handleMessage(WINDOW_ID, {
        type: 'inc.emit',
        topic: 'cleanup-test',
        payload: 'after-destroy',
      } as NappletMessage);

      const event = ctx.sent.find(
        (s) => s.windowId === WINDOW_ID_2 &&
          typeof s.message === 'object' &&
          !Array.isArray(s.message) &&
          (s.message as NappletMessage).type === 'inc.event',
      );
      expect(event).toBeUndefined();
    });

    it('destroyWindow() removes INC subscriptions for that window', () => {
      runtime.sessionRegistry.register(WINDOW_ID_2, makeSessionEntry(WINDOW_ID_2));
      runtime.handleMessage(WINDOW_ID_2, { type: 'inc.subscribe', topic: 'window-cleanup' } as NappletMessage);

      runtime.destroyWindow(WINDOW_ID_2);

      ctx.sent.length = 0;
      runtime.handleMessage(WINDOW_ID, {
        type: 'inc.emit',
        topic: 'window-cleanup',
        payload: 'after-window-destroy',
      } as NappletMessage);

      const event = ctx.sent.find(
        (s) => s.windowId === WINDOW_ID_2 &&
          typeof s.message === 'object' &&
          !Array.isArray(s.message) &&
          (s.message as NappletMessage).type === 'inc.event',
      );
      expect(event).toBeUndefined();
    });

    it('registerService() and unregisterService() are functional', () => {
      runtime.registerService('test-service', {
        descriptor: { name: 'test-service', version: '1.0.0' },
        handleMessage() { /* no-op */ },
      });
      runtime.unregisterService('test-service');
      expect(true).toBe(true);
    });

    it('registerConsentHandler() does not throw', () => {
      expect(() => {
        runtime.registerConsentHandler(() => { /* no-op */ });
      }).not.toThrow();
    });
  });

  // ─── Keys Handler (NAP-05 / Plan 12-05) ─────────────────────────────────
  describe('keys handler', () => {
    it('routes keys.* to registered keys service (keys.registerAction -> .result)', () => {
      const ctx2 = createMockRuntimeAdapter();
      const runtime2 = createRuntime(ctx2.hooks);
      runtime2.sessionRegistry.register(WINDOW_ID, makeSessionEntry(WINDOW_ID));

      // Minimal ServiceHandler stub for the 'keys' domain
      runtime2.registerService('keys', {
        descriptor: { name: 'keys', version: '1.0.0' },
        handleMessage(_wid, msg, send) {
          if (msg.type === 'keys.registerAction') {
            const m = msg as NappletMessage & { id: string; action: { id: string; defaultKey?: string } };
            send({
              type: 'keys.registerAction.result',
              id: m.id,
              actionId: m.action.id,
              ...(m.action.defaultKey ? { binding: m.action.defaultKey } : {}),
            } as NappletMessage);
          }
        },
      });

      runtime2.handleMessage(WINDOW_ID, {
        type: 'keys.registerAction',
        id: 'r1',
        action: { id: 'editor.save', label: 'Save', defaultKey: 'Ctrl+S' },
      } as NappletMessage);

      const reply = findEnvelopeResponse(ctx2.sent, 'keys.registerAction.result');
      expect(reply).toBeDefined();
      expect((reply as any).id).toBe('r1');
      expect((reply as any).actionId).toBe('editor.save');
      expect((reply as any).binding).toBe('Ctrl+S');
    });

    it('fallback: keys.forward invokes hooks.hotkeys.executeHotkeyFromForward when no service registered', () => {
      const forwardSpy: Array<Record<string, unknown>> = [];
      const ctx2 = createMockRuntimeAdapter({
        hotkeys: {
          executeHotkeyFromForward(event) {
            forwardSpy.push(event as unknown as Record<string, unknown>);
          },
        },
      });
      const runtime2 = createRuntime(ctx2.hooks);
      runtime2.sessionRegistry.register(WINDOW_ID, makeSessionEntry(WINDOW_ID));

      runtime2.handleMessage(WINDOW_ID, {
        type: 'keys.forward',
        key: 's',
        code: 'KeyS',
        ctrl: true,
        alt: false,
        shift: false,
        meta: false,
      } as NappletMessage);

      expect(forwardSpy).toHaveLength(1);
      expect(forwardSpy[0]).toEqual({
        key: 's',
        code: 'KeyS',
        ctrlKey: true,
        altKey: false,
        shiftKey: false,
        metaKey: false,
      });
      // fire-and-forget — no envelope back to napplet
      expect(ctx2.sent).toHaveLength(0);
    });

    it('fallback: keys.forward silently ignores unmapped window identities', () => {
      const forwardSpy: Array<Record<string, unknown>> = [];
      const ctx2 = createMockRuntimeAdapter({
        hotkeys: {
          executeHotkeyFromForward(event) {
            forwardSpy.push(event as unknown as Record<string, unknown>);
          },
        },
      });
      const runtime2 = createRuntime(ctx2.hooks);

      runtime2.handleMessage(WINDOW_ID, {
        type: 'keys.forward',
        key: 's',
        code: 'KeyS',
        ctrl: true,
        alt: false,
        shift: false,
        meta: false,
      } as NappletMessage);

      expect(forwardSpy).toHaveLength(0);
      expect(ctx2.sent).toHaveLength(0);
    });

    it('keys.forward invokes hooks.hotkeys.executeHotkeyFromForward even when a keys service is registered', () => {
      const forwardSpy: Array<Record<string, unknown>> = [];
      const serviceMessages: NappletMessage[] = [];
      const ctx2 = createMockRuntimeAdapter({
        hotkeys: {
          executeHotkeyFromForward(event) {
            forwardSpy.push(event as unknown as Record<string, unknown>);
          },
        },
      });
      const runtime2 = createRuntime(ctx2.hooks);
      runtime2.sessionRegistry.register(WINDOW_ID, makeSessionEntry(WINDOW_ID));
      runtime2.registerService('keys', {
        descriptor: { name: 'keys', version: '1.0.0' },
        handleMessage(_wid, msg) {
          serviceMessages.push(msg);
        },
      });

      runtime2.handleMessage(WINDOW_ID, {
        type: 'keys.forward',
        key: '2',
        code: 'Digit2',
        ctrl: false,
        alt: false,
        shift: false,
        meta: false,
      } as NappletMessage);

      expect(forwardSpy).toHaveLength(1);
      expect(forwardSpy[0]).toEqual({
        key: '2',
        code: 'Digit2',
        ctrlKey: false,
        altKey: false,
        shiftKey: false,
        metaKey: false,
      });
      expect(serviceMessages).toHaveLength(0);
      expect(ctx2.sent).toHaveLength(0);
    });

    it('fallback: keys.registerAction emits keys.registerAction.result when no service registered', () => {
      const ctx2 = createMockRuntimeAdapter();
      const runtime2 = createRuntime(ctx2.hooks);
      runtime2.sessionRegistry.register(WINDOW_ID, makeSessionEntry(WINDOW_ID));

      runtime2.handleMessage(WINDOW_ID, {
        type: 'keys.registerAction',
        id: 'r2',
        action: { id: 'viewer.zoom', label: 'Zoom', defaultKey: 'Ctrl+=' },
      } as NappletMessage);

      const reply = findEnvelopeResponse(ctx2.sent, 'keys.registerAction.result');
      expect(reply).toBeDefined();
      expect((reply as any).id).toBe('r2');
      expect((reply as any).actionId).toBe('viewer.zoom');
      expect((reply as any).binding).toBeUndefined();
    });

    it('fallback: keys.unregisterAction emits no envelope (fire-and-forget)', () => {
      const ctx2 = createMockRuntimeAdapter();
      const runtime2 = createRuntime(ctx2.hooks);
      runtime2.sessionRegistry.register(WINDOW_ID, makeSessionEntry(WINDOW_ID));

      runtime2.handleMessage(WINDOW_ID, {
        type: 'keys.unregisterAction',
        actionId: 'editor.save',
      } as NappletMessage);

      expect(ctx2.sent).toHaveLength(0);
    });
  });
});

// ─── Theme NAP dispatch (TH-01 + TH-04) ────────────────────────────────────────

describe('theme NAP dispatch (TH-01 + TH-04)', () => {
  it('TH-01 happy path: napplet with theme:read reaches a registered theme service', () => {
    const ctx2 = createMockRuntimeAdapter();
    const runtime2 = createRuntime(ctx2.hooks);
    runtime2.sessionRegistry.register(WINDOW_ID, makeSessionEntry(WINDOW_ID));
    // Default ACL policy is 'permissive', so an unregistered identity passes
    // theme:read. Explicitly granting keeps the test robust to future policy
    // changes (restrictive default, etc.).
    runtime2.aclState.grant('', TEST_DTAG, TEST_HASH, 'theme:read');

    const serviceCalls: Array<{ windowId: string; msgType: string }> = [];
    runtime2.registerService('theme', {
      descriptor: { name: 'theme', version: '1.0.0' },
      handleMessage(wid, msg, send) {
        serviceCalls.push({ windowId: wid, msgType: msg.type });
        if (msg.type === 'theme.get') {
          const m = msg as NappletMessage & { id?: string };
          send({
            type: 'theme.get.result',
            id: m.id ?? '',
            theme: {
              colors: { background: '#0a0a0a', text: '#e0e0e0', primary: '#7aa2f7' },
            },
          } as NappletMessage);
        }
      },
    });

    runtime2.handleMessage(WINDOW_ID, {
      type: 'theme.get',
      id: 'q-1',
    } as NappletMessage);

    expect(serviceCalls).toHaveLength(1);
    expect(serviceCalls[0]).toEqual({ windowId: WINDOW_ID, msgType: 'theme.get' });

    const result = findEnvelopeResponse(ctx2.sent, 'theme.get.result');
    expect(result).toBeDefined();
    expect((result as any).id).toBe('q-1');
    expect((result as any).theme.colors.background).toBe('#0a0a0a');
  });

  it('TH-04 ACL denial: napplet without theme:read gets theme.get.error without reaching service', () => {
    const ctx2 = createMockRuntimeAdapter();
    const runtime2 = createRuntime(ctx2.hooks);
    runtime2.sessionRegistry.register(WINDOW_ID, makeSessionEntry(WINDOW_ID));
    // Block the napplet — blocked identities fail ALL capability checks
    // regardless of the default policy, so theme:read is denied.
    runtime2.aclState.block('', TEST_DTAG, TEST_HASH);

    const serviceCalls: string[] = [];
    runtime2.registerService('theme', {
      descriptor: { name: 'theme', version: '1.0.0' },
      handleMessage(_wid, msg, _send) {
        serviceCalls.push(msg.type);
      },
    });

    runtime2.handleMessage(WINDOW_ID, {
      type: 'theme.get',
      id: 'q-denied',
    } as NappletMessage);

    // Service MUST NOT be invoked when ACL denies the request.
    expect(serviceCalls).toHaveLength(0);

    const err = findEnvelopeResponse(ctx2.sent, 'theme.get.error');
    expect(err).toBeDefined();
    expect((err as any).id).toBe('q-denied');
    expect(typeof (err as any).error).toBe('string');
    expect((err as any).error).toMatch(/denied|theme:read/i);
  });

  it('fallback: emits theme.get.result with the canonical default theme when no theme service is registered', () => {
    const ctx2 = createMockRuntimeAdapter();
    const runtime2 = createRuntime(ctx2.hooks);
    runtime2.sessionRegistry.register(WINDOW_ID, makeSessionEntry(WINDOW_ID));
    runtime2.aclState.grant('', TEST_DTAG, TEST_HASH, 'theme:read');

    // Do NOT register a theme service — exercise the runtime fallback path.
    runtime2.handleMessage(WINDOW_ID, {
      type: 'theme.get',
      id: 'q-fallback',
    } as NappletMessage);

    const result = findEnvelopeResponse(ctx2.sent, 'theme.get.result');
    expect(result).toBeDefined();
    expect((result as any).id).toBe('q-fallback');
    const theme = (result as any).theme;
    expect(theme).toBeDefined();
    expect(theme.colors.background).toBe('#0a0a0a');
    expect(theme.colors.text).toBe('#e0e0e0');
    expect(theme.colors.primary).toBe('#7aa2f7');
  });

  it('fallback: media.session.create rejects ownerless requests when no media service is registered', () => {
    const ctx2 = createMockRuntimeAdapter();
    const runtime2 = createRuntime(ctx2.hooks);
    runtime2.sessionRegistry.register(WINDOW_ID, makeSessionEntry(WINDOW_ID));
    runtime2.aclState.grant('', TEST_DTAG, TEST_HASH, 'media:control');

    runtime2.handleMessage(WINDOW_ID, {
      type: 'media.session.create',
      id: 'media-ownerless',
      sessionId: 'hint',
    } as NappletMessage);

    const result = findEnvelopeResponse(ctx2.sent, 'media.session.create.result');
    expect(result).toBeDefined();
    expect((result as any).id).toBe('media-ownerless');
    expect((result as any).sessionId).toBeUndefined();
    expect((result as any).error).toBe('missing owner');
  });

  it('fallback: media.session.create reports unsupported shell-owned playback', () => {
    const ctx2 = createMockRuntimeAdapter();
    const runtime2 = createRuntime(ctx2.hooks);
    runtime2.sessionRegistry.register(WINDOW_ID, makeSessionEntry(WINDOW_ID));
    runtime2.aclState.grant('', TEST_DTAG, TEST_HASH, 'media:control');

    runtime2.handleMessage(WINDOW_ID, {
      type: 'media.session.create',
      id: 'media-shell',
      owner: 'shell',
      source: { url: 'https://example.com/live.mp3' },
    } as NappletMessage);

    const result = findEnvelopeResponse(ctx2.sent, 'media.session.create.result');
    expect(result).toBeDefined();
    expect((result as any).id).toBe('media-shell');
    expect((result as any).owner).toBe('shell');
    expect((result as any).error).toBe('unsupported owner mode');
  });

  it('fallback: media.session.create includes owner for napplet-owned sessions', () => {
    const ctx2 = createMockRuntimeAdapter();
    const runtime2 = createRuntime(ctx2.hooks);
    runtime2.sessionRegistry.register(WINDOW_ID, makeSessionEntry(WINDOW_ID));
    runtime2.aclState.grant('', TEST_DTAG, TEST_HASH, 'media:control');

    runtime2.handleMessage(WINDOW_ID, {
      type: 'media.session.create',
      id: 'media-napplet',
      owner: 'napplet',
      sessionId: 'napplet-owned',
    } as NappletMessage);

    const result = findEnvelopeResponse(ctx2.sent, 'media.session.create.result');
    expect(result).toBeDefined();
    expect((result as any).id).toBe('media-napplet');
    expect((result as any).sessionId).toBe('napplet-owned');
    expect((result as any).owner).toBe('napplet');
  });
});

// ─── createDispatch integration (Phase 14 DISPATCH-01/02/03) ───────────────────

describe('createDispatch integration (Phase 14 DISPATCH-01/02/03)', () => {
  it('registerNap integration: all 8 NAP domains route through createDispatch', () => {
    const ctx2 = createMockRuntimeAdapter();
    const runtime2 = createRuntime(ctx2.hooks);
    runtime2.sessionRegistry.register(WINDOW_ID, makeSessionEntry(WINDOW_ID));
    // Ensure theme:read is granted so theme.get reaches the fallback path (not ACL-denied).
    runtime2.aclState.grant('', TEST_DTAG, TEST_HASH, 'theme:read');

    // Send one canonical-shaped envelope per registered domain.
    const envelopes: NappletMessage[] = [
      { type: 'relay.subscribe', subId: 'sub-d', filters: [] } as NappletMessage,
      { type: 'identity.getPublicKey', id: 'id-d' } as NappletMessage,
      { type: 'keys.registerAction', id: 'k-d', action: { id: 'a', label: 'A', defaultKey: 'Ctrl+A' } } as NappletMessage,
      { type: 'media.session.create', owner: 'napplet', id: 'm-d' } as NappletMessage,
      { type: 'notify.send', id: 'n-d', notification: { title: 't', body: 'b' } } as NappletMessage,
      { type: 'storage.get', id: 's-d', key: 'k' } as NappletMessage,
      { type: 'inc.subscribe', id: 'i-d', topic: 't' } as NappletMessage,
      { type: 'theme.get', id: 't-d' } as NappletMessage,
    ];

    for (const env of envelopes) {
      runtime2.handleMessage(WINDOW_ID, env);
    }

    // Each of the 8 envelopes must have produced at least one response envelope
    // (either .result, .error, .eose, or a side-channel event like inc.event/inc.subscribe.result).
    // If any domain's handler is missing from registerNap() at runtime startup,
    // napDispatch.dispatch() returns false and nothing is emitted — test fails.
    const domainsWithResponse = new Set<string>();
    for (const sent of ctx2.sent) {
      if (typeof sent.message === 'object' && sent.message !== null && !Array.isArray(sent.message)) {
        const type = (sent.message as NappletMessage).type;
        const dot = type.indexOf('.');
        if (dot > 0) domainsWithResponse.add(type.slice(0, dot));
      }
    }
    // Expect every one of the 8 domains to have produced at least one reply envelope.
    for (const d of ['relay', 'identity', 'keys', 'media', 'notify', 'storage', 'inc', 'theme']) {
      expect(domainsWithResponse.has(d), `domain ${d} produced no response envelope — handler not registered via registerNap()?`).toBe(true);
    }
  });

  // ─── Resource Handler (NAP-RESOURCE / Phase 40 / RESOURCE-02) ─────────────────
  //
  // Phase 39 Dev 1 lesson: adding the service to serviceRegistry is NOT enough —
  // napDispatch.registerNap('resource', ...) must also be called or resource.*
  // envelopes are silently dropped. These two tests enforce that lesson:
  //   1. With registerService + pre-granted cap, handleMessage is called.
  //   2. Without registerService, the envelope doesn't throw and doesn't reach any handler.

  it('resource.bytes routes to registered resource service when resource:fetch is granted (registerNap lesson)', async () => {
    const ctx2 = createMockRuntimeAdapter();
    const runtime2 = createRuntime(ctx2.hooks);
    runtime2.sessionRegistry.register(WINDOW_ID, makeSessionEntry(WINDOW_ID));
    // Pre-grant resource:fetch so the ACL gate passes
    runtime2.aclState.grant('', TEST_DTAG, TEST_HASH, 'resource:fetch');

    const received: NappletMessage[] = [];

    runtime2.registerService('resource', {
      descriptor: { name: 'resource', version: '1.0.0' },
      handleMessage(_wid: string, msg: NappletMessage, _send: (m: NappletMessage) => void) {
        received.push(msg);
      },
    });

    runtime2.handleMessage(WINDOW_ID, {
      type: 'resource.bytes',
      requestId: 'r1',
      url: 'http://localhost:5174/data',
    } as NappletMessage);

    // The handler is synchronous dispatch; async handleBytes fires inside but
    // handleMessage itself is sync — received is populated synchronously.
    expect(received).toHaveLength(1);
    expect(received[0].type).toBe('resource.bytes');
  });

  it('resource.bytes without registered service: no throw, no envelope emitted (silent drop)', () => {
    const ctx2 = createMockRuntimeAdapter();
    const runtime2 = createRuntime(ctx2.hooks);
    runtime2.sessionRegistry.register(WINDOW_ID, makeSessionEntry(WINDOW_ID));
    // Pre-grant resource:fetch so the ACL gate passes — isolates the registerNap check
    runtime2.aclState.grant('', TEST_DTAG, TEST_HASH, 'resource:fetch');

    // No registerService('resource', ...) call — tests the silent-drop path
    expect(() => {
      runtime2.handleMessage(WINDOW_ID, {
        type: 'resource.bytes',
        requestId: 'r2',
        url: 'http://localhost:5174/data',
      } as NappletMessage);
    }).not.toThrow();

    expect(ctx2.sent).toHaveLength(0);
  });

  it('unknown NAP domain: dispatch returns false, no envelope emitted (NIP-5D silent drop)', () => {
    const ctx2 = createMockRuntimeAdapter();
    const runtime2 = createRuntime(ctx2.hooks);
    runtime2.sessionRegistry.register(WINDOW_ID, makeSessionEntry(WINDOW_ID));

    runtime2.handleMessage(WINDOW_ID, { type: 'bogus.action', id: 'req-x' } as NappletMessage);

    // Unknown domain — dispatch() returns false; runtime must NOT emit any envelope
    // (no .error, no .result). Matches pre-existing NIP-5D silent-drop behavior.
    expect(ctx2.sent).toHaveLength(0);
  });
});
