import { describe, expect, it } from 'vitest';
import { MOCK_NAPPLET_BINDINGS, MOCK_NAP_REGISTRY } from '@kehto/mocks';
import type { ServiceHandler, ShellAdapter } from '@kehto/shell';

import { createPajaMockedServices, pajaMockedBindings } from './browser-mocked-services.js';
import { resolvePajaFrameEnvironment } from './browser-target-frame.js';
import { PAJA_MOCKED_DOMAINS, PAJA_MOCKED_MARK, isPajaMockedDomain } from './mocked-domains.js';
import { PAJA_ADVERTISED_DOMAINS } from './parity.js';
import { PAJA_SIMULATION_DOMAINS, normalizePajaSimulation } from './simulation.js';

const IDENTITY = { dTag: 'probe', aggregateHash: 'probe-hash' };

function hooks(services: Record<string, ServiceHandler>, capabilities?: ShellAdapter['capabilities']): ShellAdapter {
  return {
    relayPool: { getRelayPool: () => null, trackSubscription: () => {}, untrackSubscription: () => {}, openScopedRelay: () => {}, closeScopedRelay: () => {}, publishToScopedRelay: () => false, selectRelayTier: () => [] },
    relayConfig: { addRelay: () => {}, removeRelay: () => {}, getRelayConfig: () => ({ discovery: [], super: [], outbox: [] }), getNip66Suggestions: () => null },
    windowManager: { createWindow: () => null },
    auth: { getUserPubkey: () => null, getSigner: () => null },
    config: { getNappUpdateBehavior: () => 'banner' },
    hotkeys: { executeHotkeyFromForward: () => {} },
    workerRelay: { getWorkerRelay: () => null },
    crypto: { verifyEvent: async () => true },
    services,
    ...(capabilities ? { capabilities } : {}),
  };
}

describe('Paja mocked domains', () => {
  it('mocks exactly the @kehto/mocks wire domains Paja has no backend for', () => {
    const advertised = new Set<string>(PAJA_ADVERTISED_DOMAINS);
    const expected = MOCK_NAP_REGISTRY
      .filter((entry) => entry.kind === 'extension' && !advertised.has(entry.domain))
      .map((entry) => entry.domain);
    expect([...PAJA_MOCKED_DOMAINS].sort()).toEqual(expected.sort());
    for (const domain of PAJA_MOCKED_DOMAINS) expect(MOCK_NAPPLET_BINDINGS[domain], domain).toBeDefined();
    expect(isPajaMockedDomain('torrent')).toBe(true);
    expect(isPajaMockedDomain('relay')).toBe(false);
    expect(PAJA_MOCKED_MARK).toBe('◌');
  });

  it('lists mocked domains after the real ones and enables them by default', () => {
    expect(PAJA_SIMULATION_DOMAINS.slice(-PAJA_MOCKED_DOMAINS.length)).toEqual([...PAJA_MOCKED_DOMAINS]);
    const simulation = normalizePajaSimulation({ capabilities: { domains: { torrent: false } } });
    expect(simulation.capabilities.domains.git).toBe(true);
    expect(simulation.capabilities.domains.torrent).toBe(false);
    expect(simulation.capabilities.disabledDomains).toContain('torrent');
  });

  it('registers one seeded mock per domain in the host service map', () => {
    const services: Record<string, ServiceHandler> = {};
    const mocked = createPajaMockedServices(services);
    expect(Object.keys(services).sort()).toEqual([...PAJA_MOCKED_DOMAINS].sort());
    expect(services.torrent).toBe(mocked.services.torrent);
    expect(() => mocked.onWindowReady('unregistered-window')).not.toThrow();
  });

  it('adds enabled mocked domains to the frame environment and honors disables and grants', () => {
    const services: Record<string, ServiceHandler> = {};
    createPajaMockedServices(services);

    const all = resolvePajaFrameEnvironment(hooks(services), IDENTITY);
    expect(all.capabilities.domains).toEqual(expect.arrayContaining(['torrent', 'location', 'class']));
    expect(Object.isFrozen(all.capabilities.domains)).toBe(true);

    const disabled = resolvePajaFrameEnvironment(hooks(services, { disabledDomains: ['torrent'] }), IDENTITY);
    expect(disabled.capabilities.domains).not.toContain('torrent');
    expect(disabled.capabilities.domains).toContain('git');

    const granted = resolvePajaFrameEnvironment(hooks(services, {
      resolveEnvironment: (_identity, available) => ({ domains: available.domains.filter((domain) => domain !== 'git'), services: available.services }),
    }), IDENTITY);
    expect(granted.capabilities.domains).not.toContain('git');
    expect(granted.capabilities.domains).toContain('torrent');

    expect(resolvePajaFrameEnvironment(hooks({}), IDENTITY).capabilities.domains).not.toContain('torrent');
  });

  it('hands the prelude bindings only for exposed mocked domains', () => {
    const bindings = pajaMockedBindings(['shell', 'relay', 'torrent', 'value']);
    expect(Object.keys(bindings)).toEqual(['torrent', 'value']);
    expect(bindings.torrent!.methods.add).toMatchObject({ type: 'torrent.add', params: ['request'], result: 'ack' });
  });
});
