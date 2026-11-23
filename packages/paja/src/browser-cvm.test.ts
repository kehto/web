import type { PajaHostConfig } from './options.js';
import type { NappletMessage } from '@napplet/core';
import type { ServiceRuntimeContext } from '@kehto/runtime';
import { describe, expect, it } from 'vitest';
import { createPajaAdapter } from './browser-adapter.js';
import { normalizePajaSimulation } from './simulation.js';

const CONFIG = {
  window: { id: 'paja-window', dTag: 'paja', aggregateHash: 'aggregate' },
} as PajaHostConfig;

const MULTIPLAYER = { profile: 'soy-rtc/1' as const, relays: ['wss://signal.example'] };
const SERVER = { pubkey: 'a'.repeat(64), relays: ['wss://relay.example'] };

function createAdapter(relayMode: 'live' | 'memory', options: { concurrency?: { maxInFlight?: number; maxQueued?: number }; multiplayer?: boolean } = {}) {
  const simulation = normalizePajaSimulation({
    relay: { mode: relayMode, urls: ['wss://relay.example'] },
    cvm: { enabled: true, ...(options.concurrency ? { concurrency: options.concurrency } : {}) },
    ...(options.multiplayer ? { multiplayer: MULTIPLAYER } : {}),
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

  // kehto/web#355, NAP-CVM napplet/naps#31 @ 28cf1bdb Security Considerations:
  // the Paja host passes its per-window admission limits to both CVM wirings.
  describe.each([{ multiplayer: false }, { multiplayer: true }])('admission (multiplayer profile: $multiplayer)', ({ multiplayer }) => {
    /** Hold every admitted request at approval, so nothing reaches a relay. */
    function drive(concurrency?: { maxInFlight?: number; maxQueued?: number }) {
      const adapter = createAdapter('live', { concurrency, multiplayer });
      const cvm = adapter.services!.cvm!;
      const approvals: string[] = [];
      cvm.onRegistered?.({
        listWindowIds: () => ['one', 'two'], resolveDTag: () => 'paja', hasCapability: () => true, sendToEligibleNapplet: () => false,
        authorizeOperation: (windowId: string) => { approvals.push(windowId); return new Promise(() => {}); },
      } as unknown as ServiceRuntimeContext);
      const sent: Array<{ windowId: string; id?: string; error?: string }> = [];
      const request = (windowId: string, id: string) => cvm.handleMessage(windowId, {
        type: 'cvm.request', id, server: SERVER, message: { jsonrpc: '2.0', id, method: 'tools/list' },
      } as NappletMessage, (message) => { sent.push({ windowId, ...(message as { id?: string; error?: string }) }); });
      const close = () => {
        cvm.onUnregistered?.();
        (adapter.relayPool.getRelayPool() as unknown as { close(): void }).close();
      };
      return { approvals, sent, request, close };
    }

    it('refuses work past the configured per-window limit without spending another window\'s budget', () => {
      const host = drive({ maxInFlight: 1, maxQueued: 1 });
      for (const id of ['a1', 'a2', 'a3']) host.request('one', id);
      host.request('two', 'b1');
      expect(host.sent).toEqual([{ windowId: 'one', type: 'cvm.request.result', id: 'a3', error: 'policy denied' }]);
      expect(host.approvals).toEqual(['one', 'two']);
      host.close();
    });

    it('uses the service defaults (8 running, 32 queued) when the host config sets none', () => {
      const host = drive();
      for (let i = 0; i < 41; i++) host.request('one', `r${i}`);
      expect(host.sent).toEqual([{ windowId: 'one', type: 'cvm.request.result', id: 'r40', error: 'policy denied' }]);
      expect(host.approvals).toHaveLength(8);
      host.close();
    });
  });

  it.each([{ maxInFlight: 0 }, { maxQueued: -1 }, { maxInFlight: 1.5 }, 'unbounded'])('rejects invalid cvm.concurrency %j', (concurrency) => {
    expect(() => normalizePajaSimulation({ cvm: { enabled: true, concurrency: concurrency as never } })).toThrow(/cvm\.concurrency/);
  });
});
