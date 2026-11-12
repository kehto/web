import type { EventTemplate, NostrEvent } from '@napplet/core';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createPajaSignerController } from './browser-signers.js';
import { createNip46Client } from './browser-nip46-client.js';

vi.mock('./browser-nip46-client.js', async (original) => ({
  ...await original<typeof import('./browser-nip46-client.js')>(),
  createNip46Client: vi.fn(),
}));

const PUBKEY = '7'.repeat(64);
function pendingKey() {
  let resolve!: (value: string) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<string>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
const TEMPLATE: EventTemplate = {
  kind: 1,
  created_at: 1,
  tags: [],
  content: 'hello',
};

describe('Paja browser signers', () => {
  afterEach(() => vi.unstubAllGlobals());

  const key = 'kehto:paja:signer-method:v1';
  function fixture(value: string | null = null) {
    const storage = { getItem: vi.fn(() => value), setItem: vi.fn((_key: string, next: string) => { value = next; }) };
    const create = () => createPajaSignerController({ storage, confirmRequest: async () => true, onChange: vi.fn() });
    return { storage, create };
  }

  it.each([null, '', 'invalid', '{}', 'NIP07'])('defaults invalid preference %s to None without provider calls', async (value) => {
    const getPublicKey = vi.fn(async () => PUBKEY);
    vi.stubGlobal('nostr', { getPublicKey, signEvent: vi.fn() });
    const controller = fixture(value).create();
    await controller.restorePreference();
    expect(controller.getMethod()).toBe('none');
    expect(getPublicKey).not.toHaveBeenCalled();
  });

  it.each(['none', 'dev', 'nip07', 'nip46'] as const)('round-trips only the %s method', async (method) => {
    const getPublicKey = vi.fn(async () => PUBKEY);
    vi.stubGlobal('nostr', { getPublicKey, signEvent: vi.fn() });
    const { storage, create } = fixture();
    const first = create();
    if (method === 'none') first.useNoSigner();
    if (method === 'dev') first.useDevSigner();
    if (method === 'nip07') await first.connectNip07();
    if (method === 'nip46') await first.connectBunker('invalid-secret-uri');
    const second = create();
    await second.restorePreference();
    expect(second.getMethod()).toBe(method);
    expect(storage.setItem.mock.calls.every(([name, value]) => name === key && value === method)).toBe(true);
    expect(getPublicKey).toHaveBeenCalledTimes(method === 'nip07' ? 2 : 0);
    if (method === 'nip46') expect(second.getState()).toMatchObject({ status: 'disconnected', relay: null, error: null });
  });

  it('survives denied storage reads and writes', async () => {
    const { storage, create } = fixture();
    storage.getItem.mockImplementation(() => { throw new Error('denied'); });
    storage.setItem.mockImplementation(() => { throw new Error('denied'); });
    const controller = create();
    await controller.restorePreference();
    expect(controller.getMethod()).toBe('none');
    controller.useDevSigner();
    expect(controller.getMethod()).toBe('dev');
  });

  it('keeps an unavailable extension selected without falling back', async () => {
    vi.stubGlobal('nostr', undefined);
    const controller = fixture('nip07').create();
    await controller.restorePreference();
    expect(controller.getState()).toMatchObject({ method: 'nip07', status: 'error' });
  });

  it.each([false, true])('ignores late extension completion (reject=%s)', async (reject) => {
    const pending = pendingKey();
    vi.stubGlobal('nostr', { getPublicKey: () => pending.promise, signEvent: vi.fn() });
    const { create, storage } = fixture();
    const controller = create();
    const connecting = controller.connectNip07();
    controller.useNoSigner();
    if (reject) pending.reject(new Error('late failure'));
    else pending.resolve(PUBKEY);
    await connecting;
    expect(controller.getState()).toMatchObject({ method: 'none', status: 'disconnected', pubkey: null, error: null });
    expect(controller.getSigner()).toBeNull();
    expect(storage.getItem()).toBe('none');
  });

  it.each([false, true])('closes pending bunker without disturbing a replacement (reject=%s)', async (reject) => {
    const pending = pendingKey();
    const close = vi.fn();
    vi.mocked(createNip46Client).mockReturnValue({ connect: () => pending.promise, close, getSigner: vi.fn() });
    vi.stubGlobal('nostr', { getPublicKey: async () => PUBKEY, signEvent: vi.fn() });
    const { create, storage } = fixture();
    const controller = create();
    const connecting = controller.connectBunker(`bunker://${PUBKEY}?relay=wss://relay.example&secret=private`);
    controller.useNoSigner();
    expect(close).toHaveBeenCalledTimes(1);
    await controller.connectNip07();
    if (reject) pending.reject(new Error('late failure'));
    else pending.resolve('6'.repeat(64));
    await connecting;
    expect(controller.getState()).toMatchObject({ method: 'nip07', status: 'connected', pubkey: PUBKEY });
    expect(storage.setItem.mock.calls).toEqual([[key, 'nip46'], [key, 'none'], [key, 'nip07']]);
    expect(close).toHaveBeenCalledTimes(1);
  });

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
