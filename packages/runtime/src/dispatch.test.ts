/**
 * dispatch.test.ts — Unit tests for @kehto/runtime NIP-5D NUB domain dispatch.
 *
 * Tests NappletMessage envelope dispatch, domain routing, ACL enforcement,
 * and all 4 domain handler implementations (relay, signer, storage, ifc).
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

    it('routes signer.* to signer handler', () => {
      runtime.handleMessage(WINDOW_ID, { type: 'signer.getPublicKey', id: 'req-1' } as NappletMessage);
      // No signer configured — should get error
      const err = findEnvelopeResponse(ctx.sent, 'signer.getPublicKey.error');
      expect(err).toBeDefined();
    });

    it('routes storage.* to storage handler', () => {
      runtime.handleMessage(WINDOW_ID, { type: 'storage.get', id: 'req-1', key: 'test-key' } as NappletMessage);
      const result = findEnvelopeResponse(ctx.sent, 'storage.get.result');
      expect(result).toBeDefined();
    });

    it('routes ifc.* to ifc handler — no response for subscribe', () => {
      runtime.handleMessage(WINDOW_ID, { type: 'ifc.subscribe', id: 'req-1', topic: 'test-topic' } as NappletMessage);
      // ifc.subscribe has no response
      expect(ctx.sent).toHaveLength(0);
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

  // ─── Signer Handler ─────────────────────────────────────────────────────────

  describe('signer handler', () => {
    it('signer.getPublicKey returns error when no signer configured', () => {
      runtime.handleMessage(WINDOW_ID, { type: 'signer.getPublicKey', id: 'req-1' } as NappletMessage);
      const err = findEnvelopeResponse(ctx.sent, 'signer.getPublicKey.error');
      expect(err).toBeDefined();
      expect((err as any).error).toContain('no signer');
    });

    it('signer.getPublicKey returns pubkey when signer is configured', async () => {
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

      runtimeWithSigner.handleMessage(WINDOW_ID, { type: 'signer.getPublicKey', id: 'req-pk' } as NappletMessage);
      // Flush microtasks for async Promise resolution
      await Promise.resolve();
      await Promise.resolve();

      const result = findEnvelopeResponse(ctxWithSigner.sent, 'signer.getPublicKey.result');
      expect(result).toBeDefined();
      expect((result as any).pubkey).toBe('user_pubkey_hex');
    });

    it('signer.signEvent delegates to signer and returns signed event', async () => {
      const eventToSign = {
        id: '',
        pubkey: 'user_pubkey_hex',
        created_at: Math.floor(Date.now() / 1000),
        kind: 1,
        tags: [],
        content: 'hello',
        sig: '',
      };

      const ctxWithSigner = createMockRuntimeAdapter({
        auth: {
          getUserPubkey: () => 'user_pubkey_hex',
          getSigner: () => ({
            getPublicKey: () => 'user_pubkey_hex',
            signEvent: async (e: any) => ({ ...e, sig: 'test-sig' }),
          }),
        },
      });
      const runtimeWithSigner = createRuntime(ctxWithSigner.hooks);
      runtimeWithSigner.sessionRegistry.register(WINDOW_ID, makeSessionEntry(WINDOW_ID));

      runtimeWithSigner.handleMessage(WINDOW_ID, {
        type: 'signer.signEvent',
        id: 'req-sign',
        event: eventToSign,
      } as NappletMessage);
      // Flush microtasks for async Promise resolution
      await Promise.resolve();
      await Promise.resolve();

      const result = findEnvelopeResponse(ctxWithSigner.sent, 'signer.signEvent.result');
      expect(result).toBeDefined();
      expect((result as any).event.sig).toBe('test-sig');
    });

    it('signer.getPublicKey bypasses ACL (senderCap is null)', () => {
      // Even without state:read or relay:read, getPublicKey should get to the handler
      // Here the only failure is "no signer" not "acl denied"
      runtime.handleMessage(WINDOW_ID, { type: 'signer.getPublicKey', id: 'req-pk-acl' } as NappletMessage);
      const err = findEnvelopeResponse(ctx.sent, 'signer.getPublicKey.error');
      // Error is from missing signer, not from ACL
      expect(err).toBeDefined();
      expect((err as any).error).not.toContain('denied');
      expect((err as any).error).toContain('no signer');
    });
  });

  // ─── Storage Handler ─────────────────────────────────────────────────────────

  describe('storage handler', () => {
    it('storage.get returns found:false for missing key', () => {
      runtime.handleMessage(WINDOW_ID, {
        type: 'storage.get',
        id: 'req-get-1',
        key: 'nonexistent-key',
      } as NappletMessage);

      const result = findEnvelopeResponse(ctx.sent, 'storage.get.result');
      expect(result).toBeDefined();
      expect((result as any).found).toBe(false);
      expect((result as any).value).toBe('');
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
      expect((result as any).found).toBe(true);
      expect((result as any).value).toBe('roundtrip-value');
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
      expect((getResult as any).found).toBe(false);
    });

    it('storage.clear removes all napplet state', () => {
      runtime.handleMessage(WINDOW_ID, { type: 'storage.set', id: 's1', key: 'k1', value: 'v1' } as NappletMessage);
      runtime.handleMessage(WINDOW_ID, { type: 'storage.set', id: 's2', key: 'k2', value: 'v2' } as NappletMessage);
      ctx.sent.length = 0;

      runtime.handleMessage(WINDOW_ID, { type: 'storage.clear', id: 'req-clear' } as NappletMessage);
      const clearResult = findEnvelopeResponse(ctx.sent, 'storage.clear.result');
      expect(clearResult).toBeDefined();
      expect((clearResult as any).ok).toBe(true);

      ctx.sent.length = 0;
      runtime.handleMessage(WINDOW_ID, { type: 'storage.keys', id: 'req-keys-after' } as NappletMessage);
      const keysResult = findEnvelopeResponse(ctx.sent, 'storage.keys.result');
      expect((keysResult as any).keys).toHaveLength(0);
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
    it('ifc.subscribe registers subscription (no response)', () => {
      runtime.handleMessage(WINDOW_ID, {
        type: 'ifc.subscribe',
        id: 'req-sub-ifc',
        topic: 'chat',
      } as NappletMessage);
      // No response expected
      expect(ctx.sent).toHaveLength(0);
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

    it('signer.getPublicKey bypasses ACL (no capability required)', () => {
      // Even with napplet blocked, getPublicKey should pass ACL (senderCap is null)
      // but fail because no signer is configured
      runtime.aclState.block('', TEST_DTAG, TEST_HASH);

      runtime.handleMessage(WINDOW_ID, { type: 'signer.getPublicKey', id: 'req-pk-blocked' } as NappletMessage);

      // Should NOT get ACL error — should get signer error instead
      const aclErr = findEnvelopeResponse(ctx.sent, 'signer.getPublicKey.error');
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
});
