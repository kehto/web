import { describe, expect, it } from 'vitest';
import type { NappletMessage } from '@kehto/runtime';

import { SYSTEM_MOCK_ENTRY, SYSTEM_SCOPE_NAMES, SYSTEM_SPEC_REF, createMockSystemService } from './system.js';

const ROUTES = ['system.naps', 'system.services', 'system.relays', 'system.eventCache', 'system.media', 'system.nappletStorage', 'system.scopes', 'system.scope'];

function run(service: ReturnType<typeof createMockSystemService>, windowId: string, message: Record<string, unknown>): NappletMessage {
  const out: NappletMessage[] = [];
  service.handleMessage(windowId, message as unknown as NappletMessage, (msg) => out.push(msg));
  const result = out.find((msg) => msg.type === `${String(message.type)}.result` && (msg as { id?: unknown }).id === message.id);
  expect(result).toBeDefined();
  return result!;
}

describe('NAP-SYSTEM mock', () => {
  it('describes itself and publishes every route as an extension capability', () => {
    const service = createMockSystemService();
    expect(service.descriptor).toEqual({ name: 'system', version: '0.1.0', description: 'Mock NAP-SYSTEM read-only runtime diagnostics' });
    expect(service.mock.routes).toEqual(ROUTES);
    expect(Object.keys(service.messageCapabilities ?? {})).toEqual(ROUTES);
    expect(SYSTEM_SPEC_REF).toEqual({ nap: 'NAP-SYSTEM', status: 'draft', source: 'pr', pr: 64, sha: '43a112db9d1c', path: 'naps/NAP-SYSTEM.md' });
    expect(SYSTEM_MOCK_ENTRY).toMatchObject({ domain: 'system', kind: 'extension', spec: SYSTEM_SPEC_REF });
    expect(SYSTEM_MOCK_ENTRY.create?.({}).descriptor.name).toBe('system');
  });

  it('answers the global accessors with seeded snapshots', () => {
    const service = createMockSystemService({ clock: { now: () => 1_700_000_000_000 } });
    expect(run(service, 'w1', { type: 'system.naps', id: 'n1' })).toEqual({
      type: 'system.naps.result', id: 'n1',
      naps: [
        { domain: 'shell', supported: true, required: true, health: 'ok' },
        { domain: 'relay', supported: true, health: 'ok' },
        { domain: 'storage', supported: true, health: 'ok' },
        { domain: 'identity', supported: true, health: 'ok' },
        { domain: 'inc', supported: true, protocols: ['NAP-4'], health: 'ok' },
        { domain: 'media', supported: true, health: 'degraded' },
        { domain: 'llm', supported: false },
      ],
    });
    expect(run(service, 'w1', { type: 'system.services', id: 's1' })).toEqual({
      type: 'system.services.result', id: 's1',
      services: [
        { name: 'relay-pool', available: true, health: 'ok' },
        { name: 'event-cache', available: true, health: 'ok' },
        { name: 'audio', available: true, health: 'degraded', message: 'No output device selected' },
        { name: 'notifications', available: false, health: 'unavailable', message: 'Permission not granted' },
      ],
    });
    expect(run(service, 'w1', { type: 'system.relays', id: 'r1' })).toEqual({
      type: 'system.relays.result', id: 'r1',
      relays: [
        { url: 'wss://relay-a.example.org', read: true, write: true, connected: true, health: 'ok', latencyMs: 115 },
        { url: 'wss://relay-b.example.net', read: true, write: true, connected: true, health: 'ok', latencyMs: 47 },
        { url: 'wss://relay-c.example.com', read: true, write: false, connected: true, health: 'ok', latencyMs: 146 },
        { url: 'wss://discovery.example.org', read: true, write: false, connected: false, health: 'degraded' },
      ],
    });
    expect(run(service, 'w1', { type: 'system.eventCache', id: 'c1' })).toEqual({
      type: 'system.eventCache.result', id: 'c1',
      status: { available: true, health: 'ok', bytesUsed: 7_340_032, bytesQuota: 67_108_864, itemCount: 18_204, persistent: true },
    });
    expect(run(service, 'w1', { type: 'system.media', id: 'm1' })).toEqual({
      type: 'system.media.result', id: 'm1',
      status: { available: true, health: 'degraded', audioOutput: 'degraded', audioInput: 'unavailable', videoInput: 'unavailable', playback: 'ok', activeSessions: 0 },
    });
  });

  it('scopes nappletStorage and scope details to the requesting window', () => {
    const service = createMockSystemService({ clock: { now: () => 1_700_000_000_000 } });
    const w1 = { available: true, health: 'ok', bytesUsed: 28_672, bytesQuota: 5_242_880, itemCount: 23, persistent: true };
    expect(run(service, 'w1', { type: 'system.nappletStorage', id: 's1' })).toEqual({ type: 'system.nappletStorage.result', id: 's1', status: w1 });
    expect(run(service, 'w2', { type: 'system.nappletStorage', id: 's2' })).toEqual({
      type: 'system.nappletStorage.result', id: 's2',
      status: { available: true, health: 'ok', bytesUsed: 16_384, bytesQuota: 5_242_880, itemCount: 4, persistent: true },
    });
    expect(run(service, 'w1', { type: 'system.scopes', id: 'sc' })).toEqual({
      type: 'system.scopes.result', id: 'sc',
      scopes: [
        { name: 'storage', available: true, health: 'ok' },
        { name: 'media', available: true, health: 'degraded' },
        { name: 'relay', available: true, health: 'ok' },
        { name: 'cache', available: true, health: 'ok' },
        { name: 'runtime', available: true, health: 'ok' },
      ],
    });
    expect(SYSTEM_SCOPE_NAMES).toEqual(['storage', 'media', 'relay', 'cache', 'runtime']);
    expect(run(service, 'w1', { type: 'system.scope', id: 'p1', name: 'storage' })).toEqual({
      type: 'system.scope.result', id: 'p1',
      scope: { name: 'storage', available: true, health: 'ok', details: { bytesUsed: 28_672, bytesQuota: 5_242_880, itemCount: 23 } },
    });
    expect(run(service, 'w1', { type: 'system.scope', id: 'p2', name: 'media' })).toEqual({
      type: 'system.scope.result', id: 'p2', scope: { name: 'media', available: true, health: 'degraded', details: { activeSessions: 0 } },
    });
    expect(run(service, 'w1', { type: 'system.scope', id: 'p3', name: 'relay' })).toEqual({
      type: 'system.scope.result', id: 'p3', scope: { name: 'relay', available: true, health: 'ok', details: { connected: 3, budgetPerMinute: 120 } },
    });
    expect(run(service, 'w1', { type: 'system.scope', id: 'p4', name: 'cache' })).toEqual({
      type: 'system.scope.result', id: 'p4', scope: { name: 'cache', available: true, health: 'ok', details: { bytesUsed: 7_340_032, itemCount: 18_204 } },
    });
  });

  it('reports version and uptime from the clock in the runtime scope', () => {
    let now = 1_700_000_000_000;
    const service = createMockSystemService({ version: '1.2.3', clock: { now: () => now } });
    now += 45_000;
    expect(run(service, 'w1', { type: 'system.scope', id: 'u1', name: 'runtime' })).toEqual({
      type: 'system.scope.result', id: 'u1',
      scope: { name: 'runtime', available: true, health: 'ok', details: { version: '1.2.3', startedAt: 1_700_000_000_000, uptimeMs: 45_000 } },
    });
  });

  it('returns NAP errors with conservative fallbacks', () => {
    const service = createMockSystemService({ errors: { media: 'unavailable' } });
    expect(run(service, 'w1', { type: 'system.scope', id: 'e1', name: 'bogus' })).toEqual({
      type: 'system.scope.result', id: 'e1', scope: { name: 'bogus', available: false, health: 'unknown', details: {} }, error: 'unknown scope',
    });
    expect(run(service, 'w1', { type: 'system.media', id: 'e2' })).toEqual({
      type: 'system.media.result', id: 'e2', status: { available: false, health: 'unknown' }, error: 'unavailable',
    });
    service.setError('relays', 'policy denied');
    expect(run(service, 'w1', { type: 'system.relays', id: 'e3' })).toEqual({ type: 'system.relays.result', id: 'e3', relays: [], error: 'policy denied' });
    service.setError('naps', 'probe failed');
    expect(run(service, 'w1', { type: 'system.naps', id: 'e4' })).toEqual({ type: 'system.naps.result', id: 'e4', naps: [], error: 'probe failed' });
    service.setError('nappletStorage', 'unsupported');
    expect(run(service, 'w1', { type: 'system.nappletStorage', id: 'e5' })).toEqual({ type: 'system.nappletStorage.result', id: 'e5', status: { available: false, health: 'unknown' }, error: 'unsupported' });
    service.setError('media', undefined);
    expect(run(service, 'w1', { type: 'system.media', id: 'e6' })).toMatchObject({ status: { available: true } });
  });

  it('resets state and cleans per-window snapshots on destroy', () => {
    const service = createMockSystemService();
    run(service, 'w1', { type: 'system.nappletStorage', id: 's1' });
    expect(service.mock.state().storageByWindow.has('w1')).toBe(true);
    service.onWindowDestroyed?.('w1');
    expect(service.mock.state().storageByWindow.has('w1')).toBe(false);
    service.setError('naps', 'unavailable');
    service.mock.reset();
    expect(service.mock.state().errors).toEqual({});
    expect(service.mock.sent).toEqual([]);
  });
});
