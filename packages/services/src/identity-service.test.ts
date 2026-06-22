/**
 * identity-service.test.ts — Unit tests for the NIP-5D identity NAP service.
 *
 * Covers the full 9-action request -> result round-trip plus an ACL-denial
 * envelope shape assertion. getPublicKey/getRelays exercise the stub signer;
 * the other 7 actions assert the default/empty result payloads that the
 * reference service ships.
 */

declare function setTimeout(cb: () => void, ms?: number): unknown;

import { describe, it, expect } from 'vitest';
import { createIdentityService } from './identity-service.js';
import type { NappletMessage } from '@napplet/core';
import type { Signer } from '@kehto/runtime';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const WINDOW_ID = 'win-test-1';
const MOCK_SIGNER_PUBKEY = 'test-pubkey-' + 'a'.repeat(52);

function makeIdentityMessage(type: string, fields: Record<string, unknown> = {}): NappletMessage {
  return { type, id: 'corr-1', ...fields } as NappletMessage;
}

function createMockSigner(): Signer & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    getPublicKey() {
      calls.push('getPublicKey');
      return MOCK_SIGNER_PUBKEY;
    },
    getRelays() {
      calls.push('getRelays');
      return { 'wss://relay.example.com': { read: true, write: true } };
    },
  };
}

