import { readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { resolvePajaFrameEnvironment } from './browser-target-frame.js';
import type { ShellAdapter } from '@kehto/shell';

import {
  PAJA_ADVERTISED_DOMAINS,
  PAJA_COMPATIBILITY_ALIASES,
  PAJA_DEFERRED_DOMAINS,
  PAJA_HANDSHAKE_DOMAINS,
  PAJA_REQUIRED_SERVICES,
  PAJA_UPSTREAM_WEB_DOMAINS,
  hasEqualPajaEnvironmentMembership,
  getMissingAdvertisedDomains,
  getMissingServices,
} from './parity.js';

function baseHooks(): ShellAdapter {
  return {
    relayPool: { getRelayPool: () => null, trackSubscription: () => {}, untrackSubscription: () => {}, openScopedRelay: () => {}, closeScopedRelay: () => {}, publishToScopedRelay: () => false, selectRelayTier: () => [] },
    relayConfig: { addRelay: () => {}, removeRelay: () => {}, getRelayConfig: () => ({ discovery: [], super: [], outbox: [] }), getNip66Suggestions: () => null },
    windowManager: { createWindow: () => null },
    auth: { getUserPubkey: () => null, getSigner: () => null },
    config: { getNappUpdateBehavior: () => 'banner' },
    hotkeys: { executeHotkeyFromForward: () => {} },
    workerRelay: { getWorkerRelay: () => null },
    crypto: { verifyEvent: async () => true },
  };
}

function service(name: string) {
  return { descriptor: { name, version: '1.0.0' }, handleMessage: () => {} };
}

function napPackageRoot(): URL {
  return new URL('../node_modules/@napplet/nap/dist/', import.meta.url);
}

function readNapDomainDirectories(): string[] {
  return readdirSync(napPackageRoot(), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((name) => !name.startsWith('.'))
    .sort();
}

describe('@kehto/paja parity metadata', () => {
  it('keeps NAP-SHELL mandatory and outside optional capability toggles', () => {
    expect(PAJA_HANDSHAKE_DOMAINS).toEqual(['shell']);
    expect(PAJA_ADVERTISED_DOMAINS).not.toContain('shell');
  });

  it('tracks the current @napplet/nap web domain directories', () => {
    expect(readNapDomainDirectories()).toEqual([...PAJA_UPSTREAM_WEB_DOMAINS]);
  });

  it('covers every upstream domain as advertised, handshake-only, or compatibility alias', () => {
    const advertised = new Set<string>(PAJA_ADVERTISED_DOMAINS);
    const handshakeOnly = new Set<string>(PAJA_HANDSHAKE_DOMAINS);
    const deferred = new Set<string>(PAJA_DEFERRED_DOMAINS);

    for (const domain of PAJA_UPSTREAM_WEB_DOMAINS) {
      if (deferred.has(domain)) {
        expect(advertised.has(domain)).toBe(false);
        continue;
      }
      if (handshakeOnly.has(domain)) {
        expect(advertised.has(domain)).toBe(false);
        continue;
      }
      if (domain in PAJA_COMPATIBILITY_ALIASES) {
        expect(advertised.has(PAJA_COMPATIBILITY_ALIASES[domain as keyof typeof PAJA_COMPATIBILITY_ALIASES])).toBe(true);
        continue;
      }
      expect(advertised.has(domain)).toBe(true);
    }
  });

  it('identifies missing advertised domains and services', () => {
    expect(getMissingAdvertisedDomains({
      domains: [...PAJA_ADVERTISED_DOMAINS],
    })).toEqual([]);
    expect(getMissingAdvertisedDomains({
      domains: PAJA_ADVERTISED_DOMAINS.filter((domain) => domain !== 'upload'),
    })).toEqual(['upload']);
    expect(getMissingServices(PAJA_REQUIRED_SERVICES)).toEqual([]);
    expect(getMissingServices(PAJA_REQUIRED_SERVICES.filter((service) => service !== 'intent'))).toEqual(['intent']);
  });

  it('resolves equal but isolated bootstrap and shell.init environments from trusted live wiring', () => {
    const hooks: ShellAdapter = {
      ...baseHooks(),
      services: { config: service('config'), resource: service('resource') },
      capabilities: {
        disabledDomains: ['identity', 'resource'],
        resolveEnvironment: () => ({
          domains: ['relay', 'config', 'identity', 'resource'],
          services: ['config', 'resource'],
        }),
      },
    };

    const { bootstrap, shellInit } = resolvePajaFrameEnvironment(hooks, {
      dTag: 'trusted-frame',
      aggregateHash: 'trusted-hash',
    });

    expect(bootstrap).toEqual({
      capabilities: { domains: ['relay', 'config'] },
      services: ['config'],
    });
    expect(shellInit).toEqual(bootstrap);
    expect(shellInit).not.toBe(bootstrap);
    expect(shellInit.capabilities).not.toBe(bootstrap.capabilities);
    expect(shellInit.capabilities.domains).not.toBe(bootstrap.capabilities.domains);
    expect(shellInit.services).not.toBe(bootstrap.services);
    expect(Object.isFrozen(bootstrap.capabilities.domains)).toBe(true);
    expect(Object.isFrozen(shellInit.services)).toBe(true);
    expect(hasEqualPajaEnvironmentMembership(bootstrap, shellInit)).toBe(true);
  });

  it('does not resurrect an absent domain when the same trusted frame environment is rebuilt', () => {
    const hooks: ShellAdapter = {
      ...baseHooks(),
      capabilities: {
        disabledDomains: ['relay'],
        resolveEnvironment: () => ({ domains: ['relay', 'storage'], services: [] }),
      },
    };
    const identity = { dTag: 'same-frame', aggregateHash: 'same-hash' };

    const first = resolvePajaFrameEnvironment(hooks, identity);
    const second = resolvePajaFrameEnvironment(hooks, identity);

    expect(first.bootstrap).toEqual(second.bootstrap);
    expect(first.bootstrap.capabilities.domains).not.toContain('relay');
    expect(second.shellInit.capabilities.domains).not.toContain('relay');
  });
});
