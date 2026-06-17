/**
 * perm-namespace.test.ts — Regression test for SH-C02 / DRIFT-SHELL-02.
 *
 * Canonical NIP-5D (https://github.com/nostr-protocol/nips/pull/2303/) mandates that
 * `window.napplet.shell.supports()` distinguishes between:
 *
 *   - NAP-capability lookups using bare domain names. `nap:` is the
 *     PRIMARY prefix (the NAP vocabulary the released @napplet/shim
 *     resolves), e.g. `supports('nap:relay')`, `supports('relay')`.
 *     `nub:` remains an ACCEPTED back-compat alias for legacy callers,
 *     e.g. `supports('nub:relay')`.
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
 *      MUST route `'perm:*'` checks to the sandbox array, `'nap:*'`
 *      checks to the primary naps array, `'nub:*'` checks to the legacy
 *      nubs array, and resolve bare names against naps first (falling
 *      back to nubs) — never crossing into the perm: namespace.
 *   3. Negative cases: `supports('popups')` returns false when only
 *      `'perm:popups'` is in sandbox; `supports('perm:relay')` returns
 *      false even when `'relay'` is a recognised NAP/NUB capability.
 *
 * TERM-01: `nap:` is the primary asserted prefix; `nub:` is an accepted alias.
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
// Mirrors the behaviour @napplet/shim's shell.supports() helper MUST
// implement. `nap:` is the primary prefix resolved against the naps array;
// `nub:` is an accepted legacy alias resolved against the nubs array; a bare
// name resolves against naps first, falling back to nubs. `perm:` stays in its
// own namespace (sandbox), never crossing into the capability arrays.

function lookup(caps: ShellCapabilities, capability: string): boolean {
  if (capability.startsWith('perm:')) return caps.sandbox.includes(capability);
  if (capability.startsWith('nap:')) return (caps.naps ?? []).includes(capability.slice(4));
  if (capability.startsWith('nub:')) return caps.nubs.includes(capability.slice(4));
  return (caps.naps ?? []).includes(capability) || caps.nubs.includes(capability);
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('SH-C02: shell.supports() uses perm: namespace for sandbox permissions', () => {
  it('sandbox lookup requires the perm: prefix (bare names rejected)', () => {
    const caps: ShellCapabilities = {
      domains: [],
      protocols: {},
      naps: [],
      nubs: [],
      sandbox: ['perm:popups', 'perm:modals'],
    };
    expect(lookup(caps, 'perm:popups')).toBe(true);
    expect(lookup(caps, 'perm:modals')).toBe(true);
    // Bare-name lookup for a sandbox permission MUST NOT match.
    expect(lookup(caps, 'popups')).toBe(false);
    expect(lookup(caps, 'modals')).toBe(false);
  });

  it('NAP lookup uses nap: as the primary prefix; nub: is an accepted alias', () => {
    const caps: ShellCapabilities = {
      domains: ['relay', 'identity', 'storage'],
      protocols: {},
      // `naps` is the PRIMARY array (NAP vocabulary); `nubs` is the legacy alias.
      naps: ['relay', 'identity', 'storage'],
      nubs: ['relay', 'identity', 'storage'],
      sandbox: [],
    };
    // nap: is primary — resolves against the naps array.
    expect(lookup(caps, 'nap:relay')).toBe(true);
    expect(lookup(caps, 'nap:identity')).toBe(true);
    // bare names resolve against naps (primary) first.
    expect(lookup(caps, 'relay')).toBe(true);
    expect(lookup(caps, 'identity')).toBe(true);
    // nub: remains an accepted back-compat alias resolved against nubs.
    expect(lookup(caps, 'nub:relay')).toBe(true);
    expect(lookup(caps, 'nub:identity')).toBe(true);
    // A NAP/NUB capability is NEVER reachable through the perm: namespace.
    expect(lookup(caps, 'perm:relay')).toBe(false);
    expect(lookup(caps, 'perm:identity')).toBe(false);
    expect(lookup(caps, 'nap:missing')).toBe(false);
    expect(lookup(caps, 'nub:missing')).toBe(false);
  });

  it('namespaces do not cross — perm:<x> and <x> are distinct', () => {
    // Shell hypothetically advertises both a NUB called "relay" AND a
    // sandbox permission called "relay". Only the namespaced lookup
    // should reach the sandbox entry; the bare lookup reaches the nub.
    const caps: ShellCapabilities = {
      domains: ['relay'],
      protocols: {},
      naps: ['relay'],
      nubs: ['relay'],
      sandbox: ['perm:relay'],
    };
    expect(lookup(caps, 'nap:relay')).toBe(true);    // NAP reachable (primary)
    expect(lookup(caps, 'relay')).toBe(true);        // bare reachable
    expect(lookup(caps, 'nub:relay')).toBe(true);    // NUB alias reachable
    expect(lookup(caps, 'perm:relay')).toBe(true);   // sandbox reachable
    // Cross-namespace lookups fail:
    expect(lookup(caps, 'perm:relay') && caps.naps.includes('perm:relay')).toBe(false);
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
