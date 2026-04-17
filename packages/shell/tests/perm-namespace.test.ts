/**
 * perm-namespace.test.ts — Regression test for SH-C02 / DRIFT-SHELL-02.
 *
 * Canonical NIP-5D (specs/NIP-5D.md lines 81-94) mandates that
 * `window.napplet.shell.supports()` distinguishes between:
 *
 *   - NUB-capability lookups using bare domain names (or the optional
 *     `nub:` prefix), e.g. `supports('relay')`, `supports('identity')`.
 *   - Sandbox-permission lookups under the `perm:<permission>`
 *     namespace, e.g. `supports('perm:popups')`, `supports('perm:modals')`.
 *
 * @kehto/shell does NOT currently ship a `supports()` helper — the
 * napplet-side @napplet/sdk/shim computes `supports()` locally against
 * the cached capabilities map delivered in the `shell.init` envelope.
 * The contract this test enforces is therefore:
 *
 *   1. ShellCapabilities.sandbox entries MUST begin with the literal
 *      prefix `'perm:'` — encoded as a JSDoc contract on the type and
 *      exercised here.
 *   2. A capability-lookup routine that mirrors the shim's behavior
 *      MUST route `'perm:*'` checks to the sandbox array and bare
 *      names to the nubs array, never crossing the two.
 *   3. Negative cases: `supports('popups')` returns false when only
 *      `'perm:popups'` is in sandbox; `supports('perm:relay')` returns
 *      false even when `'relay'` is a recognised nub.
 *
 * Closes DRIFT-SHELL-02.
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
// Mirrors the behaviour @napplet/sdk/shim's shell.supports() helper MUST
// implement. Exact-string match; no prefix stripping, no fallback to bare
// name when the `perm:`-prefixed lookup fails.

function lookup(caps: ShellCapabilities, capability: string): boolean {
  if (capability.startsWith('perm:')) return caps.sandbox.includes(capability);
  return caps.nubs.includes(capability);
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('SH-C02: shell.supports() uses perm: namespace for sandbox permissions', () => {
  it('sandbox lookup requires the perm: prefix (bare names rejected)', () => {
    const caps: ShellCapabilities = {
      nubs: [],
      sandbox: ['perm:popups', 'perm:modals'],
    };
    expect(lookup(caps, 'perm:popups')).toBe(true);
    expect(lookup(caps, 'perm:modals')).toBe(true);
    // Bare-name lookup for a sandbox permission MUST NOT match.
    expect(lookup(caps, 'popups')).toBe(false);
    expect(lookup(caps, 'modals')).toBe(false);
  });

  it('NUB lookup uses bare domain names, never perm:', () => {
    const caps: ShellCapabilities = {
      nubs: ['relay', 'identity', 'storage'],
      sandbox: [],
    };
    expect(lookup(caps, 'relay')).toBe(true);
    expect(lookup(caps, 'identity')).toBe(true);
    // A NUB capability is NEVER reachable through the perm: namespace.
    expect(lookup(caps, 'perm:relay')).toBe(false);
    expect(lookup(caps, 'perm:identity')).toBe(false);
  });

  it('namespaces do not cross — perm:<x> and <x> are distinct', () => {
    // Shell hypothetically advertises both a NUB called "relay" AND a
    // sandbox permission called "relay". Only the namespaced lookup
    // should reach the sandbox entry; the bare lookup reaches the nub.
    const caps: ShellCapabilities = {
      nubs: ['relay'],
      sandbox: ['perm:relay'],
    };
    expect(lookup(caps, 'relay')).toBe(true);        // NUB reachable
    expect(lookup(caps, 'perm:relay')).toBe(true);   // sandbox reachable
    // Cross-namespace lookups fail:
    expect(lookup(caps, 'perm:relay') && caps.nubs.includes('perm:relay')).toBe(false);
    expect(caps.sandbox.includes('relay')).toBe(false);
  });

  it('buildShellCapabilities-emitted sandbox entries all carry the perm: prefix', () => {
    // The default sandbox is empty today; the assertion nonetheless
    // enforces the contract so any future host-app extension that adds
    // a bare-name entry flunks this test.
    const caps = buildShellCapabilities(stubHooks());
    for (const entry of caps.sandbox) {
      expect(entry, `sandbox entry "${entry}" must start with 'perm:'`).toMatch(/^perm:/);
    }
  });

  it('ShellCapabilities.sandbox JSDoc documents the perm: namespace contract', () => {
    // The on-disk JSDoc MUST cite the `perm:` prefix contract, so napplet
    // authors and downstream shells understand the namespacing rule
    // without reading the spec. This is the test that fails RED until
    // Task 2 updates the JSDoc on types.ts.
    expect(TYPES_SOURCE).toMatch(/sandbox[\s\S]{0,400}perm:/);
  });
});
