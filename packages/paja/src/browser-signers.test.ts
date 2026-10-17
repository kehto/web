import type { EventTemplate, NostrEvent } from '@napplet/core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { nprofileEncode, npubEncode } from 'nostr-tools/nip19';

import { createPajaSignerController } from './browser-signers.js';
import {
  PAJA_VIEW_ONLY_SIGNER_STORAGE_KEY,
  type PajaPreferenceStorage,
} from './browser-identity-input.js';

const PUBKEY = '7'.repeat(64);
const TEMPLATE: EventTemplate = {
  kind: 1,
  created_at: 1,
  tags: [],
  content: 'hello',
};

describe('Paja browser signers', () => {
  afterEach(() => vi.unstubAllGlobals());

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

const VIEW_ONLY_HEX = '5'.repeat(64);
const VIEW_ONLY_NPUB = npubEncode(VIEW_ONLY_HEX);

function memoryStorage(initial: Record<string, string> = {}): PajaPreferenceStorage {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => { values.set(key, value); },
    removeItem: (key) => { values.delete(key); },
  };
}

function readStored(storage: PajaPreferenceStorage): string | null {
  return storage.getItem(PAJA_VIEW_ONLY_SIGNER_STORAGE_KEY);
}

describe('Paja view-only signer', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('reads the identity but exposes no signing or encryption capability', async () => {
    const storage = memoryStorage();
    const controller = createPajaSignerController({
      confirmRequest: vi.fn(async () => true),
      onChange: () => {},
      storage,
      getRelays: () => ({ 'wss://host.relay/': { read: true, write: true } }),
    });

    controller.useViewOnlySigner(VIEW_ONLY_NPUB);

    expect(controller.getState()).toEqual({
      method: 'viewonly',
      status: 'connected',
      pubkey: VIEW_ONLY_HEX,
      relay: null,
      error: null,
    });
    expect(controller.getMethod()).toBe('viewonly');
    expect(readStored(storage)).toBe(VIEW_ONLY_HEX);

    const signer = controller.getSigner();
    expect(signer).not.toBeNull();
    expect(signer?.getPublicKey?.()).toBe(VIEW_ONLY_HEX);
    expect(signer?.getRelays?.()).toEqual({ 'wss://host.relay/': { read: true, write: true } });
    // The confirmation wrapper must not invent a throwing signEvent: the
    // runtime and host gates detect capability by presence.
    expect(signer?.signEvent).toBeUndefined();
    expect(signer?.nip44).toBeUndefined();
    expect(signer?.nip04).toBeUndefined();
  });

  it('uses nprofile relay hints instead of the host relays', async () => {
    const controller = createPajaSignerController({
      confirmRequest: vi.fn(async () => true),
      onChange: () => {},
      storage: memoryStorage(),
      getRelays: () => ({ 'wss://host.relay/': { read: true, write: true } }),
    });

    controller.useViewOnlySigner(nprofileEncode({ pubkey: VIEW_ONLY_HEX, relays: ['wss://hinted.relay/'] }));

    expect(controller.getSigner()?.getRelays?.()).toEqual({ 'wss://hinted.relay/': { read: true, write: true } });
  });

  it('restores a persisted view-only identity before any host probe runs', async () => {
    const storage = memoryStorage({ [PAJA_VIEW_ONLY_SIGNER_STORAGE_KEY]: VIEW_ONLY_HEX });
    const onChange = vi.fn();
    const controller = createPajaSignerController({
      confirmRequest: vi.fn(async () => true),
      onChange,
      storage,
    });

    expect(controller.getState()).toEqual({
      method: 'viewonly',
      status: 'connected',
      pubkey: VIEW_ONLY_HEX,
      relay: null,
      error: null,
    });
    expect(controller.getSigner()?.getPublicKey?.()).toBe(VIEW_ONLY_HEX);
    // Restoration is not a change; the host must not reload on construction.
    expect(onChange).not.toHaveBeenCalled();
  });

  it('rejects a secret key, reports why, and keeps the last valid identity stored', async () => {
    const storage = memoryStorage({ [PAJA_VIEW_ONLY_SIGNER_STORAGE_KEY]: VIEW_ONLY_HEX });
    const controller = createPajaSignerController({
      confirmRequest: vi.fn(async () => true),
      onChange: () => {},
      storage,
    });
    const changes: string[] = [];
    controller.subscribe(() => changes.push(controller.getState().status));

    controller.useViewOnlySigner('nsec1qy352euf40x77qfrg4ncn27daau6jy8e3q4n3h4ns9m3p4v5vqs5t0w0z');

    expect(controller.getState()).toMatchObject({
      method: 'viewonly',
      status: 'error',
      pubkey: null,
      error: 'that is a secret key, not a view-only identity — paste the npub instead',
    });
    expect(controller.getSigner()).toBeNull();
    expect(readStored(storage)).toBe(VIEW_ONLY_HEX);
    expect(changes).toEqual(['error']);
  });

  it('does not persist a rejected paste', async () => {
    const storage = memoryStorage();
    const controller = createPajaSignerController({
      confirmRequest: vi.fn(async () => true),
      onChange: () => {},
      storage,
    });

    controller.useViewOnlySigner('not-an-identity');

    expect(controller.getState().status).toBe('error');
    expect(readStored(storage)).toBeNull();
  });

  it('clears the persisted identity on log out', async () => {
    const storage = memoryStorage({ [PAJA_VIEW_ONLY_SIGNER_STORAGE_KEY]: VIEW_ONLY_HEX });
    const controller = createPajaSignerController({
      confirmRequest: vi.fn(async () => true),
      onChange: () => {},
      storage,
    });

    controller.disconnect();

    expect(controller.getState()).toEqual({
      method: 'none',
      status: 'disconnected',
      pubkey: null,
      relay: null,
      error: null,
    });
    expect(controller.getSigner()).toBeNull();
    expect(readStored(storage)).toBeNull();
  });

  it('clears the persisted view-only identity when another method is chosen', async () => {
    const storage = memoryStorage({ [PAJA_VIEW_ONLY_SIGNER_STORAGE_KEY]: VIEW_ONLY_HEX });
    const controller = createPajaSignerController({
      confirmRequest: vi.fn(async () => true),
      onChange: () => {},
      storage,
    });

    controller.useDevSigner();

    expect(controller.getMethod()).toBe('dev');
    expect(readStored(storage)).toBeNull();
  });

  it('clears the persisted view-only identity after a NIP-07 connection', async () => {
    vi.stubGlobal('nostr', {
      getPublicKey: async () => PUBKEY,
      signEvent: async (event: EventTemplate) => ({ ...event, id: '8'.repeat(64), pubkey: PUBKEY, sig: '9'.repeat(128) }),
    });
    const storage = memoryStorage({ [PAJA_VIEW_ONLY_SIGNER_STORAGE_KEY]: VIEW_ONLY_HEX });
    const controller = createPajaSignerController({
      confirmRequest: vi.fn(async () => true),
      onChange: () => {},
      storage,
    });

    await controller.connectNip07();

    expect(controller.getMethod()).toBe('nip07');
    expect(readStored(storage)).toBeNull();
  });

  it('keeps a failed NIP-07 attempt from dropping the stored view-only identity', async () => {
    const storage = memoryStorage({ [PAJA_VIEW_ONLY_SIGNER_STORAGE_KEY]: VIEW_ONLY_HEX });
    const controller = createPajaSignerController({
      confirmRequest: vi.fn(async () => true),
      onChange: () => {},
      storage,
    });

    await controller.connectNip07();

    expect(controller.getState().status).toBe('error');
    expect(readStored(storage)).toBe(VIEW_ONLY_HEX);
  });
});
