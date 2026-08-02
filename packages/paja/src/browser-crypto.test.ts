import { describe, expect, it } from 'vitest';
import { finalizeEvent, generateSecretKey } from 'nostr-tools/pure';
import { createPajaAdapter } from './browser-adapter.js';
import type { PajaHostConfig } from './options.js';
import { normalizePajaSimulation } from './simulation.js';

const CONFIG = {
  window: { id: 'crypto-window', dTag: 'crypto-napplet', aggregateHash: 'crypto-hash' },
} as PajaHostConfig;

describe('Paja crypto boundary', () => {
  it('verifies real Nostr signatures and rejects tampered events', async () => {
    const adapter = createPajaAdapter(
      CONFIG,
      () => normalizePajaSimulation({ relay: { mode: 'disabled' } }),
      () => {},
      () => {},
      () => true,
    );
    const event = finalizeEvent({
      kind: 1,
      created_at: 1,
      tags: [],
      content: 'signed',
    }, generateSecretKey());
    const tampered = {
      id: event.id,
      pubkey: event.pubkey,
      created_at: event.created_at,
      kind: event.kind,
      tags: event.tags.map((tag) => [...tag]),
      content: 'tampered',
      sig: event.sig,
    };

    await expect(adapter.crypto.verifyEvent(event)).resolves.toBe(true);
    await expect(adapter.crypto.verifyEvent(tampered)).resolves.toBe(false);

    (adapter.relayPool.getRelayPool() as unknown as { close(): void }).close();
  });
});
