/**
 * no-window-nostr.test.ts — Regression test for SH-C01 / SH-C03.
 *
 * Canonical NIP-5D forbids the shell from injecting `window.nostr` into
 * napplet iframes (specs/NIP-5D.md line 44 + Security §6). This test
 * enforces that constraint by inspecting the @kehto/shell source code and
 * public API:
 *
 * 1. `shell-init.ts` source contains no `window.nostr =` assignment.
 * 2. `shell-init.ts` source contains no `_shellRequest(...)` helper
 *    (the former signer proxy plumbing).
 * 3. The @kehto/shell barrel does NOT export `generateNostrBootstrap`.
 * 4. `buildShellCapabilities(hooks)` never advertises the `'signer'` NUB.
 * 5. `buildShellCapabilities(hooks)` (with a relay hook) emits the
 *    canonical hosted NUB list and excludes out-of-scope `nostrdb`.
 *
 * Closes DRIFT-SHELL-01 and DRIFT-SHELL-04; partial coverage of
 * DRIFT-SHELL-03 (full closure lands with Plan 12-08 relay.publishEncrypted).
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import * as shell from '../src/index.js';
import { buildShellCapabilities } from '../src/shell-init.js';
import type {
  ShellAdapter,
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
// Read the on-disk source so the test enforces removal even if a dead export
// happens to still compile.

const SHELL_INIT_SOURCE = readFileSync(
  new URL('../src/shell-init.ts', import.meta.url),
  'utf8',
);

// ─── Stub hooks ──────────────────────────────────────────────────────────────
// Minimal no-op ShellAdapter — enough to call buildShellCapabilities without
// exercising any real protocol flow. `relayPool` is always present (required
// by the ShellAdapter type); whether the hook is "wired" is what varies.

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
  return {
    createWindow: () => null,
  };
}

function makeAuthHooks(): AuthHooks {
  return {
    getUserPubkey: () => null,
    getSigner: () => null,
  };
}

function makeConfigHooks(): ConfigHooks {
  return {
    getNappUpdateBehavior: () => 'banner',
  };
}

function makeHotkeyHooks(): HotkeyHooks {
  return {
    executeHotkeyFromForward: () => {},
  };
}

function makeWorkerRelayHooks(): WorkerRelayHooks {
  return {
    getWorkerRelay: () => null,
  };
}

function makeCryptoHooks(): CryptoHooks {
  return {
    verifyEvent: async () => true,
  };
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

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('SH-C01 / SH-C03: window.nostr injection is removed', () => {
  it('shell-init.ts source has no window.nostr assignment', () => {
    expect(SHELL_INIT_SOURCE).not.toMatch(/window\.nostr\s*=/);
  });

  it('shell-init.ts source has no _shellRequest helper', () => {
    expect(SHELL_INIT_SOURCE).not.toMatch(/_shellRequest/);
  });

  it('generateNostrBootstrap is not exported from @kehto/shell', () => {
    expect((shell as Record<string, unknown>).generateNostrBootstrap).toBeUndefined();
  });

  it('buildShellCapabilities omits "signer"', () => {
    const caps = buildShellCapabilities(stubHooks());
    expect(caps.nubs).not.toContain('signer');
  });

  it('buildShellCapabilities emits the canonical hosted domain list when relay hook is wired', () => {
    // v1.12 Phase 57: connect/class are classified Kehto NUB extensions; nostrdb stays out of scope.
    // The shell also advertises the implemented IFC topic-family protocols.
    const caps = buildShellCapabilities(stubHooks());
    expect(new Set(caps.nubs)).toEqual(
      new Set([
        'relay', 'identity', 'storage', 'ifc', 'theme', 'keys', 'media', 'notify', 'config', 'resource', 'connect', 'class', 'cvm',
        'ifc:NAP-01', 'ifc:NUB-01', 'ifc:NUB-02', 'ifc:NUB-03', 'ifc:NUB-04', 'ifc:NUB-05', 'ifc:NUB-06',
      ]),
    );
    expect(caps.nubs).not.toContain('nostrdb');
  });
});
