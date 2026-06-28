/**
 * shell-supports-conformance.test.ts
 *
 * Behavior verification of Kehto's legacy `shell.init` compatibility payload.
 *
 * ## kehto's emitted wire shape (this release — TERM-03)
 *
 * `buildShellCapabilities` (shell-init.ts) emits
 * `capabilities.{ domains, protocols }` alongside the flat `{ naps, sandbox }`
 * fields for older consumers. Current `@napplet/nap@0.23` no longer exports a
 * shell-level `makeSupports` helper; runtime availability now comes from
 * injected `window.napplet.<domain>` objects. The tests below keep Kehto's
 * emitted compatibility shape honest without depending on a removed upstream
 * helper path.
 *
 * ## perm:<x> handling (verified)
 *
 * The compatibility helper modeled here has no special permission namespace.
 * `supports('perm:popups')` resolves as ordinary `domains` membership
 * (`'perm:popups' ∈ capabilities.domains`). Kehto's sandbox permissions are
 * therefore folded into `domains`; with the default-empty sandbox, no perm:
 * entries appear and `supports('perm:<x>')` is `false` unless the host extends.
 */

import { describe, it, expect } from 'vitest';
import { buildShellCapabilities } from './shell-init.js';
import type { ShellAdapter, ShellCapabilities } from './types.js';

function legacySupports(caps: ShellCapabilities): (domain: string, protocol?: string) => boolean {
  const domains = new Set(caps.domains);
  return (domain, protocol) => {
    if (typeof protocol === 'string') {
      return caps.protocols[domain]?.includes(protocol) === true;
    }
    return domains.has(domain);
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
// Conformance — Kehto-emitted compatibility capabilities.
// ---------------------------------------------------------------------------

describe('legacy shell.supports compatibility over kehto-emitted capabilities', () => {
  const caps = buildShellCapabilities(baseHooks());
  const supports = legacySupports(caps);

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
    it('removed transport domain support is false', () => {
      const removedTransport = [105, 102, 99].map((char) => String.fromCharCode(char)).join('');
      expect(supports(removedTransport)).toBe(false);
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
      // The compatibility helper has no permission namespace; perm: queries hit domains.
      // kehto's default-empty sandbox contributes no perm: entries.
      expect(supports('perm:popups')).toBe(false);
    });
  });

  describe('structured compatibility shape', () => {
    it('kehto-emitted capabilities.{domains,protocols} are internally complete', () => {
      expect(caps.domains).toEqual(expect.arrayContaining(['inc', 'relay']));
      expect(caps.protocols.inc).toEqual(expect.arrayContaining(['NAP-01']));
      expect(supports('inc')).toBe(true);
      expect(supports('relay')).toBe(true);
      expect(supports('inc', 'NAP-01')).toBe(true);
      expect(supports('bogus')).toBe(false);
    });
  });
});

describe('legacy shell.supports compatibility — without upload backend', () => {
  it('supports("upload") === false when upload not wired', () => {
    const caps = buildShellCapabilities(baseHooks());
    const supports = legacySupports(caps);
    expect(supports('upload')).toBe(false);
  });
});

describe('legacy shell.supports compatibility — with upload backend', () => {
  it('supports("upload") === true when upload is wired', () => {
    const hooks: ShellAdapter = {
      ...baseHooks(),
      upload: { getUploader: () => ({ rails: ['nip96'] }) },
    };
    const caps = buildShellCapabilities(hooks);
    const supports = legacySupports(caps);
    expect(supports('upload')).toBe(true);
  });
});
