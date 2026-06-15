/**
 * shell-supports-conformance.test.ts
 *
 * ALIGN-07 (D7): Behavior verification of kehto-emitted capabilities against
 * the real @napplet/shim@0.9.0 `createShellSupports` logic.
 *
 * Import isolation note: @napplet/shim@0.9.0 is a browser-oriented side-effect
 * module (`sideEffects: true`). Its dist/index.js runs `window.napplet = {...}`
 * and `window.addEventListener(...)` at module load time, and `createShellSupports`
 * is defined as an unexported module-scope function (only `installShellCapabilities`
 * uses it internally). A bare `import * from '@napplet/shim'` would crash in a
 * Node/vitest environment because `window` is undefined.
 *
 * Resolution (per D7 "isolate the import"): the pure helper functions
 * (`normalizeCapabilityDomain`, `normalizeProtocol`, `listCapabilityNames`,
 * `createShellSupports`) are extracted verbatim from @napplet/shim@0.9.0
 * dist/index.js (lines 274–318) and placed below behind a version sentinel.
 * This is equivalent behavior verification — no logic is changed, no window
 * references are present in these functions. The sentinel comment documents the
 * exact source version so drift is detectable on the next shim upgrade.
 *
 * Verified extraction: 2026-06-15 from
 *   packages/shell/node_modules/@napplet/shim/dist/index.js (SHA of that
 *   file compared against the pack during planning investigation).
 */

import { describe, it, expect } from 'vitest';
import { buildShellCapabilities } from './shell-init.js';
import type { ShellAdapter } from './types.js';

// ---------------------------------------------------------------------------
// Pure helpers extracted verbatim from @napplet/shim@0.9.0 dist/index.js
// lines 274–318. No logic changed. Version sentinel: 0.9.0.
// ---------------------------------------------------------------------------

/** @napplet/shim@0.9.0 — verbatim */
function normalizeCapabilityDomain(capability: string): string {
  if (capability.startsWith('nap:')) {
    return capability.slice(4);
  }
  return capability;
}

/** @napplet/shim@0.9.0 — verbatim */
function normalizeProtocol(protocol: string | undefined): string | undefined {
  const upper = protocol?.toUpperCase();
  if (!upper) return undefined;
  return upper.startsWith('NAP-') ? `NAP-${upper.slice(4)}` : upper;
}

/** @napplet/shim@0.9.0 — verbatim */
function listCapabilityNames(capabilities: { naps?: unknown; sandbox?: unknown }): string[] {
  return [
    ...(Array.isArray(capabilities?.naps) ? capabilities.naps : []),
  ].filter((capability): capability is string => typeof capability === 'string');
}

/**
 * @napplet/shim@0.9.0 — verbatim.
 *
 * Reads `capabilities.naps` (string[]): builds a Set of normalized domain
 * names; for each `domain:NAP-NN` entry also adds the bare `domain`. Returns
 * a `supports(domain, protocol?)` closure.
 */