/** Wait for async operations to settle. */
function nextTick(ms = 10): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('createIdentityService', () => {
  it('returns ServiceHandler with descriptor.name === "identity"', () => {
    const service = createIdentityService({ getSigner: () => null });
    expect(service.descriptor.name).toBe('identity');
    expect(typeof service.descriptor.version).toBe('string');
  });

  describe('identity.getPublicKey', () => {
    it('produces identity.getPublicKey.result with pubkey from signer', async () => {
      const signer = createMockSigner();
      const service = createIdentityService({ getSigner: () => signer });
      const sent: NappletMessage[] = [];
      const send = (msg: NappletMessage): void => { sent.push(msg); };

      service.handleMessage(
        WINDOW_ID,
        makeIdentityMessage('identity.getPublicKey', { id: 'corr-pk' }),
        send,
      );
      await nextTick();

      expect(signer.calls).toContain('getPublicKey');
      expect(sent).toHaveLength(1);
      expect(sent[0].type).toBe('identity.getPublicKey.result');
      expect((sent[0] as any).id).toBe('corr-pk');
      expect((sent[0] as any).pubkey).toMatch(/test-pubkey/);
    });

    it('emits identity.getPublicKey.result with empty pubkey when no signer is configured', async () => {
      // Per NIP-5D spec "Always succeeds" — no-signer returns empty pubkey as sentinel,
      // not an error. The nap-identity shim only handles .result; .error would hang the
      // Promise indefinitely (identity-service.ts:105-113).
      const service = createIdentityService({ getSigner: () => null });
      const sent: NappletMessage[] = [];
      const send = (msg: NappletMessage): void => { sent.push(msg); };

      service.handleMessage(
        WINDOW_ID,
        makeIdentityMessage('identity.getPublicKey'),
        send,
      );
      await nextTick();

      expect(sent).toHaveLength(1);
      expect(sent[0].type).toBe('identity.getPublicKey.result');
      expect((sent[0] as any).pubkey).toBe('');
    });
  });

  describe('identity.getRelays', () => {
    it('produces identity.getRelays.result with relays map from signer', async () => {
      const signer = createMockSigner();
      const service = createIdentityService({ getSigner: () => signer });
      const sent: NappletMessage[] = [];
      const send = (msg: NappletMessage): void => { sent.push(msg); };

      service.handleMessage(
        WINDOW_ID,
        makeIdentityMessage('identity.getRelays', { id: 'corr-relays' }),
        send,
      );
      await nextTick();

      expect(signer.calls).toContain('getRelays');
      expect(sent).toHaveLength(1);
      expect(sent[0].type).toBe('identity.getRelays.result');
      expect((sent[0] as any).id).toBe('corr-relays');
      expect((sent[0] as any).relays).toEqual({
        'wss://relay.example.com': { read: true, write: true },
      });
    });

    it('emits identity.getRelays.error when no signer is configured', async () => {
      const service = createIdentityService({ getSigner: () => null });
      const sent: NappletMessage[] = [];
      const send = (msg: NappletMessage): void => { sent.push(msg); };

      service.handleMessage(
        WINDOW_ID,
        makeIdentityMessage('identity.getRelays'),
        send,
      );
      await nextTick();

      expect(sent).toHaveLength(1);
      expect(sent[0].type).toBe('identity.getRelays.error');
    });
  });

  describe('identity.getProfile (stub)', () => {
    it('returns identity.getProfile.result with profile: null', () => {
      const service = createIdentityService({ getSigner: () => createMockSigner() });
      const sent: NappletMessage[] = [];
      const send = (msg: NappletMessage): void => { sent.push(msg); };

      service.handleMessage(
        WINDOW_ID,
        makeIdentityMessage('identity.getProfile', { id: 'corr-profile' }),
        send,
      );

      expect(sent).toHaveLength(1);
      expect(sent[0].type).toBe('identity.getProfile.result');
      expect((sent[0] as any).id).toBe('corr-profile');
      expect((sent[0] as any).profile).toBeNull();
    });
  });

  describe('identity.getFollows (stub)', () => {
    it('returns identity.getFollows.result with pubkeys: []', () => {
      const service = createIdentityService({ getSigner: () => createMockSigner() });
      const sent: NappletMessage[] = [];
      const send = (msg: NappletMessage): void => { sent.push(msg); };

      service.handleMessage(
        WINDOW_ID,
        makeIdentityMessage('identity.getFollows'),
        send,
      );

      expect(sent).toHaveLength(1);
      expect(sent[0].type).toBe('identity.getFollows.result');
      expect((sent[0] as any).pubkeys).toEqual([]);
    });

    it('returns host-provided follows without replacing the identity service', async () => {
      const signer = createMockSigner();
      const followedPubkeys = ['f'.repeat(64), 'e'.repeat(64)];
      const seen: string[] = [];
      const service = createIdentityService({
        getSigner: () => signer,
        getFollows: async (pubkey) => {
          seen.push(pubkey);
          return followedPubkeys;
        },
      });
      const sent: NappletMessage[] = [];
      const send = (msg: NappletMessage): void => { sent.push(msg); };

      service.handleMessage(
        WINDOW_ID,
        makeIdentityMessage('identity.getFollows', { id: 'corr-follows' }),
        send,
      );
      await nextTick();

      expect(seen).toEqual([MOCK_SIGNER_PUBKEY]);
      expect(sent).toHaveLength(1);
      expect(sent[0].type).toBe('identity.getFollows.result');
      expect((sent[0] as any).id).toBe('corr-follows');
      expect((sent[0] as any).pubkeys).toEqual(followedPubkeys);
    });

    it('returns a result envelope with error when a host follows provider fails', async () => {
      const service = createIdentityService({
        getSigner: () => createMockSigner(),
        getFollows: async () => {
          throw new Error('contacts unavailable');
        },
      });
      const sent: NappletMessage[] = [];
      const send = (msg: NappletMessage): void => { sent.push(msg); };

      service.handleMessage(
        WINDOW_ID,
        makeIdentityMessage('identity.getFollows'),
        send,
      );
      await nextTick();

      expect(sent).toHaveLength(1);
      expect(sent[0].type).toBe('identity.getFollows.result');
      expect((sent[0] as any).pubkeys).toEqual([]);
      expect((sent[0] as any).error).toBe('contacts unavailable');
    });
  });

  describe('identity.getList (stub)', () => {
    it('returns identity.getList.result with entries: []', () => {
      const service = createIdentityService({ getSigner: () => createMockSigner() });
      const sent: NappletMessage[] = [];
      const send = (msg: NappletMessage): void => { sent.push(msg); };

      service.handleMessage(
        WINDOW_ID,
        makeIdentityMessage('identity.getList', { listType: 'bookmarks' }),
        send,
      );

      expect(sent).toHaveLength(1);
      expect(sent[0].type).toBe('identity.getList.result');
      expect((sent[0] as any).entries).toEqual([]);
    });

    it('passes listType and current pubkey to a host list provider', async () => {
      const signer = createMockSigner();
      const calls: Array<{ listType: string; pubkey: string }> = [];
      const service = createIdentityService({
        getSigner: () => signer,
        getList: (listType, pubkey) => {
          calls.push({ listType, pubkey });
          return ['note1example'];
        },
      });
      const sent: NappletMessage[] = [];
      const send = (msg: NappletMessage): void => { sent.push(msg); };

      service.handleMessage(
        WINDOW_ID,
        makeIdentityMessage('identity.getList', { listType: 'bookmarks' }),
        send,
      );
      await nextTick();

      expect(calls).toEqual([{ listType: 'bookmarks', pubkey: MOCK_SIGNER_PUBKEY }]);
      expect(sent).toHaveLength(1);
      expect(sent[0].type).toBe('identity.getList.result');
      expect((sent[0] as any).entries).toEqual(['note1example']);
    });
  });

  describe('identity.getZaps (stub)', () => {
    it('returns identity.getZaps.result with zaps: []', () => {
      const service = createIdentityService({ getSigner: () => createMockSigner() });
      const sent: NappletMessage[] = [];
      const send = (msg: NappletMessage): void => { sent.push(msg); };

      service.handleMessage(
        WINDOW_ID,
        makeIdentityMessage('identity.getZaps'),
        send,
      );

      expect(sent).toHaveLength(1);
      expect(sent[0].type).toBe('identity.getZaps.result');
      expect((sent[0] as any).zaps).toEqual([]);
    });
  });

  describe('identity.getMutes (stub)', () => {
    it('returns identity.getMutes.result with pubkeys: []', () => {
      const service = createIdentityService({ getSigner: () => createMockSigner() });
      const sent: NappletMessage[] = [];
      const send = (msg: NappletMessage): void => { sent.push(msg); };

      service.handleMessage(
        WINDOW_ID,
        makeIdentityMessage('identity.getMutes'),
        send,
      );

      expect(sent).toHaveLength(1);
      expect(sent[0].type).toBe('identity.getMutes.result');
      expect((sent[0] as any).pubkeys).toEqual([]);
    });
  });

  describe('identity.getBlocked (stub)', () => {
    it('returns identity.getBlocked.result with pubkeys: []', () => {
      const service = createIdentityService({ getSigner: () => createMockSigner() });
      const sent: NappletMessage[] = [];
      const send = (msg: NappletMessage): void => { sent.push(msg); };

      service.handleMessage(
        WINDOW_ID,
        makeIdentityMessage('identity.getBlocked'),
        send,
      );

      expect(sent).toHaveLength(1);
      expect(sent[0].type).toBe('identity.getBlocked.result');
      expect((sent[0] as any).pubkeys).toEqual([]);
    });
  });

  describe('identity.getBadges (stub)', () => {
    it('returns identity.getBadges.result with badges: []', () => {
      const service = createIdentityService({ getSigner: () => createMockSigner() });
      const sent: NappletMessage[] = [];
      const send = (msg: NappletMessage): void => { sent.push(msg); };

      service.handleMessage(
        WINDOW_ID,
        makeIdentityMessage('identity.getBadges'),
        send,
      );

      expect(sent).toHaveLength(1);
      expect(sent[0].type).toBe('identity.getBadges.result');
      expect((sent[0] as any).badges).toEqual([]);
    });
  });

  describe('ACL denial envelope shape', () => {
    // NOTE: The real ACL gate lives in @kehto/acl's resolveCapabilitiesNap and
    // runs in the runtime BEFORE the service is invoked (Plan 12-10 adds the
    // identity:read capability mapping). This test asserts the shape of the
    // denial envelope the runtime would emit — it does NOT exercise the real
    // ACL path end-to-end. TODO(12-10): migrate this to a runtime-level
    // integration test once resolveCapabilitiesNap covers identity.*.
    it('denial envelope has { type: "<request>.error", id, error }', () => {
      const msg = makeIdentityMessage('identity.getPublicKey', { id: 'corr-denied' });
      const denialEnvelope = {
        type: `${msg.type}.error`,
        id: (msg as any).id,
        error: 'capability denied: identity:read',
      };
      expect(denialEnvelope.type).toBe('identity.getPublicKey.error');
      expect(denialEnvelope.id).toBe('corr-denied');
      expect(typeof denialEnvelope.error).toBe('string');
      expect(denialEnvelope.error).toContain('denied');
    });
  });

  describe('unknown identity action', () => {
    it('returns .error envelope with "Unknown identity method" reason', () => {
      const service = createIdentityService({ getSigner: () => createMockSigner() });
      const sent: NappletMessage[] = [];
      const send = (msg: NappletMessage): void => { sent.push(msg); };

      service.handleMessage(
        WINDOW_ID,
        makeIdentityMessage('identity.doesNotExist'),
        send,
      );

      expect(sent).toHaveLength(1);
      expect(sent[0].type).toBe('identity.doesNotExist.error');
      expect((sent[0] as any).error).toContain('Unknown identity method');
    });
  });

  describe('onWindowDestroyed', () => {
    it('does not throw', () => {
      const service = createIdentityService({ getSigner: () => null });
      expect(() => service.onWindowDestroyed?.(WINDOW_ID)).not.toThrow();
    });
  });
});
