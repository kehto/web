/**
 * identity-service.test.ts — Unit tests for the NIP-5D identity NUB service.
 *
 * Covers the full 9-action request -> result round-trip plus an ACL-denial
 * envelope shape assertion. getPublicKey/getRelays exercise the stub signer;
 * the other 7 actions assert the default/empty result payloads that the
 * reference service ships.
 */

declare function setTimeout(cb: () => void, ms?: number): unknown;

import { describe, it, expect } from 'vitest';
import { createIdentityService } from './identity-service.js';
import type { HostDecryptBridge, Rumor } from './identity-service.js';
import type { NappletMessage, NostrEvent } from '@napplet/core';
import type { Signer } from '@kehto/runtime';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const WINDOW_ID = 'win-test-1';
const SENDER_PUBKEY = 'a'.repeat(64);
const SEAL_PUBKEY = 'b'.repeat(64);

function makeIdentityMessage(type: string, fields: Record<string, unknown> = {}): NappletMessage {
  return { type, id: 'corr-1', ...fields } as NappletMessage;
}

function makeEvent(overrides: Partial<NostrEvent> = {}): NostrEvent {
  return {
    id: 'e'.repeat(64),
    pubkey: SENDER_PUBKEY,
    created_at: 123,
    kind: 4,
    tags: [],
    content: 'ciphertext',
    sig: 'f'.repeat(128),
    ...overrides,
  };
}

function makeRumor(overrides: Partial<Rumor> = {}): Rumor {
  return {
    id: 'r'.repeat(64),
    pubkey: SEAL_PUBKEY,
    created_at: 456,
    kind: 14,
    tags: [],
    content: 'gift plaintext',
    ...overrides,
  };
}

function createMockSigner(): Signer & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    getPublicKey() {
      calls.push('getPublicKey');
      return 'test-pubkey-' + 'a'.repeat(52);
    },
    getRelays() {
      calls.push('getRelays');
      return { 'wss://relay.example.com': { read: true, write: true } };
    },
  };
}

