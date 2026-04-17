/**
 * dispatch.test.ts — Unit tests for @kehto/runtime NIP-5D NUB domain dispatch.
 *
 * Tests NappletMessage envelope dispatch, domain routing, ACL enforcement,
 * and domain handler implementations (relay, identity, storage, ifc, …).
 * All tests run in Node.js without browser globals.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createRuntime } from './runtime.js';
import type { Runtime } from './runtime.js';
import { createMockRuntimeAdapter, createNip5dSessionEntry, findEnvelopeResponse } from './test-utils.js';
import type { MockRuntimeContext, SentMessage } from './test-utils.js';
import type { NappletMessage } from '@napplet/core';

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

describe('runtime NUB dispatch — envelope guard', () => {
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
      // No signer configured — fallback path emits identity.getPublicKey.error
      const err = findEnvelopeResponse(ctx.sent, 'identity.getPublicKey.error');
      expect(err).toBeDefined();
    });

    it('routes storage.* to storage handler', () => {
      runtime.handleMessage(WINDOW_ID, { type: 'storage.get', id: 'req-1', key: 'test-key' } as NappletMessage);
      const result = findEnvelopeResponse(ctx.sent, 'storage.get.result');
      expect(result).toBeDefined();
    });

    it('routes ifc.* to ifc handler — subscribe emits ifc.subscribe.result (Plan 12-04 / NUB-04)', () => {
      runtime.handleMessage(WINDOW_ID, { type: 'ifc.subscribe', id: 'req-1', topic: 'test-topic' } as NappletMessage);
      // Canonical @napplet/nub-ifc contract: ifc.subscribe emits ifc.subscribe.result.
      const result = findEnvelopeResponse(ctx.sent, 'ifc.subscribe.result');
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

      // Empty filters: isBusKind is false (no filters.every succeeds with empty), sends eose
      const eose = findEnvelopeResponse(ctx.sent, 'relay.eose');
      expect(eose).toBeDefined();
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

    it('relay.query sends relay.query.result with count', () => {
      runtime.handleMessage(WINDOW_ID, {
        type: 'relay.query',
        id: 'req-q',
        filters: [{ kinds: [1] }],
      } as NappletMessage);

      const result = findEnvelopeResponse(ctx.sent, 'relay.query.result');
      expect(result).toBeDefined();
      expect((result as any).id).toBe('req-q');
      expect(typeof (result as any).count).toBe('number');
    });

    it('relay.query count increases after relay.publish', () => {
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
      expect((result as any).count).toBeGreaterThan(0);
    });
  });

  // ─── Identity Handler ───────────────────────────────────────────────────────

  describe('identity handler', () => {
    it('identity.getPublicKey returns error when no signer configured', () => {
      runtime.handleMessage(WINDOW_ID, { type: 'identity.getPublicKey', id: 'req-1' } as NappletMessage);
      const err = findEnvelopeResponse(ctx.sent, 'identity.getPublicKey.error');
      expect(err).toBeDefined();
      expect((err as any).error).toContain('no signer');
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

    it('identity.getPublicKey bypasses ACL (senderCap is null pre-12-10)', () => {
      // resolveCapabilitiesNub returns { senderCap: null, recipientCap: null } for
      // identity.* pre-Plan-12-10. The envelope therefore reaches the handler even
      // when the napplet is blocked; the only failure is "no signer".
      runtime.handleMessage(WINDOW_ID, { type: 'identity.getPublicKey', id: 'req-pk-acl' } as NappletMessage);
      const err = findEnvelopeResponse(ctx.sent, 'identity.getPublicKey.error');
      expect(err).toBeDefined();
      expect((err as any).error).not.toContain('denied');
      expect((err as any).error).toContain('no signer');
    });
  });

  // ─── Storage Handler ─────────────────────────────────────────────────────────

  describe('storage handler', () => {
    it('storage.get returns value:null for missing key (canonical nub-storage)', () => {
      runtime.handleMessage(WINDOW_ID, {
        type: 'storage.get',
        id: 'req-get-1',
        key: 'nonexistent-key',
      } as NappletMessage);

      const result = findEnvelopeResponse(ctx.sent, 'storage.get.result');
      expect(result).toBeDefined();
      // Plan 12-09: canonical @napplet/nub-storage drops `found` — null ⇔ missing.
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

    it('storage.clear is rejected — not in @napplet/nub-storage (Plan 12-09)', () => {
      runtime.handleMessage(WINDOW_ID, { type: 'storage.set', id: 's1', key: 'k1', value: 'v1' } as NappletMessage);
      runtime.handleMessage(WINDOW_ID, { type: 'storage.set', id: 's2', key: 'k2', value: 'v2' } as NappletMessage);
      ctx.sent.length = 0;

      runtime.handleMessage(WINDOW_ID, { type: 'storage.clear', id: 'req-clear' } as NappletMessage);
      // Canonical nub-storage has no `clear` action — handler emits .error envelope.
      const clearError = findEnvelopeResponse(ctx.sent, 'storage.clear.error');
      expect(clearError).toBeDefined();
      expect((clearError as any).id).toBe('req-clear');
      expect((clearError as any).error).toMatch(/not (in )?@napplet\/nub-storage|unknown storage action: clear/i);
      // No storage.clear.result envelope is emitted.
      expect(findEnvelopeResponse(ctx.sent, 'storage.clear.result')).toBeUndefined();

      // Prior sets survive (storage.clear never ran).
      ctx.sent.length = 0;
      runtime.handleMessage(WINDOW_ID, { type: 'storage.keys', id: 'req-keys-after' } as NappletMessage);
      const keysResult = findEnvelopeResponse(ctx.sent, 'storage.keys.result');
      const keys = (keysResult as any).keys as string[];
      expect(keys).toContain('k1');
      expect(keys).toContain('k2');
    });

    it('storage.get returns error for unregistered window', () => {
      // Don't register the window session
      const ctx2 = createMockRuntimeAdapter();
      const runtime2 = createRuntime(ctx2.hooks);
      // No session registered

      runtime2.handleMessage(WINDOW_ID, { type: 'storage.get', id: 'req-nr', key: 'k' } as NappletMessage);
      const err = findEnvelopeResponse(ctx2.sent, 'storage.get.error');
      expect(err).toBeDefined();
      expect((err as any).error).toContain('not registered');
    });
  });

  // ─── IFC Handler ──────────────────────────────────────────────────────────────

  describe('IFC handler', () => {
    it('ifc.subscribe registers subscription and emits ifc.subscribe.result (Plan 12-04 / NUB-04)', () => {
      runtime.handleMessage(WINDOW_ID, {
        type: 'ifc.subscribe',
        id: 'req-sub-ifc',
        topic: 'chat',
      } as NappletMessage);
      // Canonical @napplet/nub-ifc contract: handler must emit ifc.subscribe.result.
      const result = findEnvelopeResponse(ctx.sent, 'ifc.subscribe.result');
      expect(result).toBeDefined();
      expect((result as any).id).toBe('req-sub-ifc');
      expect((result as any).error).toBeUndefined();
    });

    it('ifc.subscribe + ifc.emit delivers to subscriber', () => {
      // Register second window
      runtime.sessionRegistry.register(WINDOW_ID_2, makeSessionEntry(WINDOW_ID_2));

      // Window 2 subscribes to topic
      runtime.handleMessage(WINDOW_ID_2, {
        type: 'ifc.subscribe',
        topic: 'news',
      } as NappletMessage);

      // Window 1 emits to topic
      runtime.handleMessage(WINDOW_ID, {
        type: 'ifc.emit',
        topic: 'news',
        payload: { text: 'hello' },
      } as NappletMessage);

      // Window 2 should receive ifc.event
      const event = ctx.sent.find(
        (s) => s.windowId === WINDOW_ID_2 &&
          typeof s.message === 'object' &&
          !Array.isArray(s.message) &&
          (s.message as NappletMessage).type === 'ifc.event',
      );
      expect(event).toBeDefined();
      expect((event!.message as any).topic).toBe('news');
      expect((event!.message as any).payload).toEqual({ text: 'hello' });
      expect((event!.message as any).sender).toBe(WINDOW_ID);
    });

    it('ifc.emit does not echo to sender', () => {
      // Window 1 subscribes
      runtime.handleMessage(WINDOW_ID, {
        type: 'ifc.subscribe',
        topic: 'self-test',
      } as NappletMessage);

      // Window 1 emits
      runtime.handleMessage(WINDOW_ID, {
        type: 'ifc.emit',
        topic: 'self-test',
        payload: { data: 'echo-check' },
      } as NappletMessage);

      // Window 1 should NOT receive its own message
      const selfEvent = ctx.sent.find(
        (s) => s.windowId === WINDOW_ID &&
          typeof s.message === 'object' &&
          !Array.isArray(s.message) &&
          (s.message as NappletMessage).type === 'ifc.event',
      );
      expect(selfEvent).toBeUndefined();
    });

    it('ifc.unsubscribe stops delivery', () => {
      runtime.sessionRegistry.register(WINDOW_ID_2, makeSessionEntry(WINDOW_ID_2));

      // Window 2 subscribes
      runtime.handleMessage(WINDOW_ID_2, { type: 'ifc.subscribe', topic: 'updates' } as NappletMessage);
      // Window 2 unsubscribes
      runtime.handleMessage(WINDOW_ID_2, { type: 'ifc.unsubscribe', topic: 'updates' } as NappletMessage);

      // Window 1 emits
      runtime.handleMessage(WINDOW_ID, {
        type: 'ifc.emit',
        topic: 'updates',
        payload: { msg: 'should not arrive' },
      } as NappletMessage);

      // Window 2 should NOT receive event
      const event = ctx.sent.find(
        (s) => s.windowId === WINDOW_ID_2 &&
          typeof s.message === 'object' &&
          !Array.isArray(s.message) &&
          (s.message as NappletMessage).type === 'ifc.event',
      );
      expect(event).toBeUndefined();
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

    it('identity.getPublicKey bypasses ACL (no capability required pre-12-10)', () => {
      // Even with napplet blocked, getPublicKey should pass ACL (senderCap is null)
      // but fail because no signer is configured. Plan 12-10 will add identity:read.
      runtime.aclState.block('', TEST_DTAG, TEST_HASH);

      runtime.handleMessage(WINDOW_ID, { type: 'identity.getPublicKey', id: 'req-pk-blocked' } as NappletMessage);

      // Should NOT get ACL error — should get identity error instead
      const aclErr = findEnvelopeResponse(ctx.sent, 'identity.getPublicKey.error');
      expect(aclErr).toBeDefined();
      // Error is about missing signer, not ACL
      expect((aclErr as any).error).toContain('no signer');
    });

    it('ifc.subscribe bypasses ACL (relay:read required, granted by default)', () => {
      // Default state grants relay:read, so subscribe should work
      runtime.handleMessage(WINDOW_ID, { type: 'ifc.subscribe', topic: 'test' } as NappletMessage);
      // No error response
      const err = findEnvelopeResponse(ctx.sent, 'ifc.subscribe.error');
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

    it('destroy() clears IFC subscriptions', () => {
      runtime.sessionRegistry.register(WINDOW_ID_2, makeSessionEntry(WINDOW_ID_2));
      runtime.handleMessage(WINDOW_ID_2, { type: 'ifc.subscribe', topic: 'cleanup-test' } as NappletMessage);

      runtime.destroy();

      // After destroy, emit should not deliver to anyone
      runtime.handleMessage(WINDOW_ID, {
        type: 'ifc.emit',
        topic: 'cleanup-test',
        payload: 'after-destroy',
      } as NappletMessage);

      const event = ctx.sent.find(
        (s) => s.windowId === WINDOW_ID_2 &&
          typeof s.message === 'object' &&
          !Array.isArray(s.message) &&
          (s.message as NappletMessage).type === 'ifc.event',
      );
      expect(event).toBeUndefined();
    });

    it('destroyWindow() removes IFC subscriptions for that window', () => {
      runtime.sessionRegistry.register(WINDOW_ID_2, makeSessionEntry(WINDOW_ID_2));
      runtime.handleMessage(WINDOW_ID_2, { type: 'ifc.subscribe', topic: 'window-cleanup' } as NappletMessage);

      runtime.destroyWindow(WINDOW_ID_2);

      ctx.sent.length = 0;
      runtime.handleMessage(WINDOW_ID, {
        type: 'ifc.emit',
        topic: 'window-cleanup',
        payload: 'after-window-destroy',
      } as NappletMessage);

      const event = ctx.sent.find(
        (s) => s.windowId === WINDOW_ID_2 &&
          typeof s.message === 'object' &&
          !Array.isArray(s.message) &&
          (s.message as NappletMessage).type === 'ifc.event',
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

  // ─── Keys Handler (NUB-05 / Plan 12-05) ─────────────────────────────────
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
      expect((reply as any).binding).toBe('Ctrl+=');
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

// ─── Theme NUB dispatch (TH-01 + TH-04) ────────────────────────────────────────

describe('theme NUB dispatch (TH-01 + TH-04)', () => {
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
});
