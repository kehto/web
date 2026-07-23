/** Domain-only NAP-SHELL posture regression coverage. */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { buildShellCapabilities } from '../src/shell-init.js';
import type {
  AuthHooks,
  ConfigHooks,
  CryptoHooks,
  HotkeyHooks,
  RelayConfigHooks,
  RelayPoolHooks,
  ShellAdapter,
  ShellCapabilities,
  WindowManagerHooks,
  WorkerRelayHooks,
} from '../src/types.js';

const TYPES_SOURCE = readFileSync(new URL('../src/types.ts', import.meta.url), 'utf8');

function lookup(caps: ShellCapabilities, capability: string): boolean {
  return caps.domains.includes(capability);
}

function stubHooks(): ShellAdapter {
  const relayPool: RelayPoolHooks = { getRelayPool: () => null, trackSubscription: () => {}, untrackSubscription: () => {}, openScopedRelay: () => {}, closeScopedRelay: () => {}, publishToScopedRelay: () => false, selectRelayTier: () => [] };
  const relayConfig: RelayConfigHooks = { addRelay: () => {}, removeRelay: () => {}, getRelayConfig: () => ({ discovery: [], super: [], outbox: [] }), getNip66Suggestions: () => ({}) };
  const windowManager: WindowManagerHooks = { createWindow: () => null };
  const auth: AuthHooks = { getUserPubkey: () => null, getSigner: () => null };
  const config: ConfigHooks = { getNappUpdateBehavior: () => 'banner' };
  const hotkeys: HotkeyHooks = { executeHotkeyFromForward: () => {} };
  const workerRelay: WorkerRelayHooks = { getWorkerRelay: () => null };
  const crypto: CryptoHooks = { verifyEvent: async () => true };
  return { relayPool, relayConfig, windowManager, auth, config, hotkeys, workerRelay, crypto };
}

describe('NAP-SHELL domain-only capability posture', () => {
  it('does not emit browser sandbox capability payloads', () => {
    const caps = buildShellCapabilities(stubHooks());
    expect(Object.keys(caps)).toEqual(['domains']);
    expect(caps.domains.some((entry) => entry.startsWith('perm:'))).toBe(false);
  });

  it('answers exact bare domain membership only', () => {
    const caps: ShellCapabilities = { domains: ['relay', 'identity', 'storage'] };
    expect(lookup(caps, 'relay')).toBe(true);
    expect(lookup(caps, 'identity')).toBe(true);
    expect(lookup(caps, 'nap:relay')).toBe(false);
    expect(lookup(caps, 'perm:relay')).toBe(false);
    expect(lookup(caps, 'missing')).toBe(false);
  });

  it('defines ShellCapabilities with its sole domains field', () => {
    expect(TYPES_SOURCE).toMatch(/interface ShellCapabilities\s*\{[\s\S]{0,200}readonly domains/);
    expect(TYPES_SOURCE).not.toMatch(/interface ShellCapabilities[\s\S]{0,500}\b(naps|sandbox|protocols)\s*:/);
  });
});
