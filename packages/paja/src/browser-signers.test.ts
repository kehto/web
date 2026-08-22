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
