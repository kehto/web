import { describe, expect, it } from 'vitest';
import { buildShellCapabilities } from './shell-init.js';
import type { ShellAdapter, ShellCapabilities } from './types.js';

function supports(caps: ShellCapabilities, domain: string, protocol?: string): boolean {
  return protocol === undefined && caps.domains.includes(domain);
}

function baseHooks(): ShellAdapter {
  return {
    relayPool: { getRelayPool: () => null, trackSubscription: () => {}, untrackSubscription: () => {}, openScopedRelay: () => {}, closeScopedRelay: () => {}, publishToScopedRelay: () => false, selectRelayTier: () => [] },
    relayConfig: { addRelay: () => {}, removeRelay: () => {}, getRelayConfig: () => ({ discovery: [], super: [], outbox: [] }), getNip66Suggestions: () => null },
    windowManager: { createWindow: () => null }, auth: { getUserPubkey: () => null, getSigner: () => null },
    config: { getNappUpdateBehavior: () => 'banner' }, hotkeys: { executeHotkeyFromForward: () => {} },
    workerRelay: { getWorkerRelay: () => null }, crypto: { verifyEvent: async () => true },
  };
}

describe('shell.supports domain-only environment', () => {
  it('answers bare live domains and rejects numbered negotiation', () => {
    const caps = buildShellCapabilities(baseHooks());
    expect(supports(caps, 'inc')).toBe(true);
    expect(supports(caps, 'relay')).toBe(true);
    expect(supports(caps, 'outbox')).toBe(false);
    expect(supports(caps, 'inc', 'NAP-01')).toBe(false);
    expect(supports(caps, 'bogus')).toBe(false);
  });

  it('does not retain legacy capability payload fields', () => {
    const caps = buildShellCapabilities(baseHooks());
    expect(Object.keys(caps)).toEqual(['domains']);
    expect(caps.domains.some((domain) => domain.includes(':') || domain.startsWith('perm:'))).toBe(false);
  });
});
