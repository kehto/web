/**
 * perm-namespace.test.ts — Regression test for sandbox capability drift.
 *
 * Kehto's current NIP-5D posture is intentionally narrow:
 *
 *   - NAP capabilities are bare domains or `nap:<domain>` lookups.
 *   - Browser sandbox relaxations are not a NIP-5D interoperability surface.
 *   - ShellCapabilities.sandbox remains only as an empty compatibility field.
 *
 * TERM-01: `nap:` is the primary asserted prefix.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { buildShellCapabilities } from '../src/shell-init.js';
import type {
  ShellAdapter,
  ShellCapabilities,
  RelayPoolHooks,
  RelayConfigHooks,
  WindowManagerHooks,
  AuthHooks,
  ConfigHooks,
  HotkeyHooks,
  WorkerRelayHooks,
  CryptoHooks,
} from '../src/types.js';

// ─── Source-text assertions ──────────────────────────────────────────────────

const TYPES_SOURCE = readFileSync(
  new URL('../src/types.ts', import.meta.url),
  'utf8',
);

// ─── Stub hooks (minimal no-op ShellAdapter) ─────────────────────────────────

function makeRelayPoolHooks(): RelayPoolHooks {
  return {
    getRelayPool: () => null,
    trackSubscription: () => {},
    untrackSubscription: () => {},
    openScopedRelay: () => {},
    closeScopedRelay: () => {},
    publishToScopedRelay: () => false,
    selectRelayTier: () => [],
  };
}

function makeRelayConfigHooks(): RelayConfigHooks {
  return {
    addRelay: () => {},
    removeRelay: () => {},
    getRelayConfig: () => ({ discovery: [], super: [], outbox: [] }),
    getNip66Suggestions: () => ({}),
  };
}

function makeWindowManagerHooks(): WindowManagerHooks {
  return { createWindow: () => null };
}

function makeAuthHooks(): AuthHooks {
  return { getUserPubkey: () => null, getSigner: () => null };
}

function makeConfigHooks(): ConfigHooks {
  return { getNappUpdateBehavior: () => 'banner' };
}

function makeHotkeyHooks(): HotkeyHooks {
  return { executeHotkeyFromForward: () => {} };
}

function makeWorkerRelayHooks(): WorkerRelayHooks {
  return { getWorkerRelay: () => null };
}

function makeCryptoHooks(): CryptoHooks {
  return { verifyEvent: async () => true };
}

function stubHooks(): ShellAdapter {
  return {
    relayPool: makeRelayPoolHooks(),
    relayConfig: makeRelayConfigHooks(),
    windowManager: makeWindowManagerHooks(),
    auth: makeAuthHooks(),
    config: makeConfigHooks(),
    hotkeys: makeHotkeyHooks(),
    workerRelay: makeWorkerRelayHooks(),
    crypto: makeCryptoHooks(),
  };
}

// ─── Capability-lookup contract ──────────────────────────────────────────────
// Mirrors the capability lookups Kehto still supports for compatibility:
// `nap:` is the primary prefix resolved against the naps array; a bare name
// resolves against naps too. Sandbox entries are intentionally ignored.

function lookup(caps: ShellCapabilities, capability: string): boolean {
  if (capability.startsWith('nap:')) return (caps.naps ?? []).includes(capability.slice(4));
  return (caps.naps ?? []).includes(capability);
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('NIP-5D sandbox capability posture', () => {
  it('buildShellCapabilities emits no browser sandbox capabilities', () => {
    const caps = buildShellCapabilities(stubHooks());
    expect(caps.sandbox).toEqual([]);
    expect(caps.domains.some((entry) => entry.startsWith('perm:'))).toBe(false);
  });

  it('NAP lookup uses nap: as the primary prefix', () => {
    const caps: ShellCapabilities = {
      domains: ['relay', 'identity', 'storage'],
      protocols: {},
      naps: ['relay', 'identity', 'storage'],
      sandbox: [],
    };
    // nap: is primary — resolves against the naps array.
    expect(lookup(caps, 'nap:relay')).toBe(true);
    expect(lookup(caps, 'nap:identity')).toBe(true);
    // bare names resolve against naps too.
    expect(lookup(caps, 'relay')).toBe(true);
    expect(lookup(caps, 'identity')).toBe(true);
    // A NAP capability is not reachable through a sandbox-style prefix.
    expect(lookup(caps, 'perm:relay')).toBe(false);
    expect(lookup(caps, 'perm:identity')).toBe(false);
    expect(lookup(caps, 'nap:missing')).toBe(false);
  });

  it('compatibility lookup ignores sandbox entries even if a host mutates the field', () => {
    const caps: ShellCapabilities = {
      domains: ['relay'],
      protocols: {},
      naps: ['relay'],
      sandbox: ['perm:relay'],
    };
    expect(lookup(caps, 'nap:relay')).toBe(true);    // NAP reachable (primary)
    expect(lookup(caps, 'relay')).toBe(true);        // bare reachable
    expect(lookup(caps, 'perm:relay')).toBe(false);
  });

  it('ShellCapabilities.sandbox JSDoc documents the empty compatibility field', () => {
    expect(TYPES_SOURCE).toMatch(/Empty compatibility field[\s\S]{0,500}sandbox/);
    expect(TYPES_SOURCE).toMatch(/do not receive optional[\s\S]{0,200}advertised capabilities/);
  });
});
