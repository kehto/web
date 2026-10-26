import { afterEach, expect, it, vi } from 'vitest';
import { finalizeEvent } from 'nostr-tools/pure';
import type { NappletMessage } from '@napplet/core';
import type { PermissionRequirement, ServiceRuntimeContext } from '@kehto/runtime';
import { createPajaAdapter } from '../../packages/paja/src/browser-adapter.js';
import type { PajaRelayBackend } from '../../packages/paja/src/browser-relay-runtime.js';
import { normalizePajaSimulation } from '../../packages/paja/src/simulation.js';
import type { PajaHostConfig } from '../../packages/paja/src/options.js';

vi.mock('nostr-tools/pool', () => ({
  SimplePool: class {
    ensureRelay() { return Promise.reject(new Error('unexpected live socket')); }
    destroy() {}
  },
}));

const dispose: Array<() => void> = [];
afterEach(() => {
  for (const close of dispose.splice(0)) close();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it.each(['bootstrap', 'author', 'allow'] as const)(
  'uses approved immutable discovery destinations (decision=%s)', async (decision) => {
    const key = new Uint8Array(32);
    key[31] = 1;
    const old = finalizeEvent({ kind: 10002, created_at: 1, tags: [['r', 'wss://old.example', 'write']], content: '' }, key);
    const current = finalizeEvent({ kind: 10002, created_at: 2, tags: [['r', 'wss://author.example', 'write']], content: '' }, key);
    const servers = finalizeEvent({ kind: 10063, created_at: 3, tags: [['server', 'https://cdn.example']], content: '' }, key);
    const bytes = new TextEncoder().encode('approved discovery bytes');
    const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)),
      (value) => value.toString(16).padStart(2, '0')).join('');
    const simulation = normalizePajaSimulation({ relay: { mode: 'live', urls: ['wss://bootstrap.example'] },
      upload: { mode: 'memory', servers: [], discoverServers: false } });
    const adapter = createPajaAdapter({
      window: { id: 'w', dTag: 'fixture', aggregateHash: 'a'.repeat(64) },
    } as PajaHostConfig, () => simulation, () => {}, () => {}, () => true);
    const backend = adapter.relayPool.getRelayPool() as unknown as PajaRelayBackend;
    dispose.push(() => backend.close());
    const destinations: string[] = [];
    const queries = vi.spyOn(backend, 'query').mockImplementation(async (relays, filters, _wait, _context, signal) => {
      if (filters[0]?.authors?.[0] !== current.pubkey) return [];
      expect(relays).toHaveLength(1);
      expect(destinations).toContain(new URL(relays[0]!).origin);
      expect(signal?.aborted).toBe(false);
      return filters[0]?.kinds?.includes(10002) ? [current, old] : [servers];
    });
    const fetcher = vi.fn(async () => new Response(bytes));
    vi.stubGlobal('fetch', fetcher);
    const service = adapter.services!.resource!;
    service.onRegistered?.({
      authorizeOperation: async (_window: string, _operation: string, requirements: PermissionRequirement[],
        execute: (signal: AbortSignal) => Promise<unknown>) => {
        const network = requirements.find((item) => item.category === 'network');
        if (network) {
          destinations.push(network.scope.value);
          if (decision === 'bootstrap' || decision === 'author' && network.scope.value === 'wss://author.example') {
            return { status: 'denied' };
          }
        }
        return { status: 'executed', value: await execute(new AbortController().signal) };
      },
    } as unknown as ServiceRuntimeContext);
    // Allow unrelated initial host metadata reads to settle before measuring this request.
    await new Promise((resolve) => setTimeout(resolve, 0));
    queries.mockClear();
    const sent: NappletMessage[] = [];
    service.handleMessage('w', { type: 'resource.bytes', id: 'discovery',
      url: `blossom:${hash}?as=${current.pubkey}` } as NappletMessage, (message) => sent.push(message));
    await vi.waitFor(() => expect(sent).toHaveLength(1));
    expect(destinations).not.toContain('wss://old.example');
    for (const [relays] of queries.mock.calls) {
      expect(relays).toHaveLength(1);
      expect(destinations).toContain(new URL(relays[0]!).origin);
    }
    if (decision === 'bootstrap') expect(queries).not.toHaveBeenCalled();
    if (decision === 'author') {
      expect(destinations).toContain('wss://author.example');
      expect(queries.mock.calls.some(([relays]) => relays.includes('wss://author.example'))).toBe(false);
    }
    if (decision === 'allow') {
      expect(queries.mock.calls.some(([relays]) => relays.includes('wss://author.example'))).toBe(true);
      expect(fetcher).toHaveBeenCalledOnce();
      expect(sent[0]).toMatchObject({ type: 'resource.bytes.result', blob: btoa('approved discovery bytes') });
    } else {
      expect(fetcher).not.toHaveBeenCalled();
      expect(sent[0]).toMatchObject({ type: 'resource.bytes.error', error: 'blocked-by-policy' });
    }
  },
);
