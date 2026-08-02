import type { PajaHostConfig } from './options.js';
import { describe, expect, it } from 'vitest';
import { createPajaAdapter } from './browser-adapter.js';
import { normalizePajaSimulation } from './simulation.js';

const CONFIG = {
  window: { id: 'paja-window', dTag: 'paja', aggregateHash: 'aggregate' },
} as PajaHostConfig;

function createAdapter(relayMode: 'live' | 'memory') {
  const simulation = normalizePajaSimulation({
    relay: { mode: relayMode, urls: ['wss://relay.example'] },
    cvm: { enabled: true },
  });
  return createPajaAdapter(CONFIG, () => simulation, () => {}, () => {}, () => true);
}

describe('Paja CVM backend', () => {
  it('registers the encrypted Nostr transport only with a live relay boundary', () => {
    const live = createAdapter('live');
    const memory = createAdapter('memory');

    expect(live.services?.cvm?.descriptor.name).toBe('cvm');
    expect(memory.services?.cvm).toBeUndefined();

    (live.relayPool.getRelayPool() as unknown as { close(): void }).close();
    (memory.relayPool.getRelayPool() as unknown as { close(): void }).close();
  });
});
