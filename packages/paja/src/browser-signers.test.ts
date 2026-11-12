import type { EventTemplate, NostrEvent } from '@napplet/core';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createPajaSignerController } from './browser-signers.js';

const PUBKEY = '7'.repeat(64);
const TEMPLATE: EventTemplate = {
  kind: 1,
  created_at: 1,
  tags: [],
  content: 'hello',
};

describe('Paja browser signers', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('ignores obsolete relay properties while retaining supported NIP-07 methods', async () => {
    const obsoleteRead = vi.fn(() => { throw new Error('obsolete extension property'); });
    const signed = { ...TEMPLATE, id: '8'.repeat(64), pubkey: PUBKEY, sig: '9'.repeat(128) };
    const signEvent = vi.fn(async () => signed);
    const nip04 = { encrypt: vi.fn(async () => 'nip04-cipher'), decrypt: vi.fn(async () => 'plain04') };
    const nip44 = { encrypt: vi.fn(async () => 'nip44-cipher'), decrypt: vi.fn(async () => 'plain44') };
    vi.stubGlobal('nostr', Object.defineProperty({
      getPublicKey: async () => PUBKEY, signEvent, nip04, nip44,
    }, 'getRelays', { get: obsoleteRead }));
    const controller = createPajaSignerController({ confirmRequest: () => true, onChange: () => {} });
    await controller.connectNip07();

    expect(obsoleteRead).not.toHaveBeenCalled();
    const signer = controller.getSigner();
    expect(signer).not.toBeNull();
    expect(signer).not.toHaveProperty('getRelays');
    await expect(signer?.getPublicKey?.()).resolves.toBe(PUBKEY);
    await expect(signer?.signEvent?.(TEMPLATE)).resolves.toEqual(signed);
    await expect(signer?.nip04?.encrypt(PUBKEY, 'plain04')).resolves.toBe('nip04-cipher');
    await expect(signer?.nip04?.decrypt(PUBKEY, 'nip04-cipher')).resolves.toBe('plain04');
    await expect(signer?.nip44?.encrypt(PUBKEY, 'plain44')).resolves.toBe('nip44-cipher');
    await expect(signer?.nip44?.decrypt(PUBKEY, 'nip44-cipher')).resolves.toBe('plain44');
    expect(signEvent).toHaveBeenCalledWith(TEMPLATE);
  });

  it('creates a request-scoped confirmation wrapper for a connected signer', async () => {
    const signed: NostrEvent = {
      ...TEMPLATE,
      id: '8'.repeat(64),
      pubkey: PUBKEY,
      sig: '9'.repeat(128),
    };
    const signEvent = vi.fn(async () => signed);
    vi.stubGlobal('nostr', {
      getPublicKey: async () => PUBKEY,
      signEvent,
    });
    const confirmRequest = vi.fn(async () => true);
    const controller = createPajaSignerController({
      confirmRequest,
      onChange: () => {},
    });
    await controller.connectNip07();

    await controller.getSigner({
      windowId: 'window-a',
      runtimeScope: 'artifact:aggregate-a',
      napplet: { dTag: 'profile-viewer', aggregateHash: 'aggregate-a' },
    })?.signEvent?.(TEMPLATE);

    expect(confirmRequest).toHaveBeenCalledWith({
      action: 'sign',
      event: TEMPLATE,
      signerContext: {
        windowId: 'window-a',
        runtimeScope: 'artifact:aggregate-a',
        napplet: { dTag: 'profile-viewer', aggregateHash: 'aggregate-a' },
        signerPubkey: PUBKEY,
      },
    });
    expect(signEvent).toHaveBeenCalledWith(TEMPLATE);
  });

  it('re-reads the signer account before matching remembered authority', async () => {
    let currentPubkey = PUBKEY;
    const nextPubkey = '6'.repeat(64);
    vi.stubGlobal('nostr', {
      getPublicKey: async () => currentPubkey,
      signEvent: async (event: EventTemplate) => ({
        ...event,
        id: '8'.repeat(64),
        pubkey: currentPubkey,
        sig: '9'.repeat(128),
      }),
    });
    const confirmRequest = vi.fn(async () => true);
    const controller = createPajaSignerController({
      confirmRequest,
      onChange: () => {},
    });
    await controller.connectNip07();
    currentPubkey = nextPubkey;

    await controller.getSigner({
      windowId: 'window-a',
      runtimeScope: 'artifact:aggregate-a',
      napplet: { dTag: 'profile-viewer', aggregateHash: 'aggregate-a' },
    })?.signEvent?.(TEMPLATE);

    expect(confirmRequest).toHaveBeenCalledWith(expect.objectContaining({
      signerContext: expect.objectContaining({ signerPubkey: nextPubkey }),
    }));
  });

  it('keeps host-internal signatures one-shot without napplet attribution', async () => {
    const signed = {
      ...TEMPLATE,
      id: '8'.repeat(64),
      pubkey: PUBKEY,
      sig: '9'.repeat(128),
    } as NostrEvent;
    vi.stubGlobal('nostr', {
      getPublicKey: async () => PUBKEY,
      signEvent: async () => signed,
    });
    const confirmRequest = vi.fn(async () => true);
    const controller = createPajaSignerController({
      confirmRequest,
      onChange: () => {},
    });
    await controller.connectNip07();

    await controller.getSigner()?.signEvent?.(TEMPLATE);

    expect(confirmRequest).toHaveBeenCalledWith({ action: 'sign', event: TEMPLATE });
  });
});
