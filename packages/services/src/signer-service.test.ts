/**
 * signer-service.test.ts — Unit tests for the signer service.
 *
 * Tests NIP-5D envelope format: all operations use typed NappletMessage
 * inputs and expect typed result/error responses.
 */

declare function setTimeout(cb: () => void, ms?: number): unknown;

import { describe, it, expect } from 'vitest';
import { createSignerService } from './signer-service.js';
import type { NappletMessage, NostrEvent } from '@napplet/core';
import type { Signer } from '@kehto/runtime';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const WINDOW_ID = 'win-test-1';

function makeSignerMessage(type: string, fields: Record<string, unknown> = {}): NappletMessage {
  return { type, id: 'corr-1', ...fields } as NappletMessage;
}

function createMockSigner(): Signer & {
  calls: string[];
} {
  const calls: string[] = [];
  return {
    calls,
    getPublicKey() {
      calls.push('getPublicKey');
      return 'test-pubkey-' + 'a'.repeat(52);
    },
    async signEvent(event: NostrEvent) {
      calls.push('signEvent');
      return { ...event, sig: 's'.repeat(128) };
    },
    getRelays() {
      calls.push('getRelays');
      return { 'wss://relay.example.com': { read: true, write: true } };
    },
    nip04: {
      async encrypt(_pubkey: string, plaintext: string) {
        calls.push('nip04.encrypt');
        return `encrypted:${plaintext}`;
      },
      async decrypt(_pubkey: string, ciphertext: string) {
        calls.push('nip04.decrypt');
        return `decrypted:${ciphertext}`;
      },
    },
    nip44: {
      async encrypt(_pubkey: string, plaintext: string) {
        calls.push('nip44.encrypt');
        return `encrypted44:${plaintext}`;
      },
      async decrypt(_pubkey: string, ciphertext: string) {
        calls.push('nip44.decrypt');
        return `decrypted44:${ciphertext}`;
      },
    },
  };
}

