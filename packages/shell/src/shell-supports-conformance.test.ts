/**
 * shell-supports-conformance.test.ts
 *
 * Behavior verification of kehto-emitted capabilities against the REAL
 * @napplet/shim@0.13.0 supports() logic.
 *
 * ## What changed in 0.13 (capability model migration)
 *
 * @napplet/shim@0.13.0 no longer ships its own `createShellSupports`. On
 * `shell.init` it delegates to @napplet/nap@0.12's shell shim:
 *
 *   import { createShellEnvironment, makeSupports } from '@napplet/nap/shell/shim';
 *   const env = createShellEnvironment(msg);   // reads msg.capabilities.{domains, protocols}
 *   shell.supports = makeSupports(env);        // domains Set + protocols map
 *
 * The pre-0.13 model read a FLAT `capabilities.naps` string array and expanded
 * `domain:NAP-NN` entries in-shim. The 0.13 model reads a STRUCTURED
 * `capabilities.{ domains: string[], protocols: Record<string, string[]> }`.
 * This is a wire-shape change, not a rename.
 *
 * ## kehto's emitted wire shape (this release — TERM-03)
 *
 * `buildShellCapabilities` (shell-init.ts) now emits the conformant
 * `capabilities.{ domains, protocols }` shape ALONGSIDE the legacy
 * `{ naps, nubs, sandbox }` fields (superset for back-compat — TERM-05). The
 * tests below feed kehto's REAL emitted `shell.init` envelope (domains +
 * protocols included) straight into the real 0.13 `createShellEnvironment` +
 * `makeSupports` — no projection/adapter — and assert the shim answers
 * truthfully for offered domains/protocols and `false` for everything else.
 *
 * ## perm:<x> handling in 0.13 (verified)
 *
 * The 0.13 shell shim has NO special permission namespace. `makeSupports`
 * resolves `supports('perm:popups')` as an ordinary `domains` membership check
 * (`'perm:popups' ∈ capabilities.domains`). kehto's sandbox permissions are
 * therefore folded into `domains`; with the default-empty sandbox, no perm:
 * entries appear and `supports('perm:<x>')` is `false` unless the host extends.
 *
 * Verified against:
 *   node_modules/.pnpm/@napplet+shim@0.13.0/.../dist/index.js (handleShellInit)
 *   node_modules/.pnpm/@napplet+nap@0.12.0/.../dist/shell/shim.js (createShellEnvironment, makeSupports)
 */

import { describe, it, expect } from 'vitest';
// Real 0.13 supports() logic: @napplet/shim@0.13 delegates to these on shell.init.
import { createShellEnvironment, makeSupports } from '@napplet/nap/shell/shim';
import { buildShellCapabilities } from './shell-init.js';
import type { ShellAdapter, ShellCapabilities } from './types.js';

// ---------------------------------------------------------------------------
// Feed kehto's REAL emitted shell.init envelope into the real 0.13 shim.
//
// No projection or adapter: kehto now emits capabilities.{ domains, protocols }
// directly, which is exactly what `createShellEnvironment` reads. This mirrors
// the runtime's postShellInit wire shape (the whole capabilities object rides
// along).
// ---------------------------------------------------------------------------

function realShimSupports(caps: ShellCapabilities): (domain: string, protocol?: string) => boolean {
  const env = createShellEnvironment({
    type: 'shell.init',
    capabilities: caps,
    services: [],
  });
  return makeSupports(env);
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
// Conformance — kehto-emitted capabilities fed through the real 0.13 supports()
// ---------------------------------------------------------------------------

describe('real @napplet/shim@0.13 makeSupports fed kehto-emitted capabilities', () => {
  const caps = buildShellCapabilities(baseHooks());
  const supports = realShimSupports(caps);

  describe('bare inc domain', () => {
    it('supports("inc") === true (bare domain present in capabilities.domains)', () => {
      expect(supports('inc')).toBe(true);
    });
  });

  describe('inc:NAP-0N protocol queries (capabilities.protocols.inc)', () => {
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
    it('supports("outbox") === true (relay pool wired)', () => {
      expect(supports('outbox')).toBe(true);
    });
  });

  describe('removed / unknown domain queries', () => {
    it('supports("ifc") === false (legacy vocabulary not in conformant domains)', () => {
      // ifc lives only in legacy nubs — the 0.13 shim reads capabilities.domains.
      expect(supports('ifc')).toBe(false);
    });
    it('supports("bogus") === false (not advertised)', () => {
      expect(supports('bogus')).toBe(false);
    });
    it('supports("inc", "NAP-99") === false (unadvertised protocol)', () => {
      expect(supports('inc', 'NAP-99')).toBe(false);
    });
    it('supports("storage", "NAP-01") === false (no protocols for storage)', () => {
      expect(supports('storage', 'NAP-01')).toBe(false);
    });
  });

  describe('perm:<x> sandbox handling (0.13 = plain domains membership)', () => {
    it('supports("perm:popups") === false by default (sandbox empty)', () => {
      // The 0.13 shim has no permission namespace — perm: queries hit domains.
      // kehto's default-empty sandbox contributes no perm: entries.
      expect(supports('perm:popups')).toBe(false);
    });
  });

  describe('conformant structured shape — fed kehto capabilities directly', () => {
    it('kehto-emitted capabilities.{domains,protocols} resolve truthfully under real 0.13', () => {
      // Replaces the prior pinned "raw {naps} → all false" gap: kehto now emits
      // the structured shape, so the real shim answers true for offered caps.
      const env = createShellEnvironment({
        type: 'shell.init',
        capabilities: caps,
        services: [],
      });
      const supportsStructured = makeSupports(env);
      expect(supportsStructured('inc')).toBe(true);
      expect(supportsStructured('relay')).toBe(true);
      expect(supportsStructured('inc', 'NAP-01')).toBe(true);
      expect(supportsStructured('bogus')).toBe(false);
    });
  });
});

describe('real @napplet/shim@0.13 makeSupports — without upload backend', () => {
  it('supports("upload") === false when upload not wired', () => {
    const caps = buildShellCapabilities(baseHooks());
    const supports = realShimSupports(caps);
    expect(supports('upload')).toBe(false);
  });
});

describe('real @napplet/shim@0.13 makeSupports — with upload backend', () => {
  it('supports("upload") === true when upload is wired', () => {
    const hooks: ShellAdapter = {
      ...baseHooks(),
      upload: { getUploader: () => ({ rails: ['nip96'] }) },
    };
    const caps = buildShellCapabilities(hooks);
    const supports = realShimSupports(caps);
    expect(supports('upload')).toBe(true);
  });
});