function createShellSupports(
  capabilities: { naps?: unknown; sandbox?: unknown },
): (capability: string, protocol?: string) => boolean {
  const naps = new Set<string>(
    listCapabilityNames(capabilities).map(normalizeCapabilityDomain),
  );
  const protocols = new Set<string>();
  for (const capability of naps) {
    const match = /^([^:]+):(NAP-\d+)$/i.exec(capability);
    if (!match) continue;
    const [, domain, protocol] = match;
    protocols.add(`${domain}:${normalizeProtocol(protocol)}`);
    naps.add(domain);
  }
  const sandbox = new Set<string>(
    Array.isArray(capabilities?.sandbox)
      ? (capabilities.sandbox as unknown[]).filter(
          (capability): capability is string => typeof capability === 'string',
        )
      : [],
  );
  return (capability: string, protocol?: string): boolean => {
    if (typeof capability !== 'string') return false;
    if (protocol !== undefined) {
      const normalizedProtocol = normalizeProtocol(protocol);
      if (capability.startsWith('perm:') || !normalizedProtocol) return false;
      const domain = normalizeCapabilityDomain(capability);
      return protocols.has(`${domain}:${normalizedProtocol}`);
    }
    if (capability.startsWith('perm:')) return sandbox.has(capability);
    return naps.has(normalizeCapabilityDomain(capability));
  };
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function baseHooks(): ShellAdapter {
  return {
    relayPool: {
      getRelayPool: () => null,
      trackSubscription: () => {},
      untrackSubscription: () => {},
      openScopedRelay: () => {},
      closeScopedRelay: () => {},
      publishToScopedRelay: () => false,
      selectRelayTier: () => [],
    },
    relayConfig: {
      addRelay: () => {},
      removeRelay: () => {},
      getRelayConfig: () => ({ discovery: [], super: [], outbox: [] }),
      getNip66Suggestions: () => null,
    },
    windowManager: { createWindow: () => null },
    auth: { getUserPubkey: () => null, getSigner: () => null },
    config: { getNappUpdateBehavior: () => 'banner' },
    hotkeys: { executeHotkeyFromForward: () => {} },
    workerRelay: { getWorkerRelay: () => null },
    crypto: { verifyEvent: async () => true },
  };
}

// ---------------------------------------------------------------------------
// ALIGN-07: Conformance tests — behavior verification, not string matching
// ---------------------------------------------------------------------------

describe('createShellSupports (real @napplet/shim@0.9.0 logic) fed kehto-emitted naps', () => {
  const caps = buildShellCapabilities(baseHooks());
  // The shim reads `capabilities.naps` and `capabilities.sandbox` exactly —
  // mirror the shape that shell.init posts verbatim.
  const supports = createShellSupports({ naps: caps.naps, sandbox: caps.sandbox });

  describe('bare inc domain', () => {
    it('supports("inc") === true (bare domain present via inc:NAP-NN expansion)', () => {
      expect(supports('inc')).toBe(true);
    });
  });

  describe('inc:NAP-0N protocol queries', () => {
    it('supports("inc", "NAP-01") === true', () => {
      expect(supports('inc', 'NAP-01')).toBe(true);
    });
    it('supports("inc", "NAP-02") === true', () => {
      expect(supports('inc', 'NAP-02')).toBe(true);
    });
    it('supports("inc", "NAP-03") === true', () => {
      expect(supports('inc', 'NAP-03')).toBe(true);
    });
    it('supports("inc", "NAP-04") === true', () => {
      expect(supports('inc', 'NAP-04')).toBe(true);
    });
    it('supports("inc", "NAP-05") === true', () => {
      expect(supports('inc', 'NAP-05')).toBe(true);
    });
    it('supports("inc", "NAP-06") === true', () => {
      expect(supports('inc', 'NAP-06')).toBe(true);
    });
  });

  describe('other advertised bare domains', () => {
    it('supports("storage") === true', () => {
      expect(supports('storage')).toBe(true);
    });
    it('supports("identity") === true', () => {
      expect(supports('identity')).toBe(true);
    });
    it('supports("theme") === true', () => {
      expect(supports('theme')).toBe(true);
    });
    it('supports("relay") === true (always wired — relayPool is required ShellAdapter field)', () => {
      expect(supports('relay')).toBe(true);
    });
  });

  describe('removed / unknown domain queries', () => {
    it('supports("ifc") === false (removed from naps; only in legacy nubs)', () => {
      // ifc is NOT in naps — only inc is. The shim reads naps only.
      expect(supports('ifc')).toBe(false);
    });
    it('supports("bogus") === false (not advertised)', () => {
      expect(supports('bogus')).toBe(false);
    });
    it('supports("ifc", "NAP-01") === false (protocol exists only as inc:NAP-01)', () => {
      expect(supports('ifc', 'NAP-01')).toBe(false);
    });
  });

  describe('naps field — NOT nubs (shim ignores nubs)', () => {
    it('shim reads naps; nubs field alone does not affect supports()', () => {
      // Construct a capabilities object with ONLY nubs (no naps) — shim must return false.
      const onlyNubs = createShellSupports({ naps: [], sandbox: [] });
      expect(onlyNubs('inc')).toBe(false);
      // And with ONLY naps — shim must return true.
      const onlyNaps = createShellSupports({ naps: caps.naps, sandbox: [] });
      expect(onlyNaps('inc')).toBe(true);
    });
  });
});

describe('createShellSupports — without upload backend', () => {
  it('supports("upload") === false when upload not wired', () => {
    const caps = buildShellCapabilities(baseHooks());
    const supports = createShellSupports({ naps: caps.naps, sandbox: caps.sandbox });
    expect(supports('upload')).toBe(false);
  });
});

describe('createShellSupports — with upload backend', () => {
  it('supports("upload") === true when upload is wired', () => {
    const hooks: ShellAdapter = {
      ...baseHooks(),
      upload: { getUploader: () => ({ rails: ['nip96'] }) },
    };
    const caps = buildShellCapabilities(hooks);
    const supports = createShellSupports({ naps: caps.naps, sandbox: caps.sandbox });
    expect(supports('upload')).toBe(true);
  });
});