function createMockDecryptor(
  overrides: Partial<HostDecryptBridge> = {},
): HostDecryptBridge & { calls: string[] } {
  const calls: string[] = [];
  const bridge: HostDecryptBridge & { calls: string[] } = {
    calls,
    async nip04Decrypt(_senderPubkey: string, _ciphertext: string) {
      calls.push('nip04Decrypt');
      return 'nip04 plaintext';
    },
    async nip44Decrypt(_senderPubkey: string, _ciphertext: string) {
      calls.push('nip44Decrypt');
      return 'nip44 plaintext';
    },
    async unwrapGiftWrap(_wrap: NostrEvent) {
      calls.push('unwrapGiftWrap');
      const rumor = makeRumor();
      return {
        seal: makeEvent({ id: 's'.repeat(64), kind: 13, pubkey: rumor.pubkey }),
        rumor,
      };
    },
    ...overrides,
  };
  return bridge;
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
      // not an error. The nub-identity shim only handles .result; .error would hang the
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

  describe('identity.decrypt', () => {
    it('decrypts NIP-04 events after verifying the outer signature', async () => {
      const calls: string[] = [];
      const decryptor = createMockDecryptor({
        async nip04Decrypt(senderPubkey, ciphertext) {
          calls.push(`nip04:${senderPubkey}:${ciphertext}`);
          return 'clear nip04';
        },
      });
      const service = createIdentityService({
        getSigner: () => null,
        getDecryptor: () => decryptor,
        verifyEvent: async () => {
          calls.push('verify');
          return true;
        },
      });
      const sent: NappletMessage[] = [];

      service.handleMessage(
        WINDOW_ID,
        makeIdentityMessage('identity.decrypt', {
          id: 'corr-nip04',
          event: makeEvent({ kind: 4, content: 'cipher-04', created_at: 321 }),
        }),
        (msg) => { sent.push(msg); },
      );
      await nextTick();

      expect(calls).toEqual(['verify', `nip04:${SENDER_PUBKEY}:cipher-04`]);
      expect(sent).toHaveLength(1);
      expect(sent[0].type).toBe('identity.decrypt.result');
      expect((sent[0] as any).id).toBe('corr-nip04');
      expect((sent[0] as any).sender).toBe(SENDER_PUBKEY);
      expect((sent[0] as any).rumor.content).toBe('clear nip04');
      expect((sent[0] as any).rumor.created_at).toBe(321);
    });

    it('decrypts NIP-44 direct events by kind 14', async () => {
      let called = false;
      const decryptor = createMockDecryptor({
        async nip44Decrypt(senderPubkey, ciphertext) {
          called = true;
          expect(senderPubkey).toBe(SENDER_PUBKEY);
          expect(ciphertext).toBe('cipher-44');
          return 'clear nip44';
        },
      });
      const service = createIdentityService({
        getSigner: () => null,
        getDecryptor: () => decryptor,
        verifyEvent: () => true,
      });
      const sent: NappletMessage[] = [];

      service.handleMessage(
        WINDOW_ID,
        makeIdentityMessage('identity.decrypt', {
          id: 'corr-nip44',
          event: makeEvent({ kind: 14, content: 'cipher-44' }),
        }),
        (msg) => { sent.push(msg); },
      );
      await nextTick();

      expect(sent[0].type).toBe('identity.decrypt.result');
      expect((sent[0] as any).id).toBe('corr-nip44');
      expect((sent[0] as any).rumor.content).toBe('clear nip44');
      expect(called).toBe(true);
    });

    it('decrypts NIP-44 direct events by version-byte content detection', async () => {
      const decryptor = createMockDecryptor();
      const service = createIdentityService({
        getSigner: () => null,
        getDecryptor: () => decryptor,
        verifyEvent: () => true,
      });
      const sent: NappletMessage[] = [];

      service.handleMessage(
        WINDOW_ID,
        makeIdentityMessage('identity.decrypt', {
          id: 'corr-nip44-byte',
          event: makeEvent({ kind: 1, content: 'Ag==' }),
        }),
        (msg) => { sent.push(msg); },
      );
      await nextTick();

      expect(sent[0].type).toBe('identity.decrypt.result');
      expect((sent[0] as any).rumor.content).toBe('nip44 plaintext');
      expect(decryptor.calls).toContain('nip44Decrypt');
    });

    it('decrypts NIP-17 gift wraps and hides the outer created_at', async () => {
      const rumor = makeRumor({ created_at: 777, content: 'gift clear' });
      const decryptor = createMockDecryptor({
        async unwrapGiftWrap() {
          return {
            seal: makeEvent({ id: 's'.repeat(64), kind: 13, pubkey: rumor.pubkey, created_at: 888 }),
            rumor,
          };
        },
      });
      const service = createIdentityService({
        getSigner: () => null,
        getDecryptor: () => decryptor,
        verifyEvent: () => true,
      });
      const sent: NappletMessage[] = [];

      service.handleMessage(
        WINDOW_ID,
        makeIdentityMessage('identity.decrypt', {
          id: 'corr-nip17',
          event: makeEvent({ kind: 1059, created_at: 999 }),
        }),
        (msg) => { sent.push(msg); },
      );
      await nextTick();

      expect(sent[0].type).toBe('identity.decrypt.result');
      expect((sent[0] as any).sender).toBe(rumor.pubkey);
      expect((sent[0] as any).rumor.content).toBe('gift clear');
      expect((sent[0] as any).rumor.created_at).toBe(777);
      expect((sent[0] as any).rumor.created_at).not.toBe(999);
    });

    it('rejects NIP-17 impersonation mismatches', async () => {
      const decryptor = createMockDecryptor({
        async unwrapGiftWrap() {
          return {
            seal: makeEvent({ id: 's'.repeat(64), kind: 13, pubkey: 'c'.repeat(64) }),
            rumor: makeRumor({ pubkey: 'd'.repeat(64) }),
          };
        },
      });
      const service = createIdentityService({
        getSigner: () => null,
        getDecryptor: () => decryptor,
        verifyEvent: () => true,
      });
      const sent: NappletMessage[] = [];

      service.handleMessage(
        WINDOW_ID,
        makeIdentityMessage('identity.decrypt', { event: makeEvent({ kind: 1059 }) }),
        (msg) => { sent.push(msg); },
      );
      await nextTick();

      expect(sent[0].type).toBe('identity.decrypt.error');
      expect((sent[0] as any).error).toBe('impersonation');
    });

    it('returns malformed-wrap when verifyEvent fails before bridge invocation', async () => {
      let getDecryptorCalls = 0;
      const service = createIdentityService({
        getSigner: () => null,
        getDecryptor: () => {
          getDecryptorCalls += 1;
          return createMockDecryptor();
        },
        verifyEvent: () => false,
      });
      const sent: NappletMessage[] = [];

      service.handleMessage(
        WINDOW_ID,
        makeIdentityMessage('identity.decrypt', { event: makeEvent({ kind: 4 }) }),
        (msg) => { sent.push(msg); },
      );
      await nextTick();

      expect(sent[0].type).toBe('identity.decrypt.error');
      expect((sent[0] as any).error).toBe('malformed-wrap');
      expect(getDecryptorCalls).toBe(0);
    });

    it('returns signer-unavailable when no decrypt bridge is configured', async () => {
      const service = createIdentityService({
        getSigner: () => null,
        verifyEvent: () => true,
      });
      const sent: NappletMessage[] = [];

      service.handleMessage(
        WINDOW_ID,
        makeIdentityMessage('identity.decrypt', { event: makeEvent({ kind: 4 }) }),
        (msg) => { sent.push(msg); },
      );
      await nextTick();

      expect(sent[0].type).toBe('identity.decrypt.error');
      expect((sent[0] as any).error).toBe('signer-unavailable');
    });

    it('returns unsupported-encryption for unknown event shape', async () => {
      const service = createIdentityService({
        getSigner: () => null,
        getDecryptor: () => createMockDecryptor(),
        verifyEvent: () => true,
      });
      const sent: NappletMessage[] = [];

      service.handleMessage(
        WINDOW_ID,
        makeIdentityMessage('identity.decrypt', { event: makeEvent({ kind: 1, content: 'not encrypted' }) }),
        (msg) => { sent.push(msg); },
      );
      await nextTick();

      expect(sent[0].type).toBe('identity.decrypt.error');
      expect((sent[0] as any).error).toBe('unsupported-encryption');
    });

    it('returns malformed-wrap for malformed event payloads', async () => {
      const service = createIdentityService({
        getSigner: () => null,
        getDecryptor: () => createMockDecryptor(),
        verifyEvent: () => true,
      });
      const sent: NappletMessage[] = [];

      service.handleMessage(
        WINDOW_ID,
        makeIdentityMessage('identity.decrypt', { event: { kind: 4 } }),
        (msg) => { sent.push(msg); },
      );
      await nextTick();

      expect(sent[0].type).toBe('identity.decrypt.error');
      expect((sent[0] as any).error).toBe('malformed-wrap');
    });

    it.each([
      'class-forbidden',
      'signer-denied',
      'signer-unavailable',
      'decrypt-failed',
      'malformed-wrap',
      'impersonation',
      'unsupported-encryption',
      'policy-denied',
    ] as const)('maps bridge-thrown typed error %s to identity.decrypt.error', async (code) => {
      const service = createIdentityService({
        getSigner: () => null,
        getDecryptor: () => createMockDecryptor({
          async nip04Decrypt() {
            throw { error: code };
          },
        }),
        verifyEvent: () => true,
      });
      const sent: NappletMessage[] = [];

      service.handleMessage(
        WINDOW_ID,
        makeIdentityMessage('identity.decrypt', { event: makeEvent({ kind: 4 }) }),
        (msg) => { sent.push(msg); },
      );
      await nextTick();

      expect(sent[0].type).toBe('identity.decrypt.error');
      expect((sent[0] as any).error).toBe(code);
    });
  });

  describe('ACL denial envelope shape', () => {
    // NOTE: The real ACL gate lives in @kehto/acl's resolveCapabilitiesNub and
    // runs in the runtime BEFORE the service is invoked (Plan 12-10 adds the
    // identity:read capability mapping). This test asserts the shape of the
    // denial envelope the runtime would emit — it does NOT exercise the real
    // ACL path end-to-end. TODO(12-10): migrate this to a runtime-level
    // integration test once resolveCapabilitiesNub covers identity.*.
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