/** Wait for async operations to settle. */
function nextTick(ms = 10): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('createSignerService', () => {
  it('returns ServiceHandler with correct descriptor', () => {
    const service = createSignerService({ getSigner: () => null });
    expect(service.descriptor).toEqual({
      name: 'signer',
      version: '1.0.0',
      description: 'NIP-07 compatible signer proxy',
    });
  });

  it('returns error when no signer configured', async () => {
    const service = createSignerService({ getSigner: () => null });
    const sent: NappletMessage[] = [];
    const send = (msg: NappletMessage): void => { sent.push(msg); };

    service.handleMessage(WINDOW_ID, makeSignerMessage('signer.getPublicKey'), send);
    await nextTick();

    expect(sent).toHaveLength(1);
    expect(sent[0].type).toBe('signer.getPublicKey.error');
    expect((sent[0] as any).error).toContain('no signer configured');
  });

  it('returns error with matching .error type for any operation', async () => {
    const service = createSignerService({ getSigner: () => null });
    const sent: NappletMessage[] = [];
    const send = (msg: NappletMessage): void => { sent.push(msg); };

    service.handleMessage(WINDOW_ID, makeSignerMessage('signer.signEvent'), send);
    await nextTick();

    expect(sent[0].type).toBe('signer.signEvent.error');
    expect((sent[0] as any).id).toBe('corr-1');
  });

  describe('getPublicKey', () => {
    it('returns pubkey in result envelope', async () => {
      const signer = createMockSigner();
      const service = createSignerService({ getSigner: () => signer });
      const sent: NappletMessage[] = [];
      const send = (msg: NappletMessage): void => { sent.push(msg); };

      service.handleMessage(WINDOW_ID, makeSignerMessage('signer.getPublicKey', { id: 'corr-1' }), send);
      await nextTick();

      expect(sent).toHaveLength(1);
      expect(sent[0].type).toBe('signer.getPublicKey.result');
      expect((sent[0] as any).id).toBe('corr-1');
      expect((sent[0] as any).pubkey).toMatch(/test-pubkey/);
    });
  });

  describe('signEvent', () => {
    it('signs and returns event in result envelope', async () => {
      const signer = createMockSigner();
      const service = createSignerService({ getSigner: () => signer });
      const sent: NappletMessage[] = [];
      const send = (msg: NappletMessage): void => { sent.push(msg); };

      const eventToSign: NostrEvent = {
        id: '', pubkey: 'a'.repeat(64), created_at: 1000, kind: 1, tags: [], content: 'hello', sig: '',
      };
      service.handleMessage(WINDOW_ID, makeSignerMessage('signer.signEvent', { id: 'corr-2', event: eventToSign }), send);
      await nextTick();

      expect(signer.calls).toContain('signEvent');
      expect(sent).toHaveLength(1);
      expect(sent[0].type).toBe('signer.signEvent.result');
      expect((sent[0] as any).id).toBe('corr-2');
      expect((sent[0] as any).event).toBeDefined();
    });

    it('returns error when event is missing', async () => {
      const signer = createMockSigner();
      const service = createSignerService({ getSigner: () => signer });
      const sent: NappletMessage[] = [];
      const send = (msg: NappletMessage): void => { sent.push(msg); };

      service.handleMessage(WINDOW_ID, makeSignerMessage('signer.signEvent', { id: 'corr-3' }), send);
      await nextTick();

      expect(sent[0].type).toBe('signer.signEvent.error');
      expect((sent[0] as any).error).toContain('missing event');
    });
  });

  describe('getRelays', () => {
    it('returns relay config in result envelope', async () => {
      const signer = createMockSigner();
      const service = createSignerService({ getSigner: () => signer });
      const sent: NappletMessage[] = [];
      const send = (msg: NappletMessage): void => { sent.push(msg); };

      service.handleMessage(WINDOW_ID, makeSignerMessage('signer.getRelays', { id: 'corr-4' }), send);
      await nextTick();

      expect(signer.calls).toContain('getRelays');
      expect(sent).toHaveLength(1);
      expect(sent[0].type).toBe('signer.getRelays.result');
      expect((sent[0] as any).relays).toBeDefined();
    });
  });

  describe('nip04', () => {
    it('nip04.encrypt returns ciphertext in result envelope', async () => {
      const signer = createMockSigner();
      const service = createSignerService({ getSigner: () => signer });
      const sent: NappletMessage[] = [];
      const send = (msg: NappletMessage): void => { sent.push(msg); };

      service.handleMessage(WINDOW_ID, makeSignerMessage('signer.nip04.encrypt', { id: 'corr-5', pubkey: 'peer-pubkey', plaintext: 'hello' }), send);
      await nextTick();

      expect(signer.calls).toContain('nip04.encrypt');
      expect(sent[0].type).toBe('signer.nip04.encrypt.result');
      expect((sent[0] as any).ciphertext).toContain('encrypted:hello');
    });

    it('nip04.decrypt returns plaintext in result envelope', async () => {
      const signer = createMockSigner();
      const service = createSignerService({ getSigner: () => signer });
      const sent: NappletMessage[] = [];
      const send = (msg: NappletMessage): void => { sent.push(msg); };

      service.handleMessage(WINDOW_ID, makeSignerMessage('signer.nip04.decrypt', { id: 'corr-6', pubkey: 'peer-pubkey', ciphertext: 'ciphertext' }), send);
      await nextTick();

      expect(signer.calls).toContain('nip04.decrypt');
      expect(sent[0].type).toBe('signer.nip04.decrypt.result');
      expect((sent[0] as any).plaintext).toContain('decrypted:ciphertext');
    });
  });

  describe('nip44', () => {
    it('nip44.encrypt returns ciphertext in result envelope', async () => {
      const signer = createMockSigner();
      const service = createSignerService({ getSigner: () => signer });
      const sent: NappletMessage[] = [];
      const send = (msg: NappletMessage): void => { sent.push(msg); };

      service.handleMessage(WINDOW_ID, makeSignerMessage('signer.nip44.encrypt', { id: 'corr-7', pubkey: 'peer-pubkey', plaintext: 'hello44' }), send);
      await nextTick();

      expect(signer.calls).toContain('nip44.encrypt');
      expect(sent[0].type).toBe('signer.nip44.encrypt.result');
      expect((sent[0] as any).ciphertext).toContain('encrypted44:hello44');
    });

    it('nip44.decrypt returns plaintext in result envelope', async () => {
      const signer = createMockSigner();
      const service = createSignerService({ getSigner: () => signer });
      const sent: NappletMessage[] = [];
      const send = (msg: NappletMessage): void => { sent.push(msg); };

      service.handleMessage(WINDOW_ID, makeSignerMessage('signer.nip44.decrypt', { id: 'corr-8', pubkey: 'peer-pubkey', ciphertext: 'ciphertext44' }), send);
      await nextTick();

      expect(signer.calls).toContain('nip44.decrypt');
      expect(sent[0].type).toBe('signer.nip44.decrypt.result');
      expect((sent[0] as any).plaintext).toContain('decrypted44:ciphertext44');
    });
  });

  describe('unknown method', () => {
    it('returns error envelope for unknown signer type', async () => {
      const signer = createMockSigner();
      const service = createSignerService({ getSigner: () => signer });
      const sent: NappletMessage[] = [];
      const send = (msg: NappletMessage): void => { sent.push(msg); };

      service.handleMessage(WINDOW_ID, makeSignerMessage('signer.unknownMethod', { id: 'corr-9' }), send);
      await nextTick();

      expect(sent).toHaveLength(1);
      expect(sent[0].type).toBe('signer.unknownMethod.error');
      expect((sent[0] as any).error).toContain('Unknown signer method');
    });
  });

  describe('consent gating', () => {
    it('triggers onConsentNeeded for destructive kinds (default list)', async () => {
      const signer = createMockSigner();
      const consentCalls: Array<{ kind: number }> = [];

      const service = createSignerService({
        getSigner: () => signer,
        onConsentNeeded: ({ event, resolve }) => {
          consentCalls.push({ kind: event.kind });
          resolve(true);
        },
      });
      const sent: NappletMessage[] = [];
      const send = (msg: NappletMessage): void => { sent.push(msg); };

      // Kind 0 is a destructive kind
      const eventToSign: NostrEvent = {
        id: '', pubkey: 'a'.repeat(64), created_at: 1000, kind: 0, tags: [], content: '{}', sig: '',
      };
      service.handleMessage(WINDOW_ID, makeSignerMessage('signer.signEvent', { id: 'corr-10', event: eventToSign }), send);
      await nextTick(20);

      expect(consentCalls).toHaveLength(1);
      expect(consentCalls[0].kind).toBe(0);
      expect(sent[0].type).toBe('signer.signEvent.result');
    });

    it('returns error envelope when user rejects consent', async () => {
      const signer = createMockSigner();
      const service = createSignerService({
        getSigner: () => signer,
        onConsentNeeded: ({ resolve }) => { resolve(false); },
      });
      const sent: NappletMessage[] = [];
      const send = (msg: NappletMessage): void => { sent.push(msg); };

      const eventToSign: NostrEvent = {
        id: '', pubkey: 'a'.repeat(64), created_at: 1000, kind: 3, tags: [], content: '[]', sig: '',
      };
      service.handleMessage(WINDOW_ID, makeSignerMessage('signer.signEvent', { id: 'corr-11', event: eventToSign }), send);
      await nextTick(20);

      expect(sent[0].type).toBe('signer.signEvent.error');
      expect((sent[0] as any).error).toContain('user rejected');
    });

    it('skips consent for non-destructive kinds', async () => {
      const signer = createMockSigner();
      const consentCalls: number[] = [];
      const service = createSignerService({
        getSigner: () => signer,
        onConsentNeeded: ({ event, resolve }) => {
          consentCalls.push(event.kind);
          resolve(true);
        },
      });
      const sent: NappletMessage[] = [];
      const send = (msg: NappletMessage): void => { sent.push(msg); };

      // Kind 1 is NOT a destructive kind
      const eventToSign: NostrEvent = {
        id: '', pubkey: 'a'.repeat(64), created_at: 1000, kind: 1, tags: [], content: 'hello', sig: '',
      };
      service.handleMessage(WINDOW_ID, makeSignerMessage('signer.signEvent', { id: 'corr-12', event: eventToSign }), send);
      await nextTick(20);

      expect(consentCalls).toHaveLength(0);
      expect(sent[0].type).toBe('signer.signEvent.result');
    });

    it('uses custom consentKinds when provided', async () => {
      const signer = createMockSigner();
      const consentCalls: number[] = [];
      const service = createSignerService({
        getSigner: () => signer,
        consentKinds: [9999],
        onConsentNeeded: ({ event, resolve }) => {
          consentCalls.push(event.kind);
          resolve(true);
        },
      });
      const sent: NappletMessage[] = [];
      const send = (msg: NappletMessage): void => { sent.push(msg); };

      // Kind 0 should NOT trigger consent (not in custom list)
      const eventToSign0: NostrEvent = {
        id: '', pubkey: 'a'.repeat(64), created_at: 1000, kind: 0, tags: [], content: '{}', sig: '',
      };
      service.handleMessage(WINDOW_ID, makeSignerMessage('signer.signEvent', { id: 'corr-13a', event: eventToSign0 }), send);
      await nextTick(20);

      expect(consentCalls).toHaveLength(0);

      // Kind 9999 SHOULD trigger consent
      const eventToSign9999: NostrEvent = {
        id: '', pubkey: 'a'.repeat(64), created_at: 1001, kind: 9999, tags: [], content: '', sig: '',
      };
      service.handleMessage(WINDOW_ID, makeSignerMessage('signer.signEvent', { id: 'corr-13b', event: eventToSign9999 }), send);
      await nextTick(20);

      expect(consentCalls).toHaveLength(1);
      expect(consentCalls[0]).toBe(9999);
    });
  });

  describe('onWindowDestroyed', () => {
    it('does not throw', () => {
      const service = createSignerService({ getSigner: () => null });
      expect(() => service.onWindowDestroyed?.(WINDOW_ID)).not.toThrow();
    });
  });
});
